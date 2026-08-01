const prisma = require('../lib/prisma');
const notify = require('./notify.service');

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 3 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
}

// Receipts run RCP-<year>-00001 upwards, per school. The next number comes from the
// highest one already issued rather than a row count: counting reissues a number
// whenever a payment has been deleted, which the unique index then rejects.
async function generateReceiptNumber(tenantId) {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;
  const last = await prisma.feePayment.findFirst({
    where: { tenantId, receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true },
  });
  const seq = last ? parseInt(last.receiptNumber.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(seq + 1).padStart(5, '0')}`;
}

// ─── Fee Categories ───────────────────────────────────────────────────────────

async function listCategories(tenantId) {
  return prisma.feeCategory.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { structures: true, payments: true } } },
  });
}

async function createCategory(tenantId, { name, description, serviceType }) {
  return prisma.feeCategory.create({
    data: { tenantId, name: name.trim(), description: description || null, serviceType: serviceType || 'NONE' },
  });
}

async function updateCategory(tenantId, id, { name, description, serviceType }) {
  const cat = await prisma.feeCategory.findFirst({ where: { id, tenantId } });
  if (!cat) throw Object.assign(new Error('Fee category not found'), { status: 404 });
  return prisma.feeCategory.update({
    where: { id },
    data: {
      name: name.trim(),
      description: description || null,
      ...(serviceType !== undefined && { serviceType: serviceType || 'NONE' }),
    },
  });
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

  const year = academicYear || currentAcademicYear();

  // A collection may not exceed what the student still owes for that category. A
  // mistyped amount otherwise lands as a "200% cleared" account that only a manual
  // DB edit can undo. Late fees count towards the ceiling — they are genuinely payable.
  // Categories with no fee structure for the year have no defined amount to overpay,
  // so they stay uncapped (ad-hoc fines, one-off charges).
  const { breakdown } = await getStudentFeeAccount(tenantId, studentId, year);
  const rows = breakdown.filter(b => b.feeCategoryId === feeCategoryId);
  if (rows.length) {
    const payable = rows.reduce((a, b) => a + b.due + b.lateFee, 0);
    if (parseFloat(amount) - payable > 0.005) {
      throw Object.assign(
        new Error(
          payable > 0
            ? `Amount exceeds the outstanding balance for ${cat.name} (₹${payable.toLocaleString('en-IN')} remaining).`
            : `${cat.name} is already paid in full for ${year}.`,
        ),
        { status: 422 },
      );
    }
  }

  // Two clerks collecting at the same moment can read the same "next" receipt number.
  // The unique index rejects the loser, so re-read and retry a few times.
  let payment;
  for (let attempt = 0; ; attempt++) {
    try {
      payment = await prisma.feePayment.create({
        data: {
          tenantId, studentId, feeCategoryId,
          academicYear: year,
          amount: parseFloat(amount),
          month: month || null,
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          method: method || 'CASH',
          referenceNumber: referenceNumber || null,
          receiptNumber: await generateReceiptNumber(tenantId),
          collectedById,
          note: note || null,
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          feeCategory: { select: { id: true, name: true } },
          collectedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      break;
    } catch (err) {
      if (err.code !== 'P2002' || attempt >= 4) throw err;
    }
  }

  // Notify guardians a payment was received (all enabled channels). Fire-and-forget.
  notify.notifyStudentGuardians(tenantId, studentId, 'FEE_RECEIVED', {
    studentName: `${payment.student.firstName} ${payment.student.lastName}`,
    amount: payment.amount,
    receiptNo: payment.receiptNumber,
    referenceId: payment.id,
  });

  return payment;
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

// ─── Defaulter Report (class + category, service-aware) ───────────────────────
// Detailed view of who owes what. Honors service fees: a TRANSPORT category is
// only billed to students on a bus route, a HOSTEL category only to hostelers;
// NONE categories apply class-wide. Filter by class and/or a single category
// (e.g. "who hasn't paid the transport fee, class-wise").
async function getDefaulterReport(tenantId, { classId, feeCategoryId, academicYear, defaultersOnly = true } = {}) {
  const year = academicYear || currentAcademicYear();

  const [students, structures, payments, classes] = await Promise.all([
    prisma.student.findMany({
      where: { tenantId, status: 'ACTIVE', ...(classId && { classId }) },
      select: {
        id: true, firstName: true, lastName: true, admissionNumber: true, classId: true,
        boardingType: true, busRouteId: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [{ class: { name: 'asc' } }, { firstName: 'asc' }],
    }),
    prisma.feeStructure.findMany({
      where: { tenantId, academicYear: year, isActive: true, ...(feeCategoryId && { feeCategoryId }) },
      include: { feeCategory: { select: { id: true, name: true, serviceType: true } } },
    }),
    prisma.feePayment.findMany({
      where: { tenantId, academicYear: year, ...(feeCategoryId && { feeCategoryId }) },
      select: { studentId: true, feeCategoryId: true, amount: true },
    }),
    prisma.class.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  // paid[studentId][categoryId] = amount
  const paid = {};
  for (const p of payments) {
    (paid[p.studentId] ||= {})[p.feeCategoryId] = (paid[p.studentId]?.[p.feeCategoryId] || 0) + p.amount;
  }

  // Is a service category billable to this student?
  const eligible = (svc, s) =>
    svc === 'TRANSPORT' ? !!s.busRouteId
    : svc === 'HOSTEL' ? s.boardingType === 'HOSTELER'
    : true;

  let totalBilled = 0, totalCollected = 0, totalOutstanding = 0, defaulters = 0;
  const categoryTotals = {}; // categoryId -> { name, serviceType, billed, paid, outstanding, defaulters }

  const rows = [];
  for (const s of students) {
    const applicable = structures.filter(
      (st) => (!st.classId || st.classId === s.classId) && eligible(st.feeCategory.serviceType, s),
    );

    // sum billed per category (a category may have multiple structures)
    const billedByCat = {};
    for (const st of applicable) billedByCat[st.feeCategoryId] = (billedByCat[st.feeCategoryId] || 0) + st.amount;

    const cats = Object.entries(billedByCat).map(([cid, billed]) => {
      const catPaid = paid[s.id]?.[cid] || 0;
      const due = Math.max(0, billed - catPaid);
      const meta = applicable.find((st) => st.feeCategoryId === cid).feeCategory;
      const t = (categoryTotals[cid] ||= { feeCategoryId: cid, name: meta.name, serviceType: meta.serviceType, billed: 0, paid: 0, outstanding: 0, defaulters: 0 });
      t.billed += billed; t.paid += catPaid; t.outstanding += due; if (due > 0) t.defaulters += 1;
      return { feeCategoryId: cid, name: meta.name, serviceType: meta.serviceType, billed, paid: catPaid, due };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const billed = cats.reduce((a, c) => a + c.billed, 0);
    const paidTotal = cats.reduce((a, c) => a + c.paid, 0);
    const outstanding = cats.reduce((a, c) => a + c.due, 0);

    totalBilled += billed; totalCollected += paidTotal; totalOutstanding += outstanding;
    if (outstanding > 0) defaulters += 1;

    if (!defaultersOnly || outstanding > 0) {
      rows.push({
        student: { id: s.id, firstName: s.firstName, lastName: s.lastName, admissionNumber: s.admissionNumber, class: s.class, section: s.section, boardingType: s.boardingType, hasBus: !!s.busRouteId },
        billed, paid: paidTotal, outstanding, categories: cats,
      });
    }
  }

  return {
    academicYear: year,
    filters: { classId: classId || null, feeCategoryId: feeCategoryId || null, defaultersOnly },
    classes,
    summary: {
      totalStudents: students.length,
      defaulters,
      totalBilled, totalCollected, totalOutstanding,
    },
    categoryTotals: Object.values(categoryTotals).sort((a, b) => a.name.localeCompare(b.name)),
    rows,
  };
}

// ─── Fee Due Reminders ────────────────────────────────────────────────────────
// Cadence: 3 days before the due date, again on the due date, then once a week
// while the balance is still outstanding. Every dispatch is written to
// fee_reminder_logs, whose unique (tenant, student, structure, sentOn) index makes
// a same-day re-run a no-op — so the cron job can safely run more than once and an
// admin can press the manual button without double-messaging anyone.
//
// Driven by `scripts/send-fee-reminders.js` (system cron) and by
// POST /fees/send-reminders (admin button). Pass `dryRun` to preview.

const REMIND_DAYS_BEFORE = 3;
const OVERDUE_REPEAT_DAYS = 7;

const startOfDay = (d) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
const formatDueDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

async function sendFeeReminders(tenantId, { academicYear, today, dryRun = false } = {}) {
  const year = academicYear || currentAcademicYear();
  const runDate = startOfDay(today || new Date());
  const throttleFrom = new Date(runDate.getTime() - OVERDUE_REPEAT_DAYS * 86400000);

  const [students, structures, payments, guardians, recentLogs] = await Promise.all([
    prisma.student.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        id: true, firstName: true, lastName: true, admissionNumber: true,
        classId: true, boardingType: true, busRouteId: true,
        class: { select: { name: true } },
      },
    }),
    // Only dated structures can be reminded about — an undated one has no cadence.
    prisma.feeStructure.findMany({
      where: { tenantId, academicYear: year, isActive: true, dueDate: { not: null } },
      include: { feeCategory: { select: { id: true, name: true, serviceType: true } } },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.feePayment.findMany({
      where: { tenantId, academicYear: year },
      select: { studentId: true, feeCategoryId: true, amount: true },
    }),
    prisma.guardian.findMany({
      where: { tenantId, userId: { not: null } },
      select: { studentId: true, userId: true },
    }),
    prisma.feeReminderLog.findMany({
      where: { tenantId, sentOn: { gte: throttleFrom } },
      select: { studentId: true, feeStructureId: true, sentOn: true },
    }),
  ]);

  const result = {
    academicYear: year, date: runDate.toISOString().slice(0, 10), dryRun,
    sent: 0, skipped: 0, unreachable: [], reminders: [],
  };
  if (!structures.length || !students.length) return result;

  // paid[studentId][categoryId] — payments are recorded per category, so a
  // category's total is spread across its structures earliest due date first.
  const paid = {};
  for (const p of payments) {
    (paid[p.studentId] ||= {})[p.feeCategoryId] = (paid[p.studentId]?.[p.feeCategoryId] || 0) + p.amount;
  }

  const guardiansByStudent = {};
  for (const g of guardians) (guardiansByStudent[g.studentId] ||= []).push(g.userId);

  // pair key -> most recent sentOn within the throttle window
  const lastSent = {};
  for (const l of recentLogs) {
    const k = `${l.studentId}:${l.feeStructureId}`;
    if (!lastSent[k] || l.sentOn > lastSent[k]) lastSent[k] = l.sentOn;
  }

  // Service categories only apply to the students who use the service.
  const eligible = (svc, s) =>
    svc === 'TRANSPORT' ? !!s.busRouteId
    : svc === 'HOSTEL' ? s.boardingType === 'HOSTELER'
    : true;

  const toLog = [];

  for (const s of students) {
    const applicable = structures.filter(
      (st) => (!st.classId || st.classId === s.classId) && eligible(st.feeCategory.serviceType, s),
    );
    if (!applicable.length) continue;

    const remaining = { ...(paid[s.id] || {}) }; // category credit left to allocate

    for (const st of applicable) {
      const credit = Math.min(remaining[st.feeCategoryId] || 0, st.amount);
      remaining[st.feeCategoryId] = (remaining[st.feeCategoryId] || 0) - credit;
      const due = Math.max(0, st.amount - credit);
      if (due <= 0) continue;

      const dueDate = startOfDay(st.dueDate);
      const daysUntil = Math.round((dueDate - runDate) / 86400000);

      const kind = daysUntil === REMIND_DAYS_BEFORE ? 'UPCOMING'
        : daysUntil === 0 ? 'DUE'
        : daysUntil < 0 ? 'OVERDUE'
        : null;
      if (!kind) continue; // not a reminder day for this structure

      const prev = lastSent[`${s.id}:${st.id}`];
      // Upcoming/due fire once on their day; overdue repeats only every 7 days.
      const throttled = kind === 'OVERDUE'
        ? !!prev
        : !!prev && startOfDay(prev).getTime() === runDate.getTime();
      if (throttled) { result.skipped += 1; continue; }

      const studentName = `${s.firstName} ${s.lastName}`.trim();
      const userIds = guardiansByStudent[s.id] || [];
      if (!userIds.length) {
        // No guardian has a portal account yet, so there is nobody to message.
        // Reported back rather than logged, so it retries once they log in.
        // Listed once per student, however many fees they owe.
        if (!result.unreachable.some((u) => u.studentId === s.id)) {
          result.unreachable.push({ studentId: s.id, studentName, admissionNumber: s.admissionNumber });
        }
        continue;
      }

      result.reminders.push({
        studentId: s.id, studentName, admissionNumber: s.admissionNumber,
        className: s.class?.name || null,
        feeCategory: st.feeCategory.name,
        amount: due,
        dueDate: dueDate.toISOString().slice(0, 10),
        kind,
        daysOverdue: daysUntil < 0 ? -daysUntil : 0,
      });
      result.sent += 1;

      if (!dryRun) {
        notify.notify(tenantId, userIds, 'FEE_DUE', {
          studentName,
          amount: due,
          dueDate: formatDueDate(dueDate),
          referenceId: st.id,
        });
        toLog.push({
          tenantId, studentId: s.id, feeStructureId: st.id,
          academicYear: year, kind, amount: due, sentOn: runDate,
        });
      }
    }
  }

  if (toLog.length) {
    await prisma.feeReminderLog.createMany({ data: toLog, skipDuplicates: true });
  }
  return result;
}

module.exports = {
  currentAcademicYear,
  sendFeeReminders,
  listCategories, createCategory, updateCategory, deleteCategory,
  listStructures, createStructure, updateStructure, deleteStructure,
  getStudentFeeAccount, recordPayment, listPayments, getPayment, getDueReport,
  getDefaulterReport,
  createLateFeeWaiver, deleteLateFeeWaiver,
};