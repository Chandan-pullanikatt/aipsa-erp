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

// ─── Auto-generation (Phase 1: greedy + randomised restart) ────────────────────

// Small seeded PRNG so a given seed reproduces the same timetable (powers the
// "Regenerate" button and makes results deterministic for tests/support).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_ATTEMPTS = 60;
const TIME_BUDGET_MS = 3000;

// Builds a conflict-free draft timetable for every class for one academic year.
// Pure read + compute; nothing is written — the caller reviews then applies.
async function generateTimetable(tenantId, academicYear, { seed } = {}) {
  const year = academicYear || currentAcademicYear();
  const config = await getTimetableConfig(tenantId, year);
  const workingDays = Array.isArray(config.workingDays) && config.workingDays.length ? config.workingDays : DAYS;
  const slots = Array.isArray(config.slots) && config.slots.length ? config.slots : DEFAULT_SLOTS;
  const teachingSlots = slots.filter((s) => !s.isBreak);
  const maxPerDay = Number.isInteger(config.maxPeriodsPerDayPerTeacher) ? config.maxPeriodsPerDayPerTeacher : 6;

  const [classes, subjects, availability] = await Promise.all([
    prisma.class.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.subject.findMany({
      where: { tenantId },
      select: {
        id: true, name: true, classId: true, teacherId: true, periodsPerWeek: true,
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.teacherAvailability.findMany({ where: { tenantId, academicYear: year } }),
  ]);

  const classById = new Map(classes.map((c) => [c.id, c]));

  // Teaching cells = working days × non-break slots. Same grid for every class.
  const cells = [];
  for (const day of workingDays) {
    for (const s of teachingSlots) {
      cells.push({ day, periodNumber: s.periodNumber, startTime: s.startTime, endTime: s.endTime });
    }
  }
  const totalCells = cells.length;

  // Teacher unavailability lookups.
  const blockedSlot = new Set();
  const blockedDay = new Set();
  for (const a of availability) {
    if (a.periodNumber == null) blockedDay.add(`${a.teacherId}-${a.dayOfWeek}`);
    else blockedSlot.add(`${a.teacherId}-${a.dayOfWeek}-${a.periodNumber}`);
  }
  const isBlocked = (tid, day, pn) => blockedDay.has(`${tid}-${day}`) || blockedSlot.has(`${tid}-${day}-${pn}`);
  const freeSlotCount = (tid) => cells.reduce((n, c) => n + (isBlocked(tid, c.day, c.periodNumber) ? 0 : 1), 0);

  // ── Up-front validation → warnings (don't block, just inform) ──
  const warnings = [];
  const teacherLoad = new Map();
  for (const s of subjects) {
    if (s.periodsPerWeek > 0 && !s.teacherId) {
      warnings.push(`${classById.get(s.classId)?.name || 'Class'} · ${s.name}: needs ${s.periodsPerWeek} period(s) but has no teacher assigned — skipped.`);
    }
    if (s.teacherId && s.periodsPerWeek > 0) {
      teacherLoad.set(s.teacherId, (teacherLoad.get(s.teacherId) || 0) + s.periodsPerWeek);
    }
  }
  for (const c of classes) {
    const load = subjects
      .filter((s) => s.classId === c.id && s.teacherId && s.periodsPerWeek > 0)
      .reduce((a, s) => a + s.periodsPerWeek, 0);
    if (load > totalCells) warnings.push(`Class ${c.name} needs ${load} periods but the grid only has ${totalCells} teaching slots.`);
  }
  for (const [tid, load] of teacherLoad) {
    const free = freeSlotCount(tid);
    if (load > free) {
      const t = subjects.find((s) => s.teacherId === tid)?.teacher;
      const name = t ? `${t.firstName} ${t.lastName}` : 'A teacher';
      warnings.push(`${name} is assigned ${load} periods but only has ${free} free slot(s).`);
    }
  }

  // ── Expand demands (one lesson unit per period needed) ──
  const demands = [];
  for (const s of subjects) {
    if (!s.teacherId || s.periodsPerWeek <= 0) continue;
    for (let i = 0; i < s.periodsPerWeek; i++) {
      demands.push({
        classId: s.classId, subjectId: s.id, subjectName: s.name, teacherId: s.teacherId,
        teacherFreedom: freeSlotCount(s.teacherId),
      });
    }
  }

  // ── Randomised-restart greedy placement; keep the best attempt ──
  const baseSeed = Number.isInteger(seed) ? seed : Math.floor(Math.random() * 1e9);
  const started = Date.now();
  let best = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(baseSeed + attempt);
    const res = attemptPlacement(demands, cells, isBlocked, maxPerDay, rng);
    if (!best || res.unplaced.length < best.unplaced.length) best = res;
    if (best.unplaced.length === 0 || Date.now() - started > TIME_BUDGET_MS) break;
  }

  // ── Build per-class drafts (full grid incl. breaks) ──
  const placedByCell = new Map(); // `${classId}-${day}-${pn}` -> placement
  for (const p of best.placements) placedByCell.set(`${p.classId}-${p.day}-${p.periodNumber}`, p);

  const drafts = classes.map((c) => {
    const periods = [];
    for (const day of workingDays) {
      for (const s of slots) {
        const placed = !s.isBreak ? placedByCell.get(`${c.id}-${day}-${s.periodNumber}`) : null;
        periods.push({
          dayOfWeek: day,
          periodNumber: s.periodNumber,
          startTime: s.startTime,
          endTime: s.endTime,
          subjectId: placed ? placed.subjectId : null,
          teacherId: placed ? placed.teacherId : null,
          isBreak: !!s.isBreak,
          breakLabel: s.breakLabel || null,
        });
      }
    }
    return { classId: c.id, className: c.name, periods };
  });

  // Summarise unplaced demands per class+subject for a plain-English report.
  const unplacedSummary = {};
  for (const d of best.unplaced) {
    const key = `${d.classId}|${d.subjectId}`;
    if (!unplacedSummary[key]) unplacedSummary[key] = { className: classById.get(d.classId)?.name || 'Class', subjectName: d.subjectName, count: 0 };
    unplacedSummary[key].count++;
  }
  const unplaced = Object.values(unplacedSummary).map((u) => `${u.className} · ${u.subjectName}: ${u.count} period(s) could not be placed.`);

  return {
    academicYear: year,
    drafts,
    report: {
      feasible: best.unplaced.length === 0,
      totalDemands: demands.length,
      placed: best.placements.length,
      unplacedCount: best.unplaced.length,
      unplaced,
      warnings,
      seed: baseSeed,
    },
  };
}

// One greedy pass: order most-constrained demands first, place each in the
// best-scoring feasible cell. Returns placements + any demands with no cell.
function attemptPlacement(demands, cells, isBlocked, maxPerDay, rng) {
  const classOcc = new Set();
  const teacherOcc = new Set();
  const subjDay = new Map();    // `${classId}-${subjectId}-${day}` -> count
  const teacherDay = new Map(); // `${teacherId}-${day}` -> count
  const classDay = new Map();   // `${classId}-${day}` -> count
  const placements = [];
  const unplaced = [];

  // Most-constrained-first: teachers with least freedom placed first; small
  // random tie-break makes each restart explore a different ordering.
  const ordered = [...demands].sort((a, b) => a.teacherFreedom - b.teacherFreedom || rng() - 0.5);

  for (const d of ordered) {
    let bestCell = null;
    let bestScore = -Infinity;
    for (const cell of cells) {
      if (classOcc.has(`${d.classId}-${cell.day}-${cell.periodNumber}`)) continue;
      if (teacherOcc.has(`${d.teacherId}-${cell.day}-${cell.periodNumber}`)) continue;
      if (isBlocked(d.teacherId, cell.day, cell.periodNumber)) continue;

      let score = 0;
      const sameSubjToday = subjDay.get(`${d.classId}-${d.subjectId}-${cell.day}`) || 0;
      const tDay = teacherDay.get(`${d.teacherId}-${cell.day}`) || 0;
      const cDay = classDay.get(`${d.classId}-${cell.day}`) || 0;
      score -= sameSubjToday * 100;        // spread a subject across the week
      score -= tDay * 3;                    // balance each teacher's daily load
      score -= cDay;                        // balance each class's daily load
      if (tDay >= maxPerDay) score -= 500;  // soft cap on teacher periods/day
      score += rng() * 0.5;                 // tie-break
      if (score > bestScore) { bestScore = score; bestCell = cell; }
    }

    if (!bestCell) { unplaced.push(d); continue; }
    classOcc.add(`${d.classId}-${bestCell.day}-${bestCell.periodNumber}`);
    teacherOcc.add(`${d.teacherId}-${bestCell.day}-${bestCell.periodNumber}`);
    subjDay.set(`${d.classId}-${d.subjectId}-${bestCell.day}`, (subjDay.get(`${d.classId}-${d.subjectId}-${bestCell.day}`) || 0) + 1);
    teacherDay.set(`${d.teacherId}-${bestCell.day}`, (teacherDay.get(`${d.teacherId}-${bestCell.day}`) || 0) + 1);
    classDay.set(`${d.classId}-${bestCell.day}`, (classDay.get(`${d.classId}-${bestCell.day}`) || 0) + 1);
    placements.push({ classId: d.classId, subjectId: d.subjectId, teacherId: d.teacherId, day: bestCell.day, periodNumber: bestCell.periodNumber });
  }

  return { placements, unplaced };
}

// Persists reviewed drafts — replaces each class's grid for the year in one
// transaction so a partial failure can't leave a half-applied timetable.
async function applyGeneratedTimetable(tenantId, academicYear, drafts) {
  const year = academicYear || currentAcademicYear();
  await prisma.$transaction(
    drafts.flatMap((d) => [
      prisma.period.deleteMany({ where: { tenantId, classId: d.classId, academicYear: year } }),
      prisma.period.createMany({
        data: d.periods.map((p) => ({
          tenantId, classId: d.classId, academicYear: year,
          dayOfWeek: p.dayOfWeek, periodNumber: p.periodNumber,
          startTime: p.startTime, endTime: p.endTime,
          subjectId: p.subjectId || null, teacherId: p.teacherId || null,
          isBreak: p.isBreak || false, breakLabel: p.breakLabel || null,
        })),
      }),
    ])
  );
  return { applied: drafts.length };
}

module.exports = {
  currentAcademicYear, DAYS, DEFAULT_SLOTS,
  getClassTimetable, savePeriod, clearPeriod, clearClassTimetable, bulkSaveTimetable,
  getTeacherSchedule, checkConflicts,
  getTimetableConfig, saveTimetableConfig,
  listTeacherAvailability, addTeacherAvailability, removeTeacherAvailability,
  generateTimetable, applyGeneratedTimetable,
};