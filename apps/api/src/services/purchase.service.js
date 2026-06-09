const prisma = require('../lib/prisma');

async function resolveStudent(tenantId, user, studentId) {
  if (user.role === 'STUDENT') {
    const s = await prisma.student.findFirst({ where: { tenantId, userId: user.id }, select: { id: true } });
    if (!s) throw Object.assign(new Error('Student profile not found'), { status: 404 });
    return s.id;
  }
  if (user.role === 'PARENT') {
    const s = await prisma.student.findFirst({
      where: { tenantId, ...(studentId ? { id: studentId } : {}), guardians: { some: { userId: user.id } } },
      select: { id: true },
    });
    if (!s) throw Object.assign(new Error('Student not found or not linked to you'), { status: 404 });
    return s.id;
  }
  if (!studentId) throw Object.assign(new Error('studentId is required'), { status: 400 });
  return studentId;
}

// ─── Store items (catalog) ────────────────────────────────────────────────────

async function listItems(tenantId, { includeInactive } = {}) {
  return prisma.storeItem.findMany({
    where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

async function createItem(tenantId, { name, category, price, description }) {
  return prisma.storeItem.create({
    data: { tenantId, name: name.trim(), category: category || 'OTHER', price: parseFloat(price), description: description || undefined },
  });
}

async function updateItem(tenantId, id, data) {
  const item = await prisma.storeItem.findFirst({ where: { id, tenantId } });
  if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });
  const { name, category, price, description, isActive } = data;
  return prisma.storeItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(category !== undefined && { category }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(description !== undefined && { description: description || null }),
      ...(isActive !== undefined && { isActive }),
    },
  });
}

async function deleteItem(tenantId, id) {
  const item = await prisma.storeItem.findFirst({ where: { id, tenantId } });
  if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });
  await prisma.storeItem.delete({ where: { id } });
}

// ─── Purchases ────────────────────────────────────────────────────────────────

async function createPurchase(tenantId, recordedById, data) {
  const { studentId, storeItemId, itemName, category, quantity, amount, purchasedAt, note } = data;
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  let name = itemName, cat = category, amt = amount;
  if (storeItemId) {
    const item = await prisma.storeItem.findFirst({ where: { id: storeItemId, tenantId } });
    if (!item) throw Object.assign(new Error('Store item not found'), { status: 404 });
    name = name || item.name;
    cat = cat || item.category;
    const qty = quantity ? parseInt(quantity) : 1;
    amt = amt != null && amt !== '' ? parseFloat(amt) : item.price * qty;
  }
  if (!name) throw Object.assign(new Error('itemName or storeItemId is required'), { status: 400 });
  if (amt == null || amt === '') throw Object.assign(new Error('amount is required'), { status: 400 });

  return prisma.purchase.create({
    data: {
      tenantId, studentId, recordedById,
      storeItemId: storeItemId || undefined,
      itemName: name, category: cat || 'OTHER',
      quantity: quantity ? parseInt(quantity) : 1,
      amount: parseFloat(amt),
      purchasedAt: purchasedAt ? new Date(purchasedAt) : new Date(),
      note: note || undefined,
    },
    include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
  });
}

async function listPurchases(tenantId, { studentId, category, classId } = {}) {
  return prisma.purchase.findMany({
    where: {
      tenantId,
      ...(studentId && { studentId }),
      ...(category && { category }),
      ...(classId && { student: { classId } }),
    },
    orderBy: { purchasedAt: 'desc' },
    include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } } } } },
  });
}

async function deletePurchase(tenantId, id) {
  const p = await prisma.purchase.findFirst({ where: { id, tenantId } });
  if (!p) throw Object.assign(new Error('Purchase not found'), { status: 404 });
  await prisma.purchase.delete({ where: { id } });
}

async function getStudentPurchases(tenantId, user, studentId) {
  const sid = await resolveStudent(tenantId, user, studentId);
  const [student, purchases] = await Promise.all([
    prisma.student.findFirst({ where: { id: sid, tenantId }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } }),
    prisma.purchase.findMany({ where: { tenantId, studentId: sid }, orderBy: { purchasedAt: 'desc' } }),
  ]);
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  const total = purchases.reduce((a, p) => a + p.amount, 0);
  return { student, purchases, total };
}

// Who hasn't bought a given category yet (e.g. uniform). class filter optional.
async function notPurchasedReport(tenantId, { category, classId } = {}) {
  if (!category) throw Object.assign(new Error('category is required'), { status: 400 });
  const students = await prisma.student.findMany({
    where: { tenantId, status: 'ACTIVE', ...(classId && { classId }) },
    select: {
      id: true, firstName: true, lastName: true, admissionNumber: true,
      class: { select: { name: true } }, section: { select: { name: true } },
      purchases: { where: { category }, select: { id: true } },
    },
    orderBy: [{ class: { name: 'asc' } }, { firstName: 'asc' }],
  });
  const missing = students.filter((s) => s.purchases.length === 0)
    .map(({ purchases, ...s }) => s);
  return { category, total: students.length, missing, missingCount: missing.length };
}

module.exports = {
  listItems, createItem, updateItem, deleteItem,
  createPurchase, listPurchases, deletePurchase, getStudentPurchases, notPurchasedReport,
};
