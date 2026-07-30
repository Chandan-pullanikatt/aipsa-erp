const prisma = require('../lib/prisma');

async function listLmsSubjects(tenantId, filters = {}) {
  const { classId, teacherId, search } = filters;

  const where = {
    tenantId,
    ...(classId && { classId }),
    // A teacher's subjects are the ones they own plus any they co-teach or teach
    // for a single section.
    ...(teacherId && {
      OR: [{ teacherId }, { teachers: { some: { teacherId } } }],
    }),
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
      teachers: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
          section: { select: { id: true, name: true } },
        },
      },
      _count: { select: { lmsMaterials: true } },
    },
  });
}

async function getSubjectMaterials(tenantId, subjectId, userId, isPremiumStudent = false) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, tenantId },
  });
  if (!subject) throw Object.assign(new Error('Subject not found'), { status: 404 });

  const allMaterials = await prisma.lmsMaterial.findMany({
    where: { tenantId, subjectId },
    orderBy: { sequence: 'asc' },
  });

  // For students/parents: hide premium video content unless they've paid
  const materials = allMaterials.map(m => {
    if (m.isPremium && !isPremiumStudent) {
      // Return stub — title/description visible to entice upgrade, url hidden
      return {
        ...m,
        attachmentUrl: null,
        educationalLinks: null,
        locked: true,
      };
    }
    return { ...m, locked: false };
  });

  if (!userId) return materials;

  const progressRecords = await prisma.lmsMaterialProgress.findMany({
    where: { tenantId, userId, materialId: { in: materials.map(m => m.id) } },
    select: { materialId: true },
  });
  const completedIds = new Set(progressRecords.map(p => p.materialId));

  return materials.map(m => ({ ...m, completed: completedIds.has(m.id) }));
}

async function toggleMaterialProgress(tenantId, materialId, userId) {
  const material = await prisma.lmsMaterial.findFirst({
    where: { id: materialId, tenantId },
  });
  if (!material) throw Object.assign(new Error('Material not found'), { status: 404 });

  const existing = await prisma.lmsMaterialProgress.findUnique({
    where: { materialId_userId: { materialId, userId } },
  });

  if (existing) {
    await prisma.lmsMaterialProgress.delete({ where: { materialId_userId: { materialId, userId } } });
    return { completed: false };
  } else {
    await prisma.lmsMaterialProgress.create({ data: { tenantId, materialId, userId } });
    return { completed: true };
  }
}

async function getSubjectProgress(tenantId, subjectId, userId) {
  const [total, completed] = await Promise.all([
    prisma.lmsMaterial.count({ where: { tenantId, subjectId } }),
    prisma.lmsMaterialProgress.count({
      where: {
        tenantId,
        userId,
        material: { subjectId },
      },
    }),
  ]);
  return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

async function createMaterial(tenantId, subjectId, data) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, tenantId },
  });
  if (!subject) throw Object.assign(new Error('Subject not found'), { status: 404 });

  const { title, description, sequence, attachmentUrl, educationalLinks, isPremium, isFreePreview } = data;

  return prisma.lmsMaterial.create({
    data: {
      tenantId,
      subjectId,
      title: title.trim(),
      description: description ? description.trim() : null,
      sequence: sequence !== undefined ? parseInt(sequence) : 0,
      attachmentUrl: attachmentUrl ? attachmentUrl.trim() : null,
      educationalLinks: educationalLinks || null,
      isPremium: isPremium === true || isPremium === 'true',
      isFreePreview: isFreePreview === true || isFreePreview === 'true',
    },
  });
}

async function updateMaterial(tenantId, id, data) {
  const material = await prisma.lmsMaterial.findFirst({
    where: { id, tenantId },
  });
  if (!material) throw Object.assign(new Error('Material not found'), { status: 404 });

  const { title, description, sequence, attachmentUrl, educationalLinks, isPremium, isFreePreview } = data;

  return prisma.lmsMaterial.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description ? description.trim() : null }),
      ...(sequence !== undefined && { sequence: parseInt(sequence) }),
      ...(attachmentUrl !== undefined && { attachmentUrl: attachmentUrl ? attachmentUrl.trim() : null }),
      ...(educationalLinks !== undefined && { educationalLinks: educationalLinks || null }),
      ...(isPremium !== undefined && { isPremium: isPremium === true || isPremium === 'true' }),
      ...(isFreePreview !== undefined && { isFreePreview: isFreePreview === true || isFreePreview === 'true' }),
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
  toggleMaterialProgress,
  getSubjectProgress,
};
