const prisma = require('../lib/prisma');

const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 3 ? `${y}-${String(y+1).slice(-2)}` : `${y-1}-${String(y).slice(-2)}`;
}

async function getClassTimetable(tenantId, classId, academicYear) {
  const year = academicYear || currentAcademicYear();
  const periods = await prisma.period.findMany({
    where: { tenantId, classId, academicYear: year },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
  });
  return { periods, academicYear: year };
}

async function savePeriod(tenantId, data) {
  const { classId, academicYear, dayOfWeek, periodNumber, startTime, endTime, subjectId, teacherId, isBreak, breakLabel } = data;
  const year = academicYear || currentAcademicYear();

  // Conflict detection: teacher already assigned elsewhere at same day + time
  if (teacherId && !isBreak) {
    const conflicts = await prisma.period.findMany({
      where: {
        tenantId,
        teacherId,
        dayOfWeek,
        academicYear: year,
        isBreak: false,
        NOT: { classId },
      },
      include: { class: { select: { name: true } } },
    });

    const overlap = conflicts.filter(c => {
      // Check time overlap
      return c.startTime < endTime && c.endTime > startTime;
    });

    if (overlap.length > 0) {
      const names = overlap.map(c => c.class.name).join(', ');
      throw Object.assign(
        new Error(`Conflict: Teacher already assigned to ${names} at this time on ${dayOfWeek}`),
        { status: 409, conflicts: overlap }
      );
    }
  }

  const key = { tenantId, classId, academicYear: year, dayOfWeek, periodNumber };
  return prisma.period.upsert({
    where: { tenantId_classId_academicYear_dayOfWeek_periodNumber: key },
    create: {
      ...key, startTime, endTime,
      subjectId: subjectId || null,
      teacherId: teacherId || null,
      isBreak: isBreak || false,
      breakLabel: breakLabel || null,
    },
    update: {
      startTime, endTime,
      subjectId: subjectId || null,
      teacherId: teacherId || null,
      isBreak: isBreak || false,
      breakLabel: breakLabel || null,
    },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

async function clearPeriod(tenantId, classId, academicYear, dayOfWeek, periodNumber) {
  await prisma.period.deleteMany({
    where: { tenantId, classId, academicYear, dayOfWeek, periodNumber },
  });
}

async function clearClassTimetable(tenantId, classId, academicYear) {
  await prisma.period.deleteMany({
    where: { tenantId, classId, academicYear },
  });
}

async function bulkSaveTimetable(tenantId, classId, academicYear, periods) {
  const year = academicYear || currentAcademicYear();
  // Clear existing and replace
  await prisma.period.deleteMany({ where: { tenantId, classId, academicYear: year } });
  if (periods.length === 0) return [];
  await prisma.period.createMany({
    data: periods.map(p => ({
      tenantId, classId, academicYear: year,
      dayOfWeek: p.dayOfWeek,
      periodNumber: p.periodNumber,
      startTime: p.startTime,
      endTime: p.endTime,
      subjectId: p.subjectId || null,
      teacherId: p.teacherId || null,
      isBreak: p.isBreak || false,
      breakLabel: p.breakLabel || null,
    })),
  });
  return getClassTimetable(tenantId, classId, year);
}

async function getTeacherSchedule(tenantId, teacherId, academicYear) {
  const year = academicYear || currentAcademicYear();
  return prisma.period.findMany({
    where: { tenantId, teacherId, academicYear: year },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
  });
}

async function checkConflicts(tenantId, classId, academicYear) {
  const year = academicYear || currentAcademicYear();
  const periods = await prisma.period.findMany({
    where: { tenantId, classId, academicYear: year, teacherId: { not: null }, isBreak: false },
    include: { teacher: { select: { firstName: true, lastName: true } } },
  });

  const conflicts = [];
  const teacherSlots = {};
  for (const p of periods) {
    const key = `${p.teacherId}-${p.dayOfWeek}-${p.startTime}`;
    if (teacherSlots[key]) {
      conflicts.push({ period: p, conflictWith: teacherSlots[key] });
    } else {
      teacherSlots[key] = p;
    }
  }
  return conflicts;
}

// ─── Generation inputs: bell-schedule config ──────────────────────────────────

const DEFAULT_SLOTS = [
  { periodNumber: 1, startTime: '09:00', endTime: '09:45', isBreak: false },
  { periodNumber: 2, startTime: '09:45', endTime: '10:30', isBreak: false },
  { periodNumber: 3, startTime: '10:30', endTime: '10:45', isBreak: true, breakLabel: 'Short Break' },
  { periodNumber: 4, startTime: '10:45', endTime: '11:30', isBreak: false },
  { periodNumber: 5, startTime: '11:30', endTime: '12:15', isBreak: false },
  { periodNumber: 6, startTime: '12:15', endTime: '13:00', isBreak: true, breakLabel: 'Lunch Break' },
  { periodNumber: 7, startTime: '13:00', endTime: '13:45', isBreak: false },
  { periodNumber: 8, startTime: '13:45', endTime: '14:30', isBreak: false },
];

// Returns the saved config or an unsaved default (flagged isDefault) so the UI always has a grid.
async function getTimetableConfig(tenantId, academicYear) {
  const year = academicYear || currentAcademicYear();
  const config = await prisma.timetableConfig.findUnique({
    where: { tenantId_academicYear: { tenantId, academicYear: year } },
  });
  if (config) return config;
  return {
    tenantId,
    academicYear: year,
    workingDays: DAYS,
    slots: DEFAULT_SLOTS,
    maxPeriodsPerDayPerTeacher: 6,
    isDefault: true,
  };
}

async function saveTimetableConfig(tenantId, data) {
  const year = data.academicYear || currentAcademicYear();
  const workingDays = Array.isArray(data.workingDays) && data.workingDays.length ? data.workingDays : DAYS;
  const slots = Array.isArray(data.slots) ? data.slots : DEFAULT_SLOTS;
  const maxPeriodsPerDayPerTeacher = Number.isInteger(data.maxPeriodsPerDayPerTeacher) ? data.maxPeriodsPerDayPerTeacher : 6;
  return prisma.timetableConfig.upsert({
    where: { tenantId_academicYear: { tenantId, academicYear: year } },
    create: { tenantId, academicYear: year, workingDays, slots, maxPeriodsPerDayPerTeacher },
    update: { workingDays, slots, maxPeriodsPerDayPerTeacher },
  });
}

// ─── Generation inputs: teacher unavailability ────────────────────────────────

async function listTeacherAvailability(tenantId, teacherId, academicYear) {
  const year = academicYear || currentAcademicYear();
  return prisma.teacherAvailability.findMany({
    where: { tenantId, academicYear: year, ...(teacherId && { teacherId }) },
    include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
  });
}

async function addTeacherAvailability(tenantId, data) {
  const year = data.academicYear || currentAcademicYear();
  const { teacherId, dayOfWeek, reason } = data;
  const periodNumber = data.periodNumber ?? null;
  const existing = await prisma.teacherAvailability.findFirst({
    where: { tenantId, teacherId, academicYear: year, dayOfWeek, periodNumber },
  });
  if (existing) {
    return prisma.teacherAvailability.update({ where: { id: existing.id }, data: { reason: reason || null } });
  }
  return prisma.teacherAvailability.create({
    data: { tenantId, teacherId, academicYear: year, dayOfWeek, periodNumber, reason: reason || null },
  });
}

async function removeTeacherAvailability(tenantId, id) {
  await prisma.teacherAvailability.deleteMany({ where: { id, tenantId } });
}

module.exports = {
  currentAcademicYear, DAYS, DEFAULT_SLOTS,
  getClassTimetable, savePeriod, clearPeriod, clearClassTimetable, bulkSaveTimetable,
  getTeacherSchedule, checkConflicts,
  getTimetableConfig, saveTimetableConfig,
  listTeacherAvailability, addTeacherAvailability, removeTeacherAvailability,
};