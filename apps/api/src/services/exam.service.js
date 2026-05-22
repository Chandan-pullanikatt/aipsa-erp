const prisma = require('../lib/prisma');

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

async function listSubjects(tenantId, { classId } = {}) {
  return prisma.subject.findMany({
    where: { tenantId, ...(classId && { classId }) },
    orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
    include: {
      class: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

async function createSubject(tenantId, { classId, name, code, teacherId }) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.subject.create({
    data: { tenantId, classId, name: name.trim(), code: code || null, teacherId: teacherId || null },
    include: { class: { select: { id: true, name: true } }, teacher: { select: { id: true, firstName: true, lastName: true } } },
  });
}

async function updateSubject(tenantId, id, data) {
  const s = await prisma.subject.findFirst({ where: { id, tenantId } });
  if (!s) throw Object.assign(new Error('Subject not found'), { status: 404 });
  return prisma.subject.update({
    where: { id },
    data: { name: data.name?.trim() || s.name, code: data.code ?? s.code, teacherId: data.teacherId ?? s.teacherId },
    include: { class: { select: { id: true, name: true } }, teacher: { select: { id: true, firstName: true, lastName: true } } },
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

async function createExam(tenantId, data) {
  const { name, classId, sectionId, academicYear, startDate, endDate, maxMarks, passingMarks } = data;
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.exam.create({
    data: {
      tenantId, name, classId,
      sectionId: sectionId || null,
      academicYear: academicYear || currentAcademicYear(),
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      maxMarks: parseFloat(maxMarks) || 100,
      passingMarks: parseFloat(passingMarks) || 35,
    },
    include: { class: { select: { id: true, name: true } } },
  });
}

async function updateExam(tenantId, id, data) {
  const exam = await prisma.exam.findFirst({ where: { id, tenantId } });
  if (!exam) throw Object.assign(new Error('Exam not found'), { status: 404 });
  const { name, startDate, endDate, maxMarks, passingMarks, status } = data;
  return prisma.exam.update({
    where: { id },
    data: {
      ...(name && { name }),
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

  const resultMap: Record<string, any> = {};
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

  const examResults: Record<string, any[]> = {};
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
  listSubjects, createSubject, updateSubject, deleteSubject,
  listExams, createExam, updateExam, deleteExam,
  getMarksEntry, saveMarks,
  getStudentReportCard, getExamSummary,
  currentAcademicYear,
};