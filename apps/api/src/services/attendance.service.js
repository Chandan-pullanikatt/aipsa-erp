const prisma = require('../lib/prisma');
const { sendAttendanceSummary } = require('./email.service');
const notify = require('./notify.service');

// ─── Student Attendance ──────────────────────────────────────────────────────

async function markStudentAttendance(tenantId, markedById, { date, classId, sectionId, records }) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  const ops = records.map(({ studentId, status, note }) =>
    prisma.attendance.upsert({
      where: { tenantId_date_studentId: { tenantId, date: d, studentId } },
      create: { tenantId, date: d, studentId, classId, sectionId, status, note: note || null, markedById },
      update: { status, note: note || null, markedById, classId, sectionId },
    })
  );
  const result = await prisma.$transaction(ops);

  // Alert guardians of students marked absent (all enabled channels). Fire-and-forget.
  const absentIds = records.filter((r) => r.status === 'ABSENT').map((r) => r.studentId);
  if (absentIds.length) notifyAbsences(tenantId, absentIds, d).catch((e) => console.error('[attendance] notify failed:', e.message));

  return result;
}

async function notifyAbsences(tenantId, studentIds, date) {
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, tenantId },
    select: { id: true, firstName: true, lastName: true },
  });
  const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  for (const s of students) {
    notify.notifyStudentGuardians(tenantId, s.id, 'ATTENDANCE_ABSENT', {
      studentName: `${s.firstName} ${s.lastName}`,
      date: dateStr,
      referenceId: s.id,
    });
  }
}

async function getStudentAttendance(tenantId, { classId, sectionId, date, studentId }) {
  const where = {
    tenantId,
    studentId: { not: null },
    ...(classId && { classId }),
    ...(sectionId && { sectionId }),
    ...(studentId && { studentId }),
    ...(date && (() => { const d = new Date(date); d.setUTCHours(0,0,0,0); return { date: d }; })()),
  };
  return prisma.attendance.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
    orderBy: { date: 'desc' },
  });
}

async function getStudentAttendanceReport(tenantId, studentId, { fromDate, toDate }) {
  const from = new Date(fromDate); from.setUTCHours(0,0,0,0);
  const to = new Date(toDate); to.setUTCHours(0,0,0,0);

  const records = await prisma.attendance.findMany({
    where: { tenantId, studentId, date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  });

  const total = records.length;
  const present = records.filter(r => r.status === 'PRESENT' || r.status === 'HALF_DAY').length;
  const absent = records.filter(r => r.status === 'ABSENT').length;
  const late = records.filter(r => r.status === 'LATE').length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return { records, summary: { total, present, absent, late, percentage } };
}

async function getClassAttendanceSummary(tenantId, { classId, sectionId, date }) {
  const d = new Date(date); d.setUTCHours(0,0,0,0);
  const where = { tenantId, classId, date: d, studentId: { not: null }, ...(sectionId && { sectionId }) };

  const [records, totalStudents] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } },
    }),
    prisma.student.count({ where: { tenantId, classId, status: 'ACTIVE', ...(sectionId && { sectionId }) } }),
  ]);

  const present = records.filter(r => r.status === 'PRESENT').length;
  const absent = records.filter(r => r.status === 'ABSENT').length;
  const late = records.filter(r => r.status === 'LATE').length;
  const halfDay = records.filter(r => r.status === 'HALF_DAY').length;
  const unmarked = totalStudents - records.length;

  return { records, summary: { totalStudents, present, absent, late, halfDay, unmarked } };
}

// ─── Teacher Attendance ──────────────────────────────────────────────────────

async function markTeacherAttendance(tenantId, markedById, { userId, date, status, note }) {
  const d = new Date(date); d.setUTCHours(0,0,0,0);
  return prisma.attendance.upsert({
    where: { tenantId_date_userId: { tenantId, date: d, userId } },
    create: { tenantId, date: d, userId, status, note: note || null, markedById },
    update: { status, note: note || null, markedById },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
}

async function getTeacherAttendance(tenantId, { date, userId }) {
  const where = {
    tenantId,
    userId: { not: null },
    ...(userId && { userId }),
    ...(date && (() => { const d = new Date(date); d.setUTCHours(0,0,0,0); return { date: d }; })()),
  };
  return prisma.attendance.findMany({
    where,
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { date: 'desc' },
  });
}

// ─── Leave ───────────────────────────────────────────────────────────────────

async function applyLeave(tenantId, applicant, { fromDate, toDate, reason }) {
  const from = new Date(fromDate); from.setUTCHours(0,0,0,0);
  const to = new Date(toDate); to.setUTCHours(0,0,0,0);
  return prisma.leave.create({
    data: {
      tenantId,
      ...(applicant.studentId ? { studentId: applicant.studentId } : { userId: applicant.userId }),
      fromDate: from, toDate: to, reason,
    },
  });
}

async function listLeaves(tenantId, { studentId, userId, status, page = 1, limit = 20 }) {
  const where = {
    tenantId,
    ...(studentId && { studentId }),
    ...(userId && { userId }),
    ...(status && { status }),
  };
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [leaves, total] = await prisma.$transaction([
    prisma.leave.findMany({
      where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    }),
    prisma.leave.count({ where }),
  ]);
  return { leaves, total };
}

async function reviewLeave(tenantId, id, { status, reviewNote }) {
  const leave = await prisma.leave.findFirst({ where: { id, tenantId } });
  if (!leave) throw Object.assign(new Error('Leave not found'), { status: 404 });
  if (leave.status !== 'PENDING') throw Object.assign(new Error('Leave already reviewed'), { status: 409 });
  return prisma.leave.update({ where: { id }, data: { status, reviewNote } });
}

// ─── Daily Summary Email ─────────────────────────────────────────────────────

async function sendDailySummaryEmail(tenantId) {
  const today = new Date(); today.setUTCHours(0,0,0,0);

  const [classes, admin, profile] = await Promise.all([
    prisma.class.findMany({ where: { tenantId }, include: { _count: { select: { students: true } } } }),
    prisma.user.findFirst({ where: { tenantId, role: 'SCHOOL_ADMIN' } }),
    prisma.schoolProfile.findUnique({ where: { tenantId } }),
  ]);

  const summaries = await Promise.all(
    classes.map(async (cls) => {
      const present = await prisma.attendance.count({ where: { tenantId, classId: cls.id, date: today, status: 'PRESENT' } });
      const absent = await prisma.attendance.count({ where: { tenantId, classId: cls.id, date: today, status: 'ABSENT' } });
      return { className: cls.name, total: cls._count.students, present, absent };
    })
  );

  if (admin) {
    await sendAttendanceSummary(admin.email, profile?.schoolName || 'School', today, summaries).catch(console.error);
  }
  return { sent: true, summaries };
}

module.exports = {
  markStudentAttendance, getStudentAttendance, getStudentAttendanceReport, getClassAttendanceSummary,
  markTeacherAttendance, getTeacherAttendance,
  applyLeave, listLeaves, reviewLeave,
  sendDailySummaryEmail,
};