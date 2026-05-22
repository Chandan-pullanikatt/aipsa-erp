const prisma = require('../lib/prisma');

async function createHomework(tenantId, teacherId, { classId, subjectId, title, description, dueDate, attachmentUrl }) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.homework.create({
    data: {
      tenantId, teacherId, classId,
      subjectId: subjectId || null,
      title: title.trim(),
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      attachmentUrl: attachmentUrl || null,
    },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

async function listHomework(tenantId, { teacherId, classId, page = 1, limit = 20 } = {}) {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {
    tenantId,
    ...(teacherId && { teacherId }),
    ...(classId && { classId }),
  };
  const [items, total] = await prisma.$transaction([
    prisma.homework.findMany({
      where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.homework.count({ where }),
  ]);
  return { items, total };
}

async function updateHomework(tenantId, id, teacherId, data) {
  const hw = await prisma.homework.findFirst({ where: { id, tenantId } });
  if (!hw) throw Object.assign(new Error('Homework not found'), { status: 404 });
  if (hw.teacherId !== teacherId) throw Object.assign(new Error('Not authorized'), { status: 403 });
  const { title, description, dueDate, attachmentUrl } = data;
  return prisma.homework.update({
    where: { id },
    data: {
      ...(title && { title: title.trim() }),
      ...(description !== undefined && { description: description || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(attachmentUrl !== undefined && { attachmentUrl: attachmentUrl || null }),
    },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  });
}

async function deleteHomework(tenantId, id, userId, userRole) {
  const hw = await prisma.homework.findFirst({ where: { id, tenantId } });
  if (!hw) throw Object.assign(new Error('Homework not found'), { status: 404 });
  if (hw.teacherId !== userId && userRole !== 'SCHOOL_ADMIN') throw Object.assign(new Error('Not authorized'), { status: 403 });
  await prisma.homework.delete({ where: { id } });
}

// Returns distinct classes a teacher is assigned to via subjects or timetable periods
async function getTeacherClasses(tenantId, teacherId) {
  const [subjectClasses, periodClasses] = await Promise.all([
    prisma.subject.findMany({
      where: { tenantId, teacherId },
      select: { class: { select: { id: true, name: true } } },
    }),
    prisma.period.findMany({
      where: { tenantId, teacherId },
      select: { class: { select: { id: true, name: true } } },
      distinct: ['classId'],
    }),
  ]);
  const all = [...subjectClasses.map(s => s.class), ...periodClasses.map(p => p.class)];
  const seen = new Set();
  return all.filter(c => seen.has(c.id) ? false : seen.add(c.id));
}

async function submitHomework(tenantId, homeworkId, studentId, { note, attachmentUrl }) {
  const hw = await prisma.homework.findFirst({ where: { id: homeworkId, tenantId } });
  if (!hw) throw Object.assign(new Error('Homework not found'), { status: 404 });

  return prisma.homeworkSubmission.upsert({
    where: { homeworkId_studentId: { homeworkId, studentId } },
    update: {
      note: note || null,
      attachmentUrl: attachmentUrl || null,
      submittedAt: new Date(),
      grade: null,
      feedback: null,
      gradedAt: null,
      gradedById: null,
    },
    create: {
      tenantId,
      homeworkId,
      studentId,
      note: note || null,
      attachmentUrl: attachmentUrl || null,
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
  });
}

async function getSubmissions(tenantId, homeworkId) {
  const hw = await prisma.homework.findFirst({ where: { id: homeworkId, tenantId } });
  if (!hw) throw Object.assign(new Error('Homework not found'), { status: 404 });

  return prisma.homeworkSubmission.findMany({
    where: { tenantId, homeworkId },
    orderBy: { submittedAt: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      gradedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

async function gradeSubmission(tenantId, submissionId, gradedById, { grade, feedback }) {
  const sub = await prisma.homeworkSubmission.findFirst({ where: { id: submissionId, tenantId } });
  if (!sub) throw Object.assign(new Error('Submission not found'), { status: 404 });

  return prisma.homeworkSubmission.update({
    where: { id: submissionId },
    data: { grade: grade || null, feedback: feedback || null, gradedAt: new Date(), gradedById },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
  });
}

async function getMySubmission(tenantId, homeworkId, studentId) {
  return prisma.homeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId } },
  });
}

module.exports = { createHomework, listHomework, updateHomework, deleteHomework, getTeacherClasses, submitHomework, getSubmissions, gradeSubmission, getMySubmission };