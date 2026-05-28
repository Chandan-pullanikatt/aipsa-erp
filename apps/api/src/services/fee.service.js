const prisma = require('../lib/prisma');

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 3 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
}

async function generateReceiptNumber(tenantId) {
  const year = new Date().getFullYear();
  const count = await prisma.feePayment.count({ where: { tenantId } });
  return `RCP-${year}-${String(count + 1).padStart(5, '0')}`;
}

// ─── Fee Categories ───────────────────────────────────────────────────────────

async function listCategories(tenantId) {
  return prisma.feeCategory.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { structures: true, payments: true } } },
  });
}

async function createCategory(tenantId, { name, description }) {
  return prisma.feeCategory.create({
    data: { tenantId, name: name.trim(), description: description || null },
  });
}

async function updateCategory(tenantId, id, { name, description }) {
  const cat = await prisma.feeCategory.findFirst({ where: { id, tenantId } });
  if (!cat) throw Object.assign(new Error('Fee category not found'), { status: 404 });
  return prisma.feeCategory.update({ where: { id }, data: { name: name.trim(), description: description || null } });
}

async function deleteCategory(tenantId, id) {
  const cat = await prisma.feeCategory.findFirst({ where: { id, tenantId }, include: { _count: { select: { payments: true } } } });
  if (!cat) throw Object.assign(new Error('Fee category not found'), { status: 404 });
  if (cat._count.payments > 0) throw Object.assign(new Error('Cannot delete category with existing payments'), { status: 409 });
  await prisma.feeCategory.delete({ where: { id } });
}

// ─── Fee Structures ───────────────────────────────────────────────────────────

async function listStructures(tenantId, { academicYear, classId } = {}) {
  const year = academicYear || currentAcademicYear();
  return prisma.feeStructure.findMany({
    where: { tenantId, academicYear: year, ...(classId && { classId }), isActive: true },
    include: {
      feeCategory: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ feeCategory: { name: 'asc' } }, { class: { name: 'asc' } }],
  });
}

async function createStructure(tenantId, data) {
  const { feeCategoryId, classId, amount, frequency, academicYear, dueDate } = data;
  const year = academicYear || currentAcademicYear();
  const cat = await prisma.feeCategory.findFirst({ where: { id: feeCategoryId, tenantId } });
  if (!cat) throw Object.assign(new Error('Fee category not found'), { status: 404 });
  return prisma.feeStructure.create({
    data: {
      tenantId, feeCategoryId, classId: classId || null,
      amount: parseFloat(amount), frequency, academicYear: year,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: { feeCategory: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
  });
}

async function updateStructure(tenantId, id, data) {
  const s = await prisma.feeStructure.findFirst({ where: { id, tenantId } });
  if (!s) throw Object.assign(new Error('Fee structure not found'), { status: 404 });
  const { amount, frequency, isActive, dueDate } = data;
  return prisma.feeStructure.update({
    where: { id },
    data: {
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(frequency && { frequency }),
      ...(isActive !== undefined && { isActive }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
    include: { feeCategory: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
  });
}

async function deleteStructure(tenantId, id) {
  const s = await prisma.feeStructure.findFirst({ where: { id, tenantId } });
  if (!s) throw Object.assign(new Error('Fee structure not found'), { status: 404 });
  await prisma.feeStructure.delete({ where: { id } });
}

// ─── Student Fee Account ──────────────────────────────────────────────────────

async function getStudentFeeAccount(tenantId, studentId, academicYear) {
  const year = academicYear || currentAcademicYear();

  const [student, schoolProfile] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { class: { select: { id: true, name: true } } },
    }),
    prisma.schoolProfile.findUnique({ where: { tenantId } }),
  ]);
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const lateFeeAmount   = schoolProfile?.lateFeeAmount   ?? 0;
  const lateFeeGraceDays = schoolProfile?.lateFeeGraceDays ?? 0;

  const [structures, payments, waivers] = await Promise.all([
    prisma.feeStructure.findMany({
      where: {
        tenantId, academicYear: year, isActive: true,
        OR: [{ classId: null }, ...(student.classId ? [{ classId: student.classId }] : [])],
      },
      include: { feeCategory: { select: { id: true, name: true } } },
    }),
    prisma.feePayment.findMany({
      where: { tenantId, studentId, academicYear: year },
      orderBy: { paidAt: 'desc' },
      include: { feeCategory: { select: { id: true, name: true } } },
    }),
    prisma.lateFeeWaiver.findMany({
      where: { tenantId, studentId, academicYear: year },
    }),
  ]);

  const paidByCategory = {};
  payments.forEach(p => {
    paidByCategory[p.feeCategoryId] = (paidByCategory[p.feeCategoryId] || 0) + p.amount;
  });

  const waivedStructureIds = new Set(waivers.map(w => w.feeStructureId));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const breakdown = structures.map(s => {
    const paid = paidByCategory[s.feeCategoryId] || 0;
    const due  = Math.max(0, s.amount - paid);

    let daysOverdue = 0;
    let lateFeeApplicable = false;
    let lateFee = 0;
    const isWaived = waivedStructureIds.has(s.id);

    if (s.dueDate && due > 0) {
      const graceCutoff = new Date(s.dueDate);
      graceCutoff.setDate(graceCutoff.getDate() + lateFeeGraceDays);
      graceCutoff.setHours(0, 0, 0, 0);
      daysOverdue = Math.max(0, Math.floor((today - new Date(s.dueDate)) / 86400000));
      lateFeeApplicable = today > graceCutoff;
      lateFee = lateFeeApplicable && !isWaived ? lateFeeAmount : 0;
    }

    return {
      structureId: s.id,
      feeCategoryId: s.feeCategoryId,
      feeCategoryName: s.feeCategory.name,
      structureAmount: s.amount,
      frequency: s.frequency,
      dueDate: s.dueDate,
      paid,
      due,
      daysOverdue,
      lateFeeApplicable,
      lateFeeWaived: isWaived,
      lateFee,
    };
  });

  const totalStructure = structures.reduce((a, s) => a + s.amount, 0);
  const totalPaid      = payments.reduce((a, p) => a + p.amount, 0);
  const totalDue       = Math.max(0, totalStructure - totalPaid);
  const totalLateFee   = breakdown.reduce((a, b) => a + b.lateFee, 0);

  return {
    student, academicYear: year, breakdown, payments,
    summary: { totalStructure, totalPaid, totalDue, totalLateFee },
    lateFeePolicy: { lateFeeAmount, lateFeeGraceDays },
  };
}

// ─── Late Fee Waivers ─────────────────────────────────────────────────────────

async function createLateFeeWaiver(tenantId, studentId, { feeStructureId, academicYear }, waivedById) {
  const year = academicYear || currentAcademicYear();
  return prisma.lateFeeWaiver.upsert({
    where: { tenantId_studentId_feeStructureId_academicYear: { tenantId, studentId, feeStructureId, academicYear: year } },
    create: { tenantId, studentId, feeStructureId, academicYear: year, waivedById },
    update: { waivedById },
  });
}

async function deleteLateFeeWaiver(tenantId, studentId, { feeStructureId, academicYear }) {
  const year = academicYear || currentAcademicYear();
  await prisma.lateFeeWaiver.deleteMany({
    where: { tenantId, studentId, feeStructureId, academicYear: year },
  });
}

// ─── Payments ────────────────────────────────────────────────────────────────

async function recordPayment(tenantId, collectedById, data) {
  const { studentId, feeCategoryId, amount, month, method, referenceNumber, note, paidAt, academicYear } = data;

  const [student, cat] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, tenantId } }),
    prisma.feeCategory.findFirst({ where: { id: feeCategoryId, tenantId } }),
  ]);
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  if (!cat) throw Object.assign(new Error('Fee category not found'), { status: 404 });

  const receiptNumber = await generateReceiptNumber(tenantId);
  const year = academicYear || currentAcademicYear();

  return prisma.feePayment.create({
    data: {
      tenantId, studentId, feeCategoryId,
      academicYear: year,
      amount: parseFloat(amount),
      month: month || null,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      method: method || 'CASH',
      referenceNumber: referenceNumber || null,
      receiptNumber,
      collectedById,
      note: note || null,
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      feeCategory: { select: { id: true, name: true } },
      collectedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

async function listPayments(tenantId, { studentId, feeCategoryId, academicYear, page = 1, limit = 20 }) {
  const year = academicYear || currentAcademicYear();
  const where = {
    tenantId,
    academicYear: year,
    ...(studentId && { studentId }),
    ...(feeCategoryId && { feeCategoryId }),
  };
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [payments, total] = await prisma.$transaction([
    prisma.feePayment.findMany({
      where, skip, take: parseInt(limit), orderBy: { paidAt: 'desc' },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        feeCategory: { select: { id: true, name: true } },
      },
    }),
    prisma.feePayment.count({ where }),
  ]);
  return { payments, total };
}

async function getPayment(tenantId, id) {
  const p = await prisma.feePayment.findFirst({
    where: { id, tenantId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } }, section: { select: { name: true } } } },
      feeCategory: { select: { name: true } },
      collectedBy: { select: { firstName: true, lastName: true } },
      tenant: { include: { profile: { select: { schoolName: true, address: true, phone: true } } } },
    },
  });
  if (!p) throw Object.assign(new Error('Payment not found'), { status: 404 });
  return p;
}

async function getDueReport(tenantId, { classId, academicYear } = {}) {
  const year = academicYear || currentAcademicYear();
  const students = await prisma.student.findMany({
    where: { tenantId, status: 'ACTIVE', ...(classId && { classId }) },
    include: { class: { select: { name: true } }, section: { select: { name: true } } },
    orderBy: [{ class: { name: 'asc' } }, { firstName: 'asc' }],
  });

  const structures = await prisma.feeStructure.findMany({
    where: { tenantId, academicYear: year, isActive: true },
  });

  const allPayments = await prisma.feePayment.findMany({
    where: { tenantId, academicYear: year },
    select: { studentId: true, amount: true },
  });

  const paidByStudent = {};
  allPayments.forEach(p => { paidByStudent[p.studentId] = (paidByStudent[p.studentId] || 0) + p.amount; });

  return students.map(s => {
    const applicable = structures.filter(st => !st.classId || st.classId === s.classId);
    const totalDue = applicable.reduce((a, st) => a + st.amount, 0);
    const totalPaid = paidByStudent[s.id] || 0;
    const balance = totalDue - totalPaid;
    return {
      student: { id: s.id, firstName: s.firstName, lastName: s.lastName, admissionNumber: s.admissionNumber, class: s.class, section: s.section },
      totalDue, totalPaid, balance,
    };
  }).filter(r => r.balance > 0);
}

module.exports = {
  currentAcademicYear,
  listCategories, createCategory, updateCategory, deleteCategory,
  listStructures, createStructure, updateStructure, deleteStructure,
  getStudentFeeAccount, recordPayment, listPayments, getPayment, getDueReport,
  createLateFeeWaiver, deleteLateFeeWaiver,
};