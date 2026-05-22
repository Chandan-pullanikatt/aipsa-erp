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

module.exports = { createHomework, listHomework, updateHomework, deleteHomework, getTeacherClasses };