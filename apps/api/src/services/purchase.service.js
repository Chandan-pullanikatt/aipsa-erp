const prisma = require('../lib/prisma');
const razorpay = require('../lib/razorpay');

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

async function createItem(tenantId, { name, category, price, description, imageUrl, stock }) {
  return prisma.storeItem.create({
    data: {
      tenantId, name: name.trim(), category: category || 'OTHER', price: parseFloat(price),
      description: description || undefined, imageUrl: imageUrl || undefined,
      stock: stock != null && stock !== '' ? parseInt(stock) : null,
    },
  });
}

async function updateItem(tenantId, id, data) {
  const item = await prisma.storeItem.findFirst({ where: { id, tenantId } });
  if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });
  const { name, category, price, description, isActive, imageUrl, stock } = data;
  return prisma.storeItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(category !== undefined && { category }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(description !== undefined && { description: description || null }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
      ...(stock !== undefined && { stock: stock === '' || stock === null ? null : parseInt(stock) }),
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

// ─── Online checkout (student / parent self-purchase) ───────────────────────────
// The admin-recorded createPurchase() flow above is unchanged. This adds a paid
// online path: create a Razorpay order + a PENDING purchase, then confirm and
// decrement stock after signature verification.

async function initiateCheckout(tenantId, user, { storeItemId, quantity, studentId }) {
  const sid = await resolveStudent(tenantId, user, studentId);
  const item = await prisma.storeItem.findFirst({ where: { id: storeItemId, tenantId, isActive: true } });
  if (!item) throw Object.assign(new Error('Store item not found'), { status: 404 });

  const qty = quantity ? parseInt(quantity) : 1;
  if (qty < 1) throw Object.assign(new Error('Quantity must be at least 1'), { status: 400 });
  if (item.stock != null && item.stock < qty) throw Object.assign(new Error('Not enough stock available'), { status: 400 });

  const amount = item.price * qty;
  const order = await razorpay.createOrder(amount, `store_${item.id}_${Date.now()}`);
  const purchase = await prisma.purchase.create({
    data: {
      tenantId, studentId: sid, recordedById: user.id,
      storeItemId: item.id, itemName: item.name, category: item.category,
      quantity: qty, amount, paymentStatus: 'PENDING', razorpayOrderId: order.id,
    },
  });
  return {
    purchase,
    payment: { orderId: order.id, amount: order.amount, currency: 'INR', keyId: razorpay.keyId() },
  };
}

async function verifyOnlinePayment(tenantId, body) {
  if (!razorpay.verifySignature(body)) throw Object.assign(new Error('Payment verification failed: invalid signature'), { status: 400 });
  const purchase = await prisma.purchase.findUnique({ where: { razorpayOrderId: body.razorpay_order_id } });
  if (!purchase) throw Object.assign(new Error('Purchase not found for this order'), { status: 404 });
  if (purchase.tenantId !== tenantId) throw Object.assign(new Error('Order does not belong to this account'), { status: 403 });
  if (purchase.paymentStatus === 'PAID') return { success: true, purchase }; // idempotent

  // Confirm payment and decrement stock atomically.
  const updated = await prisma.$transaction(async (tx) => {
    if (purchase.storeItemId) {
      const item = await tx.storeItem.findUnique({ where: { id: purchase.storeItemId } });
      if (item?.stock != null) {
        await tx.storeItem.update({
          where: { id: item.id },
          data: { stock: Math.max(0, item.stock - purchase.quantity) },
        });
      }
    }
    return tx.purchase.update({
      where: { id: purchase.id },
      data: { paymentStatus: 'PAID', razorpayPaymentId: body.razorpay_payment_id, purchasedAt: new Date() },
    });
  });
  return { success: true, purchase: updated };
}

module.exports = {
  listItems, createItem, updateItem, deleteItem,
  createPurchase, listPurchases, deletePurchase, getStudentPurchases, notPurchasedReport,
  initiateCheckout, verifyOnlinePayment,
};
