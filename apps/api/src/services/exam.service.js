const prisma = require('../lib/prisma');
const { assertStudentsInTenant } = require('../lib/tenantScope');

function calculateGrade(marks, maxMarks) {
  const pct = (marks / maxMarks) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

const SUBJECT_INCLUDE = {
  class: { select: { id: true, name: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  teachers: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      section: { select: { id: true, name: true } },
    },
  },
};

// Normalises the `teachers` payload the admin form sends: [{ teacherId, sectionId, isPrimary }].
// Sections must belong to the subject's own class, or a school could hand 6-A's maths
// to a teacher via a section of Class 9.
async function resolveAssignments(tenantId, classId, teachers) {
  if (!Array.isArray(teachers)) return null;

  const rows = [];
  const seen = new Set();
  for (const t of teachers) {
    const teacherId = t?.teacherId;
    if (!teacherId) continue;
    const sectionId = t.sectionId || null;
    const key = `${teacherId}:${sectionId || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ teacherId, sectionId, isPrimary: !!t.isPrimary });
  }
  if (rows.length === 0) return [];

  const teacherIds = [...new Set(rows.map(r => r.teacherId))];
  const found = await prisma.user.findMany({
    where: { id: { in: teacherIds }, tenantId, role: 'TEACHER' },
    select: { id: true },
  });
  if (found.length !== teacherIds.length) {
    throw Object.assign(new Error('One or more teachers were not found in this school'), { status: 404 });
  }

  const sectionIds = [...new Set(rows.map(r => r.sectionId).filter(Boolean))];
  if (sectionIds.length > 0) {
    const sections = await prisma.section.findMany({
      where: { id: { in: sectionIds }, tenantId, classId },
      select: { id: true },
    });
    if (sections.length !== sectionIds.length) {
      throw Object.assign(new Error('One or more sections do not belong to this subject\'s class'), { status: 422 });
    }
  }

  // Exactly one primary — it feeds Subject.teacherId, which the timetable
  // generator and report cards still read as the single owning teacher.
  if (!rows.some(r => r.isPrimary)) rows[0].isPrimary = true;
  let primarySeen = false;
  for (const r of rows) {
    if (r.isPrimary && primarySeen) r.isPrimary = false;
    else if (r.isPrimary) primarySeen = true;
  }
  return rows;
}

async function listSubjects(tenantId, { classId } = {}) {
  return prisma.subject.findMany({
    where: { tenantId, ...(classId && { classId }) },
    orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
    include: SUBJECT_INCLUDE,
  });
}

async function createSubject(tenantId, { classId, name, code, teacherId, periodsPerWeek, teachers }) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });

  // `teacherId` alone is still accepted (CSV imports, older clients).
  const assignments = await resolveAssignments(tenantId, classId, teachers)
    ?? (teacherId ? [{ teacherId, sectionId: null, isPrimary: true }] : []);
  const primary = assignments.find(a => a.isPrimary) || null;

  return prisma.subject.create({
    data: {
      tenantId, classId, name: name.trim(), code: code || null,
      teacherId: primary?.teacherId || null,
      periodsPerWeek: Number.isInteger(periodsPerWeek) ? periodsPerWeek : 0,
      teachers: { create: assignments.map(a => ({ ...a, tenantId })) },
    },
    include: SUBJECT_INCLUDE,
  });
}

// Creates the same subject across several classes in one go — a school with ten
// classes should not submit "Mathematics" ten times. Classes that already have a
// subject of this name are skipped rather than failing the whole batch, so the
// form is safe to re-submit.
async function createSubjectsBulk(tenantId, { classIds, name, code, periodsPerWeek, teachers }) {
  const ids = [...new Set((Array.isArray(classIds) ? classIds : []).filter(Boolean))];
  if (ids.length === 0) throw Object.assign(new Error('Select at least one class'), { status: 422 });

  const classes = await prisma.class.findMany({
    where: { id: { in: ids }, tenantId },
    select: { id: true, name: true },
  });
  if (classes.length !== ids.length) {
    throw Object.assign(new Error('One or more classes were not found in this school'), { status: 404 });
  }

  // Sections belong to a single class, so a batch spanning classes can only carry
  // class-wide teachers. Section scoping is done afterwards per subject.
  const classWide = Array.isArray(teachers)
    ? teachers.map(t => ({ ...t, sectionId: null }))
    : undefined;
  const assignments = (await resolveAssignments(tenantId, null, classWide)) ?? [];
  const primary = assignments.find(a => a.isPrimary) || null;
  const trimmed = name.trim();

  const existing = await prisma.subject.findMany({
    where: { tenantId, name: trimmed, classId: { in: ids } },
    select: { classId: true },
  });
  const alreadyHas = new Set(existing.map(e => e.classId));

  const skipped = classes.filter(c => alreadyHas.has(c.id)).map(c => c.name);
  const toCreate = classes.filter(c => !alreadyHas.has(c.id));

  // One transaction, so a failure part-way through cannot leave the subject
  // created for some of the selected classes and not others.
  const created = await prisma.$transaction(
    toCreate.map(cls => prisma.subject.create({
      data: {
        tenantId, classId: cls.id, name: trimmed, code: code || null,
        teacherId: primary?.teacherId || null,
        periodsPerWeek: Number.isInteger(periodsPerWeek) ? periodsPerWeek : 0,
        teachers: { create: assignments.map(a => ({ ...a, tenantId })) },
      },
      include: SUBJECT_INCLUDE,
    }))
  );
  return { created, skipped };
}

async function updateSubject(tenantId, id, data) {
  const s = await prisma.subject.findFirst({ where: { id, tenantId } });
  if (!s) throw Object.assign(new Error('Subject not found'), { status: 404 });

  const assignments = await resolveAssignments(tenantId, s.classId, data.teachers);
  const primaryId = assignments
    ? (assignments.find(a => a.isPrimary)?.teacherId || null)
    : (data.teacherId !== undefined ? data.teacherId || null : s.teacherId);

  return prisma.$transaction(async (tx) => {
    if (assignments) {
      // Replace the whole set — the form always submits the full roster.
      await tx.subjectTeacher.deleteMany({ where: { subjectId: id } });
      if (assignments.length > 0) {
        await tx.subjectTeacher.createMany({
          data: assignments.map(a => ({ ...a, tenantId, subjectId: id })),
        });
      }
    } else if (data.teacherId !== undefined && (data.teacherId || null) !== s.teacherId) {
      // Legacy single-teacher edit: keep the join table consistent with it.
      await tx.subjectTeacher.deleteMany({ where: { subjectId: id, sectionId: null } });
      if (data.teacherId) {
        await tx.subjectTeacher.create({
          data: { tenantId, subjectId: id, teacherId: data.teacherId, sectionId: null, isPrimary: true },
        });
      }
    }

    return tx.subject.update({
      where: { id },
      data: {
        name: data.name?.trim() || s.name,
        code: data.code ?? s.code,
        teacherId: primaryId,
        periodsPerWeek: Number.isInteger(data.periodsPerWeek) ? data.periodsPerWeek : s.periodsPerWeek,
      },
      include: SUBJECT_INCLUDE,
    });
  });
}

// ─── Teacher-centric assignment ───────────────────────────────────────────────

// Subjects are per class, so a teacher covering five grades has five separate
// subject rows. These two functions let the admin edit all of them from one
// screen instead of walking class by class.

// Subject.teacherId must always name one of the subject's assignment rows —
// the timetable generator and report cards read it as the single owning teacher.
async function syncSubjectPrimary(tx, subjectId) {
  const rows = await tx.subjectTeacher.findMany({
    where: { subjectId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
  if (rows.length === 0) {
    await tx.subject.update({ where: { id: subjectId }, data: { teacherId: null } });
    return;
  }
  // Whoever was primary keeps it; if that row is gone, the oldest is promoted.
  const primary = rows.find(r => r.isPrimary) || rows[0];
  const stale = rows.filter(r => r.isPrimary && r.id !== primary.id).map(r => r.id);
  if (stale.length > 0) {
    await tx.subjectTeacher.updateMany({ where: { id: { in: stale } }, data: { isPrimary: false } });
  }
  if (!primary.isPrimary) {
    await tx.subjectTeacher.update({ where: { id: primary.id }, data: { isPrimary: true } });
  }
  await tx.subject.update({ where: { id: subjectId }, data: { teacherId: primary.teacherId } });
}

// Every class with its sections and subjects, annotated with what this teacher
// currently teaches — one round trip for the whole grid.
async function getTeachingGrid(tenantId, teacherId) {
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, tenantId, role: 'TEACHER' } });
  if (!teacher) throw Object.assign(new Error('Teacher not found'), { status: 404 });

  const classes = await prisma.class.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: {
      sections: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      subjects: {
        orderBy: { name: 'asc' },
        include: {
          teachers: {
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            include: {
              teacher: { select: { id: true, firstName: true, lastName: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  return {
    teacher: { id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email },
    classes: classes.map(c => ({
      id: c.id,
      name: c.name,
      sections: c.sections,
      subjects: c.subjects.map(s => {
        const mine = s.teachers.filter(r => r.teacherId === teacherId);
        const others = s.teachers.filter(r => r.teacherId !== teacherId);
        return {
          id: s.id,
          name: s.name,
          code: s.code,
          // One row per section this teacher covers; sectionId null = whole class.
          assignments: mine.map(r => ({ sectionId: r.sectionId, isPrimary: r.isPrimary })),
          otherTeachers: others
            .filter(r => r.teacher)
            .map(r => ({
              name: `${r.teacher.firstName} ${r.teacher.lastName}`,
              section: r.section?.name || null,
              isPrimary: r.isPrimary,
            })),
        };
      }),
    })),
  };
}

// Replaces this teacher's assignments across the whole school in one save.
// `assignments`: [{ subjectId, sectionId|null }]. Primary flags are not set here —
// a teacher only becomes primary of a subject that has no other primary, so
// bulk-assigning never silently steals ownership from another teacher.
async function setTeacherSubjects(tenantId, teacherId, assignments) {
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, tenantId, role: 'TEACHER' } });
  if (!teacher) throw Object.assign(new Error('Teacher not found'), { status: 404 });

  const rows = [];
  const seen = new Set();
  for (const a of Array.isArray(assignments) ? assignments : []) {
    if (!a?.subjectId) continue;
    const sectionId = a.sectionId || null;
    const key = `${a.subjectId}:${sectionId || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ subjectId: a.subjectId, sectionId });
  }

  const subjectIds = [...new Set(rows.map(r => r.subjectId))];
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds }, tenantId },
    select: { id: true, classId: true },
  });
  if (subjects.length !== subjectIds.length) {
    throw Object.assign(new Error('One or more subjects were not found in this school'), { status: 404 });
  }
  const classBySubject = new Map(subjects.map(s => [s.id, s.classId]));

  // A section must belong to the class of the subject it is being pinned to.
  const sectionIds = [...new Set(rows.map(r => r.sectionId).filter(Boolean))];
  if (sectionIds.length > 0) {
    const sections = await prisma.section.findMany({
      where: { id: { in: sectionIds }, tenantId },
      select: { id: true, classId: true },
    });
    const classBySection = new Map(sections.map(s => [s.id, s.classId]));
    for (const r of rows) {
      if (!r.sectionId) continue;
      if (classBySection.get(r.sectionId) !== classBySubject.get(r.subjectId)) {
        throw Object.assign(new Error('A section does not belong to the class of the subject it was assigned to'), { status: 422 });
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    // Subjects they used to teach also need their primary recomputed.
    const previous = await tx.subjectTeacher.findMany({
      where: { tenantId, teacherId },
      select: { subjectId: true },
    });
    await tx.subjectTeacher.deleteMany({ where: { tenantId, teacherId } });
    if (rows.length > 0) {
      await tx.subjectTeacher.createMany({
        data: rows.map(r => ({ ...r, tenantId, teacherId, isPrimary: false })),
      });
    }

    const touched = new Set([...previous.map(p => p.subjectId), ...subjectIds]);
    for (const subjectId of touched) await syncSubjectPrimary(tx, subjectId);

    return { assigned: rows.length, subjectsTouched: touched.size };
  });
}

async function deleteSubject(tenantId, id) {
  const s = await prisma.subject.findFirst({ where: { id, tenantId }, include: { _count: { select: { examResults: true } } } });
  if (!s) throw Object.assign(new Error('Subject not found'), { status: 404 });
  if (s._count.examResults > 0) throw Object.assign(new Error('Cannot delete subject with existing exam results'), { status: 409 });
  await prisma.subject.delete({ where: { id } });
}

// ─── Exams ────────────────────────────────────────────────────────────────────

async function listExams(tenantId, { classId, academicYear, status } = {}) {
  return prisma.exam.findMany({
    where: {
      tenantId,
      ...(classId && { classId }),
      ...(academicYear && { academicYear }),
      ...(status && { status }),
    },
    orderBy: { startDate: 'desc' },
    include: {
      class: { select: { id: true, name: true } },
      _count: { select: { results: true } },
    },
  });
}

const TERMS = ['TERM_1', 'TERM_2', 'ANNUAL'];

// A term tag must be unique within a class+year: only one main (report-card) exam
// per term. Class tests stay term-less and are exempt.
async function assertTermAvailable(tenantId, classId, academicYear, term, excludeExamId) {
  if (!term) return;
  if (!TERMS.includes(term)) throw Object.assign(new Error('Invalid term'), { status: 422 });
  const clash = await prisma.exam.findFirst({
    where: { tenantId, classId, academicYear, term, ...(excludeExamId && { id: { not: excludeExamId } }) },
  });
  if (clash) throw Object.assign(new Error(`This class already has a ${term.replace('_', ' ')} exam for ${academicYear}.`), { status: 409 });
}

async function createExam(tenantId, data) {
  const { name, classId, sectionId, academicYear, term, startDate, endDate, maxMarks, passingMarks } = data;
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  const year = academicYear || currentAcademicYear();
  await assertTermAvailable(tenantId, classId, year, term || null);
  return prisma.exam.create({
    data: {
      tenantId, name, classId,
      sectionId: sectionId || null,
      academicYear: year,
      term: term || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      maxMarks: parseFloat(maxMarks) || 100,
      passingMarks: parseFloat(passingMarks) || 35,
    },
    include: { class: { select: { id: true, name: true } } },
  });
}

// One exam row per class — an Exam belongs to a single class, so scheduling the
// same term across classes means creating a batch of them.
async function createExamsBulk(tenantId, data) {
  const { name, classIds, academicYear, term, startDate, endDate, maxMarks, passingMarks } = data;
  const ids = [...new Set((Array.isArray(classIds) ? classIds : []).filter(Boolean))];
  if (ids.length === 0) throw Object.assign(new Error('Select at least one class'), { status: 422 });

  const classes = await prisma.class.findMany({
    where: { id: { in: ids }, tenantId },
    select: { id: true, name: true },
  });
  if (classes.length !== ids.length) {
    throw Object.assign(new Error('One or more classes were not found in this school'), { status: 404 });
  }

  const year = academicYear || currentAcademicYear();
  if (term && !TERMS.includes(term)) throw Object.assign(new Error('Invalid term'), { status: 422 });

  // A class already holding this term keeps its existing exam and is reported
  // back, rather than failing the whole batch.
  let alreadyHas = new Set();
  if (term) {
    const clashes = await prisma.exam.findMany({
      where: { tenantId, academicYear: year, term, classId: { in: ids } },
      select: { classId: true },
    });
    alreadyHas = new Set(clashes.map(c => c.classId));
  }
  const skipped = classes.filter(c => alreadyHas.has(c.id)).map(c => c.name);
  const toCreate = classes.filter(c => !alreadyHas.has(c.id));

  const created = await prisma.$transaction(
    toCreate.map(cls => prisma.exam.create({
      data: {
        tenantId, name, classId: cls.id,
        sectionId: null,
        academicYear: year,
        term: term || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        maxMarks: parseFloat(maxMarks) || 100,
        passingMarks: parseFloat(passingMarks) || 35,
      },
      include: { class: { select: { id: true, name: true } } },
    }))
  );

  return { created, skipped };
}

async function updateExam(tenantId, id, data) {
  const exam = await prisma.exam.findFirst({ where: { id, tenantId } });
  if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });
  const { name, term, startDate, endDate, maxMarks, passingMarks, status } = data;
  if (term !== undefined) {
    await assertTermAvailable(tenantId, exam.classId, exam.academicYear, term || null, id);
  }
  return prisma.exam.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(term !== undefined && { term: term || null }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(maxMarks !== undefined && { maxMarks: parseFloat(maxMarks) }),
      ...(passingMarks !== undefined && { passingMarks: parseFloat(passingMarks) }),
      ...(status && { status }),
    },
    include: { class: { select: { id: true, name: true } } },
  });
}

async function deleteExam(tenantId, id) {
  const exam = await prisma.exam.findFirst({ where: { id, tenantId } });
  if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });
  await prisma.exam.delete({ where: { id } });
}

// ─── Marks Entry ─────────────────────────────────────────────────────────────

async function getMarksEntry(tenantId, examId, subjectId) {
  const [exam, subject] = await Promise.all([
    prisma.exam.findFirst({ where: { id: examId, tenantId }, include: { class: true } }),
    prisma.subject.findFirst({ where: { id: subjectId, tenantId } }),
  ]);
  if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });
  if (!subject) throw Object.assign(new Error('Subject not found'), { status: 404 });

  const [students, existing] = await Promise.all([
    prisma.student.findMany({
      where: { tenantId, classId: exam.classId, status: 'ACTIVE', ...(exam.sectionId && { sectionId: exam.sectionId }) },
      orderBy: [{ class: { name: 'asc' } }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, admissionNumber: true },
    }),
    prisma.examResult.findMany({ where: { tenantId, examId, subjectId } }),
  ]);

  const resultMap = {};
  existing.forEach(r => { resultMap[r.studentId] = r; });

  return {
    exam, subject,
    entries: students.map(s => ({
      student: s,
      result: resultMap[s.id] || null,
    })),
  };
}

async function saveMarks(tenantId, examId, subjectId, records) {
  const exam = await prisma.exam.findFirst({ where: { id: examId, tenantId } });
  if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });

  // The exam being in-tenant does not vouch for the studentIds in `records` — those come
  // straight from the request body and are written into examResult rows under this tenant.
  await assertStudentsInTenant(tenantId, records.map((r) => r.studentId));

  const ops = records.map(({ studentId, marksObtained, isAbsent, remarks }) => {
    const marks = isAbsent ? null : (marksObtained !== '' && marksObtained !== null && marksObtained !== undefined ? parseFloat(marksObtained) : null);
    const grade = (marks !== null && !isAbsent) ? calculateGrade(marks, exam.maxMarks) : null;
    return prisma.examResult.upsert({
      where: { examId_studentId_subjectId: { examId, studentId, subjectId } },
      create: { tenantId, examId, studentId, subjectId, marksObtained: marks, grade, isAbsent: !!isAbsent, remarks: remarks || null },
      update: { marksObtained: marks, grade, isAbsent: !!isAbsent, remarks: remarks || null },
    });
  });

  return prisma.$transaction(ops);
}

// ─── Report Card ──────────────────────────────────────────────────────────────

async function getStudentReportCard(tenantId, studentId, academicYear) {
  const year = academicYear || currentAcademicYear();
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
    include: { class: true, section: true },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const exams = await prisma.exam.findMany({
    where: { tenantId, classId: student.classId || '', academicYear: year, status: 'COMPLETED' },
    orderBy: { startDate: 'asc' },
  });

  const results = await prisma.examResult.findMany({
    where: { tenantId, studentId, examId: { in: exams.map(e => e.id) } },
    include: { subject: { select: { id: true, name: true, code: true } } },
  });

  const examResults = {};
  exams.forEach(e => { examResults[e.id] = []; });
  results.forEach(r => { if (examResults[r.examId]) examResults[r.examId].push(r); });

  const examSummaries = exams.map(exam => {
    const examRes = examResults[exam.id];
    const present = examRes.filter(r => !r.isAbsent && r.marksObtained !== null);
    const totalMarks = present.reduce((a, r) => a + (r.marksObtained || 0), 0);
    const maxPossible = present.length * exam.maxMarks;
    const percentage = maxPossible > 0 ? Math.round((totalMarks / maxPossible) * 100) : 0;
    const overallGrade = maxPossible > 0 ? calculateGrade(totalMarks, maxPossible) : null;
    return { exam, results: examRes, totalMarks, maxPossible, percentage, overallGrade };
  });

  return { student, academicYear: year, examSummaries };
}

async function getExamSummary(tenantId, examId) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenantId },
    include: { class: true },
  });
  if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });

  const results = await prisma.examResult.findMany({
    where: { tenantId, examId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: { student: { firstName: 'asc' } },
  });

  return { exam, results };
}

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 3 ? `${y}-${String(y+1).slice(-2)}` : `${y-1}-${String(y).slice(-2)}`;
}

module.exports = {
  listSubjects, createSubject, createSubjectsBulk, updateSubject, deleteSubject,
  getTeachingGrid, setTeacherSubjects,
  listExams, createExam, createExamsBulk, updateExam, deleteExam,
  getMarksEntry, saveMarks,
  getStudentReportCard, getExamSummary,
  currentAcademicYear, calculateGrade,
};