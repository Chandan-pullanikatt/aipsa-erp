const prisma = require('../lib/prisma');
const { calculateGrade, currentAcademicYear } = require('./exam.service');

const TERMS = ['TERM_1', 'TERM_2', 'ANNUAL'];
const CCA_GRADES = ['A', 'B', 'C'];
// Fixed conduct/personal-quality traits, graded A/B/C by the class teacher.
const CONDUCT_TRAITS = ['discipline', 'punctuality', 'neatness', 'teamwork'];

const TEACHER_SELECT = { select: { id: true, firstName: true, lastName: true } };
function teacherName(t) { return t ? `${t.firstName} ${t.lastName}` : null; }

function isPrivileged(role) { return role === 'SCHOOL_ADMIN'; }

// ─── CCA areas (admin config) ────────────────────────────────────────────────

async function listCcaAreas(tenantId, { classId } = {}) {
  return prisma.ccaArea.findMany({
    where: { tenantId, ...(classId && { classId }) },
    orderBy: [{ class: { name: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { class: { select: { id: true, name: true } }, teacher: TEACHER_SELECT },
  });
}

async function createCcaArea(tenantId, { classId, name, teacherId, sortOrder }) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.ccaArea.create({
    data: { tenantId, classId, name: name.trim(), teacherId: teacherId || null, sortOrder: Number(sortOrder) || 0 },
    include: { class: { select: { id: true, name: true } }, teacher: TEACHER_SELECT },
  });
}

async function updateCcaArea(tenantId, id, data) {
  const area = await prisma.ccaArea.findFirst({ where: { id, tenantId } });
  if (!area) throw Object.assign(new Error('CCA area not found'), { status: 404 });
  return prisma.ccaArea.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.teacherId !== undefined && { teacherId: data.teacherId || null }),
      ...(data.sortOrder !== undefined && { sortOrder: Number(data.sortOrder) || 0 }),
    },
    include: { class: { select: { id: true, name: true } }, teacher: TEACHER_SELECT },
  });
}

async function deleteCcaArea(tenantId, id) {
  const area = await prisma.ccaArea.findFirst({ where: { id, tenantId } });
  if (!area) throw Object.assign(new Error('CCA area not found'), { status: 404 });
  await prisma.ccaArea.delete({ where: { id } }); // grades cascade
}

// ─── CCA grading (CCA teacher / admin) ───────────────────────────────────────

function assertTerm(term) {
  if (!TERMS.includes(term)) throw Object.assign(new Error('Invalid term'), { status: 422 });
}

// Returns the grid of {areas × students} a CCA teacher may grade for a class+term.
// Admins see all areas; teachers see only areas assigned to them.
async function getCcaEntry(tenantId, user, { classId, term }) {
  assertTerm(term);
  const where = { tenantId, classId, ...(isPrivileged(user.role) ? {} : { teacherId: user.id }) };
  const areas = await prisma.ccaArea.findMany({
    where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { teacher: TEACHER_SELECT },
  });
  const students = await prisma.student.findMany({
    where: { tenantId, classId, status: 'ACTIVE' },
    orderBy: { firstName: 'asc' },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
  });
  const grades = await prisma.ccaGrade.findMany({
    where: { tenantId, term, ccaAreaId: { in: areas.map(a => a.id) } },
  });
  // grid[areaId][studentId] = grade
  const grid = {};
  grades.forEach(g => { (grid[g.ccaAreaId] ||= {})[g.studentId] = g.grade; });
  return { classId, term, areas, students, grid };
}

async function saveCcaGrades(tenantId, user, { term, records }) {
  assertTerm(term);
  // Authorize each touched area once.
  const areaIds = [...new Set(records.map(r => r.ccaAreaId))];
  const areas = await prisma.ccaArea.findMany({ where: { id: { in: areaIds }, tenantId } });
  const areaMap = Object.fromEntries(areas.map(a => [a.id, a]));
  for (const id of areaIds) {
    const area = areaMap[id];
    if (!area) throw Object.assign(new Error('CCA area not found'), { status: 404 });
    if (!isPrivileged(user.role) && area.teacherId !== user.id) {
      throw Object.assign(new Error('You are not assigned to this CCA area'), { status: 403 });
    }
  }
  const ops = records
    .filter(r => CCA_GRADES.includes(r.grade) || r.grade === '' || r.grade == null)
    .map(({ ccaAreaId, studentId, grade }) => {
      if (grade === '' || grade == null) {
        return prisma.ccaGrade.deleteMany({ where: { ccaAreaId, studentId, term } });
      }
      return prisma.ccaGrade.upsert({
        where: { ccaAreaId_studentId_term: { ccaAreaId, studentId, term } },
        create: { tenantId, ccaAreaId, studentId, term, grade },
        update: { grade },
      });
    });
  await prisma.$transaction(ops);
  return { saved: ops.length };
}

// ─── Progress term: conduct / achievements / remark / publish (class teacher) ─

async function assertIncharge(tenantId, classId, user) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  if (!isPrivileged(user.role) && cls.inchargeTeacherId !== user.id) {
    throw Object.assign(new Error('Only the class teacher can manage this class\'s progress cards'), { status: 403 });
  }
  return cls;
}

async function getProgressEntry(tenantId, user, { classId, term, academicYear }) {
  assertTerm(term);
  await assertIncharge(tenantId, classId, user);
  const year = academicYear || currentAcademicYear();
  const students = await prisma.student.findMany({
    where: { tenantId, classId, status: 'ACTIVE' },
    orderBy: { firstName: 'asc' },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
  });
  const terms = await prisma.progressTerm.findMany({
    where: { tenantId, term, academicYear: year, studentId: { in: students.map(s => s.id) } },
  });
  const byStudent = Object.fromEntries(terms.map(t => [t.studentId, t]));
  return {
    classId, term, academicYear: year, conductTraits: CONDUCT_TRAITS,
    students: students.map(s => ({ student: s, progress: byStudent[s.id] || null })),
  };
}

async function saveProgressTerm(tenantId, user, { studentId, term, academicYear, conduct, achievements, remark }) {
  assertTerm(term);
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  await assertIncharge(tenantId, student.classId, user);
  const year = academicYear || currentAcademicYear();
  const existing = await prisma.progressTerm.findUnique({
    where: { studentId_term_academicYear: { studentId, term, academicYear: year } },
  });
  if (existing && existing.status === 'PUBLISHED') {
    throw Object.assign(new Error('Unpublish before editing this term\'s card'), { status: 409 });
  }
  return prisma.progressTerm.upsert({
    where: { studentId_term_academicYear: { studentId, term, academicYear: year } },
    create: { tenantId, studentId, term, academicYear: year, conduct: conduct ?? null, achievements: achievements ?? null, remark: remark ?? null },
    update: { conduct: conduct ?? null, achievements: achievements ?? null, remark: remark ?? null },
  });
}

// Build the faculty list frozen onto a published card.
async function buildFacultySnapshot(tenantId, classId) {
  const [cls, subjects] = await Promise.all([
    prisma.class.findFirst({ where: { id: classId, tenantId }, include: { inchargeTeacher: TEACHER_SELECT } }),
    prisma.subject.findMany({ where: { tenantId, classId }, orderBy: { name: 'asc' }, include: { teacher: TEACHER_SELECT } }),
  ]);
  return {
    classTeacher: teacherName(cls?.inchargeTeacher),
    subjects: subjects.map(s => ({ subject: s.name, teacher: teacherName(s.teacher) })),
    frozenAt: new Date().toISOString(),
  };
}

async function publishProgressTerm(tenantId, user, { studentId, term, academicYear }) {
  assertTerm(term);
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  await assertIncharge(tenantId, student.classId, user);
  const year = academicYear || currentAcademicYear();
  const snapshot = await buildFacultySnapshot(tenantId, student.classId);
  return prisma.progressTerm.upsert({
    where: { studentId_term_academicYear: { studentId, term, academicYear: year } },
    create: { tenantId, studentId, term, academicYear: year, status: 'PUBLISHED', publishedAt: new Date(), publishedById: user.id, facultySnapshot: snapshot },
    update: { status: 'PUBLISHED', publishedAt: new Date(), publishedById: user.id, facultySnapshot: snapshot },
  });
}

async function unpublishProgressTerm(tenantId, user, { studentId, term, academicYear }) {
  assertTerm(term);
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  await assertIncharge(tenantId, student.classId, user);
  const year = academicYear || currentAcademicYear();
  const existing = await prisma.progressTerm.findUnique({
    where: { studentId_term_academicYear: { studentId, term, academicYear: year } },
  });
  if (!existing) throw Object.assign(new Error('Nothing to unpublish'), { status: 404 });
  return prisma.progressTerm.update({
    where: { id: existing.id },
    data: { status: 'DRAFT', publishedAt: null },
  });
}

// ─── Holistic card assembly ──────────────────────────────────────────────────

// viewer STUDENT/PARENT see only PUBLISHED terms; admin/teacher preview everything.
async function getHolisticCard(tenantId, studentId, academicYear, viewerRole) {
  const year = academicYear || currentAcademicYear();
  const gated = viewerRole === 'STUDENT' || viewerRole === 'PARENT';

  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
    include: {
      class: { select: { id: true, name: true, inchargeTeacher: TEACHER_SELECT } },
      section: { select: { id: true, name: true } },
    },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  const classId = student.classId || '';

  const [subjects, termExams, ccaAreas, progressTerms] = await Promise.all([
    prisma.subject.findMany({ where: { tenantId, classId }, orderBy: { name: 'asc' }, include: { teacher: TEACHER_SELECT } }),
    prisma.exam.findMany({ where: { tenantId, classId, academicYear: year, term: { not: null } } }),
    prisma.ccaArea.findMany({ where: { tenantId, classId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.progressTerm.findMany({ where: { tenantId, studentId, academicYear: year } }),
  ]);

  const examByTerm = {};
  termExams.forEach(e => { examByTerm[e.term] = e; });
  const progressByTerm = Object.fromEntries(progressTerms.map(p => [p.term, p]));

  // Which terms are visible to this viewer.
  const publishedTerms = new Set(progressTerms.filter(p => p.status === 'PUBLISHED').map(p => p.term));
  const visibleTerms = TERMS.filter(t => !gated || publishedTerms.has(t));

  const examIds = visibleTerms.map(t => examByTerm[t]?.id).filter(Boolean);
  const results = examIds.length
    ? await prisma.examResult.findMany({ where: { tenantId, studentId, examId: { in: examIds } } })
    : [];
  // resultMap[examId][subjectId]
  const resultMap = {};
  results.forEach(r => { (resultMap[r.examId] ||= {})[r.subjectId] = r; });

  const ccaGrades = (ccaAreas.length && visibleTerms.length)
    ? await prisma.ccaGrade.findMany({ where: { tenantId, studentId, term: { in: visibleTerms }, ccaAreaId: { in: ccaAreas.map(a => a.id) } } })
    : [];
  const ccaMap = {};
  ccaGrades.forEach(g => { (ccaMap[g.ccaAreaId] ||= {})[g.term] = g.grade; });

  // Per-term metadata + scholastic totals.
  const termsOut = TERMS.map(t => {
    const p = progressByTerm[t];
    const published = !!p && p.status === 'PUBLISHED';
    const visible = !gated || published;
    const exam = examByTerm[t] || null;
    return {
      term: t,
      published,
      visible,
      publishedAt: published ? p.publishedAt : null,
      exam: visible && exam ? { id: exam.id, name: exam.name, maxMarks: exam.maxMarks, passingMarks: exam.passingMarks } : null,
      conduct: visible && p ? p.conduct : null,
      achievements: visible && p ? p.achievements : null,
      remark: visible && p ? p.remark : null,
      facultySnapshot: visible && p ? p.facultySnapshot : null,
    };
  });

  const subjectsOut = subjects.map(s => {
    const marks = {};
    TERMS.forEach(t => {
      const exam = examByTerm[t];
      const r = exam && visibleTerms.includes(t) ? resultMap[exam.id]?.[s.id] : null;
      marks[t] = r ? {
        obtained: r.marksObtained,
        max: exam.maxMarks,
        grade: r.grade,
        isAbsent: r.isAbsent,
      } : null;
    });
    return { id: s.id, name: s.name, code: s.code, teacher: teacherName(s.teacher), marks };
  });

  const ccaOut = ccaAreas.map(a => {
    const grades = {};
    TERMS.forEach(t => { grades[t] = visibleTerms.includes(t) ? (ccaMap[a.id]?.[t] || null) : null; });
    return { id: a.id, name: a.name, grades };
  });

  // Cumulative across the visible term exams.
  let totalObtained = 0, totalMax = 0;
  visibleTerms.forEach(t => {
    const exam = examByTerm[t];
    if (!exam) return;
    subjects.forEach(s => {
      const r = resultMap[exam.id]?.[s.id];
      if (r && !r.isAbsent && r.marksObtained != null) { totalObtained += r.marksObtained; totalMax += exam.maxMarks; }
    });
  });
  const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;
  const cumulative = totalMax > 0 ? {
    totalObtained, totalMax, percentage,
    grade: calculateGrade(totalObtained, totalMax),
    result: percentage >= 33 ? 'PROMOTED' : 'NEEDS IMPROVEMENT',
  } : null;

  // Faculty block: prefer the latest published snapshot, else live.
  const latestSnapshot = [...TERMS].reverse().map(t => progressByTerm[t]).find(p => p && p.status === 'PUBLISHED' && p.facultySnapshot)?.facultySnapshot;
  const faculty = latestSnapshot || {
    classTeacher: teacherName(student.class?.inchargeTeacher),
    subjects: subjects.map(s => ({ subject: s.name, teacher: teacherName(s.teacher) })),
    frozenAt: null,
  };

  return {
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      admissionNumber: student.admissionNumber,
      photoUrl: student.photoUrl,
      class: student.class?.name || null,
      section: student.section?.name || null,
      dateOfBirth: student.dateOfBirth,
    },
    academicYear: year,
    conductTraits: CONDUCT_TRAITS,
    anyPublished: publishedTerms.size > 0,
    classTeacher: faculty.classTeacher,
    faculty,
    terms: termsOut,
    subjects: subjectsOut,
    cca: ccaOut,
    cumulative,
  };
}

// ─── Live faculty list ("My Teachers") ───────────────────────────────────────

async function getMyTeachers(tenantId, studentId) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
    include: {
      class: { select: { id: true, name: true, inchargeTeacher: TEACHER_SELECT } },
      section: { select: { id: true, name: true } },
    },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  const subjects = await prisma.subject.findMany({
    where: { tenantId, classId: student.classId || '' },
    orderBy: { name: 'asc' },
    include: { teacher: TEACHER_SELECT },
  });
  return {
    student: { id: student.id, name: `${student.firstName} ${student.lastName}`, class: student.class?.name || null, section: student.section?.name || null },
    classTeacher: student.class?.inchargeTeacher
      ? { id: student.class.inchargeTeacher.id, name: teacherName(student.class.inchargeTeacher) }
      : null,
    subjects: subjects.map(s => ({
      id: s.id, name: s.name, code: s.code,
      teacher: s.teacher ? { id: s.teacher.id, name: teacherName(s.teacher) } : null,
    })),
  };
}

module.exports = {
  TERMS, CCA_GRADES, CONDUCT_TRAITS,
  listCcaAreas, createCcaArea, updateCcaArea, deleteCcaArea,
  getCcaEntry, saveCcaGrades,
  getProgressEntry, saveProgressTerm, publishProgressTerm, unpublishProgressTerm,
  getHolisticCard, getMyTeachers,
};
