const prisma = require('../lib/prisma');

async function listLmsSubjects(tenantId, filters = {}) {
  const { classId, teacherId, search } = filters;

  const where = {
    tenantId,
    ...(classId && { classId }),
    ...(teacherId && { teacherId }),
    ...(search && {
      name: { contains: search, mode: 'insensitive' },
    }),
  };

  return prisma.subject.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      class: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { lmsMaterials: true } },
    },
  });
}

async function getSubjectMaterials(tenantId, subjectId) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, tenantId },
  });
  if (!subject) throw Object.assign(new Error('Subject not found'), { status: 404 });

  return prisma.lmsMaterial.findMany({
    where: { tenantId, subjectId },
    orderBy: { sequence: 'asc' },
  });
}

async function createMaterial(tenantId, subjectId, data) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, tenantId },
  });
  if (!subject) throw Object.assign(new Error('Subject not found'), { status: 404 });

  const { title, description, sequence, attachmentUrl, educationalLinks } = data;

  return prisma.lmsMaterial.create({
    data: {
      tenantId,
      subjectId,
      title: title.trim(),
      description: description ? description.trim() : null,
      sequence: sequence !== undefined ? parseInt(sequence) : 0,
      attachmentUrl: attachmentUrl ? attachmentUrl.trim() : null,
      educationalLinks: educationalLinks || null,
    },
  });
}

async function updateMaterial(tenantId, id, data) {
  const material = await prisma.lmsMaterial.findFirst({
    where: { id, tenantId },
  });
  if (!material) throw Object.assign(new Error('Material not found'), { status: 404 });

  const { title, description, sequence, attachmentUrl, educationalLinks } = data;

  return prisma.lmsMaterial.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description ? description.trim() : null }),
      ...(sequence !== undefined && { sequence: parseInt(sequence) }),
      ...(attachmentUrl !== undefined && { attachmentUrl: attachmentUrl ? attachmentUrl.trim() : null }),
      ...(educationalLinks !== undefined && { educationalLinks: educationalLinks || null }),
    },
  });
}

async function deleteMaterial(tenantId, id) {
  const material = await prisma.lmsMaterial.findFirst({
    where: { id, tenantId },
  });
  if (!material) throw Object.assign(new Error('Material not found'), { status: 404 });

  await prisma.lmsMaterial.delete({
    where: { id },
  });
  return { success: true };
}

module.exports = {
  listLmsSubjects,
  getSubjectMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
};
