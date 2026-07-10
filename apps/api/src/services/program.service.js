// Programs & Registrations — the generic engine behind competitions, olympiads,
// arts-festival items, 1-to-1 tuition, teacher/leadership training, counseling,
// general events and the conclave. Adding a new offering = inserting a Program
// row. See docs/NEW-MODULES-ARCHITECTURE.md.
//
// Payment reuses the shared one-time Razorpay order + HMAC-verify flow
// (lib/razorpay). Free programs skip Razorpay entirely and confirm immediately.
const prisma = require('../lib/prisma');
const razorpay = require('../lib/razorpay');
const notify = require('./notify.service');

const err = (status, message) => Object.assign(new Error(message), { status });

// A program is visible to a tenant if it's that tenant's own OR AIPSA-global
// (tenantId null). This is the catalog scope every read uses.
const visibleWhere = (tenantId) => ({ OR: [{ tenantId }, { tenantId: null }] });

const PROGRAM_INCLUDE = {
  items: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
};

// ─── Catalog: read ──────────────────────────────────────────────────────────────

async function listPrograms(tenantId, { type, includeInactive } = {}) {
  return prisma.program.findMany({
    where: {
      ...visibleWhere(tenantId),
      ...(type ? { type } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: PROGRAM_INCLUDE,
    orderBy: [{ createdAt: 'desc' }],
  });
}

async function getProgram(tenantId, id) {
  const program = await prisma.program.findFirst({
    where: { id, ...visibleWhere(tenantId) },
    include: PROGRAM_INCLUDE,
  });
  if (!program) throw err(404, 'Program not found.');
  return program;
}

// ─── Catalog: write (admin) ───────────────────────────────────────────────────
// isGlobal writes are gated to SUPER_ADMIN at the route layer: a SCHOOL_ADMIN can
// only create/edit programs scoped to their own tenant.

const PROGRAM_FIELDS = [
  'type', 'category', 'title', 'description', 'bannerUrl', 'fee', 'audience',
  'capacity', 'opensAt', 'closesAt', 'requiresTeacherMatch', 'isActive', 'metadata',
];

function pickProgramData(body) {
  const data = {};
  for (const k of PROGRAM_FIELDS) if (body[k] !== undefined) data[k] = body[k];
  if (data.fee !== undefined) data.fee = Number(data.fee) || 0;
  if (data.capacity !== undefined && data.capacity !== null) data.capacity = Number(data.capacity);
  if (data.opensAt) data.opensAt = new Date(data.opensAt);
  if (data.closesAt) data.closesAt = new Date(data.closesAt);
  return data;
}

async function createProgram(tenantId, body, { isGlobal = false } = {}) {
  if (!body.title) throw err(422, 'Title is required.');
  if (!body.type) throw err(422, 'Type is required.');
  const data = pickProgramData(body);
  const program = await prisma.program.create({
    data: {
      ...data,
      tenantId: isGlobal ? null : tenantId, // global programs are cross-school
      items: Array.isArray(body.items) && body.items.length
        ? { create: body.items.map((i) => ({ name: i.name, fee: i.fee != null ? Number(i.fee) : null })) }
        : undefined,
    },
    include: PROGRAM_INCLUDE,
  });
  return program;
}

// Guard writes: a program owned by tenant X (or global, for SUPER_ADMIN) only.
async function assertWritable(tenantId, id, { isSuperAdmin = false } = {}) {
  const program = await prisma.program.findUnique({ where: { id } });
  if (!program) throw err(404, 'Program not found.');
  if (program.tenantId === null && !isSuperAdmin) throw err(403, 'Only AIPSA admins can edit global programs.');
  if (program.tenantId !== null && program.tenantId !== tenantId) throw err(403, 'Program belongs to another school.');
  return program;
}

async function updateProgram(tenantId, id, body, opts = {}) {
  await assertWritable(tenantId, id, opts);
  return prisma.program.update({ where: { id }, data: pickProgramData(body), include: PROGRAM_INCLUDE });
}

async function deleteProgram(tenantId, id, opts = {}) {
  await assertWritable(tenantId, id, opts);
  await prisma.program.delete({ where: { id } });
}

// ─── Program items ────────────────────────────────────────────────────────────

async function addItem(tenantId, programId, body, opts = {}) {
  await assertWritable(tenantId, programId, opts);
  if (!body.name) throw err(422, 'Item name is required.');
  return prisma.programItem.create({
    data: { programId, name: body.name, fee: body.fee != null ? Number(body.fee) : null },
  });
}

async function deleteItem(tenantId, programId, itemId, opts = {}) {
  await assertWritable(tenantId, programId, opts);
  await prisma.programItem.delete({ where: { id: itemId } });
}

// ─── Registration ──────────────────────────────────────────────────────────────

// Resolve the effective fee: a chosen item's fee overrides the program's.
function effectiveFee(program, item) {
  if (item && item.fee != null) return Number(item.fee);
  return Number(program.fee) || 0;
}

async function assertOpenWithCapacity(program) {
  const now = new Date();
  if (!program.isActive) throw err(400, 'This program is not open for registration.');
  if (program.opensAt && now < program.opensAt) throw err(400, 'Registration has not opened yet.');
  if (program.closesAt && now > program.closesAt) throw err(400, 'Registration has closed.');
  if (program.capacity != null) {
    const count = await prisma.registration.count({
      where: { programId: program.id, status: { not: 'CANCELLED' } },
    });
    if (count >= program.capacity) throw err(400, 'This program is full.');
  }
}

// Create a registration. Free → CONFIRMED immediately + admin notified. Paid →
// PENDING with a Razorpay order the client completes, then verifyPayment() confirms.
async function register(tenantId, user, body) {
  const program = await getProgram(tenantId, body.programId);
  await assertOpenWithCapacity(program);

  let item = null;
  if (body.programItemId) {
    item = program.items.find((i) => i.id === body.programItemId);
    if (!item) throw err(422, 'Selected item is not part of this program.');
  }

  const amount = effectiveFee(program, item);
  const base = {
    tenantId,
    programId: program.id,
    programItemId: item?.id ?? null,
    registrantUserId: user.id,
    studentId: body.studentId ?? null,
    amount,
    formData: body.formData ?? undefined,
  };

  // Free program → confirm now.
  if (amount <= 0) {
    const reg = await prisma.registration.create({
      data: { ...base, status: 'CONFIRMED', paymentStatus: 'NOT_REQUIRED' },
    });
    await notifyAdmins(program, user, item, { paid: false, amount: 0 });
    return { registration: reg, payment: null };
  }

  // Paid program → create Razorpay order, leave registration PENDING.
  const order = await razorpay.createOrder(amount, `prog_${program.id}_${Date.now()}`);
  const reg = await prisma.registration.create({
    data: { ...base, status: 'PENDING', paymentStatus: 'PENDING', razorpayOrderId: order.id },
  });
  return {
    registration: reg,
    payment: { orderId: order.id, amount: order.amount, currency: 'INR', keyId: razorpay.keyId() },
  };
}

async function verifyPayment(tenantId, body) {
  if (!razorpay.verifySignature(body)) throw err(400, 'Payment verification failed: invalid signature.');
  const reg = await prisma.registration.findUnique({ where: { razorpayOrderId: body.razorpay_order_id } });
  if (!reg) throw err(404, 'Registration not found for this order.');
  if (reg.tenantId !== tenantId) throw err(403, 'Order does not belong to this account.');
  if (reg.paymentStatus === 'PAID') return { success: true, registration: reg }; // idempotent

  const updated = await prisma.registration.update({
    where: { id: reg.id },
    data: { status: 'CONFIRMED', paymentStatus: 'PAID', razorpayPaymentId: body.razorpay_payment_id },
    include: { program: true, programItem: true, registrant: true },
  });
  await notifyAdmins(updated.program, updated.registrant, updated.programItem, { paid: true, amount: updated.amount });
  return { success: true, registration: updated };
}

// Notify the school's admins (fire-and-forget; never blocks the request). For
// global programs we notify the registrant's own school admins.
async function notifyAdmins(program, registrant, item, { paid, amount }) {
  notify.notifyRoles(registrant.tenantId ?? program.tenantId, ['SCHOOL_ADMIN'], 'PROGRAM_REGISTRATION', {
    programTitle: program.title,
    itemName: item?.name ?? null,
    registrantName: `${registrant.firstName} ${registrant.lastName}`.trim(),
    paid,
    amount,
  });
}

// ─── Registration listing / management ─────────────────────────────────────────

const REG_INCLUDE = {
  program: { select: { id: true, title: true, type: true } },
  programItem: { select: { id: true, name: true } },
  student: { select: { id: true, firstName: true, lastName: true } },
  registrant: { select: { id: true, firstName: true, lastName: true, email: true } },
  assignedTeacher: { select: { id: true, firstName: true, lastName: true } },
};

// Admin view: all registrations for the tenant, optionally filtered by program.
async function listRegistrations(tenantId, { programId, status } = {}) {
  return prisma.registration.findMany({
    where: { tenantId, ...(programId ? { programId } : {}), ...(status ? { status } : {}) },
    include: REG_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

// The current user's own registrations.
async function myRegistrations(tenantId, userId) {
  return prisma.registration.findMany({
    where: { tenantId, registrantUserId: userId },
    include: REG_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

// Admin allocates a teacher to a 1-to-1 tuition registration (backend matching).
async function assignTeacher(tenantId, registrationId, teacherId) {
  const reg = await prisma.registration.findFirst({ where: { id: registrationId, tenantId } });
  if (!reg) throw err(404, 'Registration not found.');
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, tenantId, role: 'TEACHER' } });
  if (!teacher) throw err(422, 'Teacher not found in this school.');
  return prisma.registration.update({
    where: { id: registrationId },
    data: { assignedTeacherId: teacherId },
    include: REG_INCLUDE,
  });
}

async function cancelRegistration(tenantId, user, registrationId) {
  const reg = await prisma.registration.findFirst({ where: { id: registrationId, tenantId } });
  if (!reg) throw err(404, 'Registration not found.');
  // A user may cancel their own; admins may cancel any (route enforces role).
  return prisma.registration.update({ where: { id: registrationId }, data: { status: 'CANCELLED' } });
}

module.exports = {
  listPrograms, getProgram,
  createProgram, updateProgram, deleteProgram,
  addItem, deleteItem,
  register, verifyPayment,
  listRegistrations, myRegistrations, assignTeacher, cancelRegistration,
};
