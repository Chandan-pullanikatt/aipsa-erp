const prisma = require('../lib/prisma');
const { SUBJECT_TEACHERS_INCLUDE, teachersForSection } = require('../lib/subjectTeachers');

const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 3 ? `${y}-${String(y+1).slice(-2)}` : `${y-1}-${String(y).slice(-2)}`;
}

// A class with sections is scheduled section by section; a class with none keeps
// one class-wide (sectionId null) timetable. Every read/write below takes an
// optional sectionId and treats its absence as "the class-wide grid".

async function getClassTimetable(tenantId, classId, sectionId, academicYear) {
  const year = academicYear || currentAcademicYear();
  const periods = await prisma.period.findMany({
    where: { tenantId, classId, sectionId: sectionId || null, academicYear: year },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
  });
  return { periods, academicYear: year };
}

async function savePeriod(tenantId, data) {
  const { classId, sectionId, academicYear, dayOfWeek, periodNumber, startTime, endTime, subjectId, teacherId, isBreak, breakLabel } = data;
  const year = academicYear || currentAcademicYear();
  const sid = sectionId || null;

  // Conflict detection: teacher already assigned elsewhere at same day + time.
  // "Elsewhere" now means any other section too — sections of the same class can
  // share a teacher at the same slot just as easily as two different classes can.
  if (teacherId && !isBreak) {
    const conflicts = await prisma.period.findMany({
      where: {
        tenantId, teacherId, dayOfWeek, academicYear: year, isBreak: false,
        NOT: { classId, sectionId: sid },
      },
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });

    const overlap = conflicts.filter(c => c.startTime < endTime && c.endTime > startTime);

    if (overlap.length > 0) {
      const names = overlap.map(c => c.section ? `${c.class.name} · Sec ${c.section.name}` : c.class.name).join(', ');
      throw Object.assign(
        new Error(`Conflict: Teacher already assigned to ${names} at this time on ${dayOfWeek}`),
        { status: 409, conflicts: overlap }
      );
    }
  }

  const key = { tenantId, classId, sectionId: sid, academicYear: year, dayOfWeek, periodNumber };
  return prisma.period.upsert({
    where: { tenantId_classId_sectionId_academicYear_dayOfWeek_periodNumber: key },
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

async function clearPeriod(tenantId, classId, sectionId, academicYear, dayOfWeek, periodNumber) {
  await prisma.period.deleteMany({
    where: { tenantId, classId, sectionId: sectionId || null, academicYear, dayOfWeek, periodNumber },
  });
}

async function clearClassTimetable(tenantId, classId, sectionId, academicYear) {
  await prisma.period.deleteMany({
    where: { tenantId, classId, sectionId: sectionId || null, academicYear },
  });
}

async function bulkSaveTimetable(tenantId, classId, sectionId, academicYear, periods) {
  const year = academicYear || currentAcademicYear();
  const sid = sectionId || null;
  // Clear existing and replace
  await prisma.period.deleteMany({ where: { tenantId, classId, sectionId: sid, academicYear: year } });
  if (periods.length === 0) return [];
  await prisma.period.createMany({
    data: periods.map(p => ({
      tenantId, classId, sectionId: sid, academicYear: year,
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
  return getClassTimetable(tenantId, classId, sid, year);
}

async function getTeacherSchedule(tenantId, teacherId, academicYear) {
  const year = academicYear || currentAcademicYear();
  return prisma.period.findMany({
    where: { tenantId, teacherId, academicYear: year },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
  });
}

async function checkConflicts(tenantId, classId, sectionId, academicYear) {
  const year = academicYear || currentAcademicYear();
  const periods = await prisma.period.findMany({
    where: { tenantId, classId, sectionId: sectionId || null, academicYear: year, teacherId: { not: null }, isBreak: false },
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
  { periodNumber: 1, startTime: '09:00', endTime: '09:45' },
  { periodNumber: 2, startTime: '09:45', endTime: '10:30' },
  { periodNumber: 3, startTime: '10:30', endTime: '10:45', isBreak: true, breakLabel: 'Short Break' },
  { periodNumber: 4, startTime: '10:45', endTime: '11:30' },
  { periodNumber: 5, startTime: '11:30', endTime: '12:15' },
  { periodNumber: 6, startTime: '12:15', endTime: '13:00', isBreak: true, breakLabel: 'Lunch Break' },
  { periodNumber: 7, startTime: '13:00', endTime: '13:45' },
  { periodNumber: 8, startTime: '13:45', endTime: '14:30' },
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

function unitKey(classId, sectionId) { return `${classId}|${sectionId || ''}`; }
function unitLabel(className, sectionName) { return sectionName ? `${className} · Sec ${sectionName}` : className; }

// Builds a conflict-free draft timetable for every scheduling unit (a section, or
// a whole class if it has no sections) across the entire school for one academic
// year. Pure read + compute; nothing is written — the caller reviews then applies.
// Teachers are shared across units, and every unit's demands are solved together
// in one pass, so a teacher can never end up double-booked across two sections or
// two grades in the result.
async function generateTimetable(tenantId, academicYear, { seed } = {}) {
  const year = academicYear || currentAcademicYear();
  const config = await getTimetableConfig(tenantId, year);
  const workingDays = Array.isArray(config.workingDays) && config.workingDays.length ? config.workingDays : DAYS;
  const slots = Array.isArray(config.slots) && config.slots.length ? config.slots : DEFAULT_SLOTS;
  const teachingSlots = slots.filter((s) => !s.isBreak);
  const maxPerDay = Number.isInteger(config.maxPeriodsPerDayPerTeacher) ? config.maxPeriodsPerDayPerTeacher : 6;

  const [classes, subjects, availability] = await Promise.all([
    prisma.class.findMany({
      where: { tenantId },
      select: { id: true, name: true, sections: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
    }),
    prisma.subject.findMany({ where: { tenantId }, include: SUBJECT_TEACHERS_INCLUDE }),
    prisma.teacherAvailability.findMany({ where: { tenantId, academicYear: year } }),
  ]);

  // Scheduling units: one per section if the class has any, else the class itself.
  const units = [];
  for (const c of classes) {
    if (c.sections.length > 0) {
      for (const s of c.sections) units.push({ classId: c.id, className: c.name, sectionId: s.id, sectionName: s.name });
    } else {
      units.push({ classId: c.id, className: c.name, sectionId: null, sectionName: null });
    }
  }
  const subjectsByClass = new Map();
  for (const s of subjects) {
    if (!subjectsByClass.has(s.classId)) subjectsByClass.set(s.classId, []);
    subjectsByClass.get(s.classId).push(s);
  }

  // Teaching cells = working days × non-break slots. Same grid for every unit.
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
  const teacherNames = new Map();
  for (const u of units) {
    const unitSubjects = subjectsByClass.get(u.classId) || [];
    let load = 0;
    for (const s of unitSubjects) {
      if (s.periodsPerWeek <= 0) continue;
      const resolved = teachersForSection(s, u.sectionId)[0];
      if (!resolved) {
        warnings.push(`${unitLabel(u.className, u.sectionName)} · ${s.name}: needs ${s.periodsPerWeek} period(s) but has no teacher assigned — skipped.`);
        continue;
      }
      load += s.periodsPerWeek;
      teacherLoad.set(resolved.id, (teacherLoad.get(resolved.id) || 0) + s.periodsPerWeek);
      teacherNames.set(resolved.id, `${resolved.firstName} ${resolved.lastName}`);
    }
    if (load > totalCells) warnings.push(`${unitLabel(u.className, u.sectionName)} needs ${load} periods but the grid only has ${totalCells} teaching slots.`);
  }
  for (const [tid, load] of teacherLoad) {
    const free = freeSlotCount(tid);
    if (load > free) {
      warnings.push(`${teacherNames.get(tid) || 'A teacher'} is assigned ${load} periods but only has ${free} free slot(s).`);
    }
  }

  // ── Expand demands (one lesson unit per period needed) ──
  const demands = [];
  for (const u of units) {
    const unitSubjects = subjectsByClass.get(u.classId) || [];
    for (const s of unitSubjects) {
      if (s.periodsPerWeek <= 0) continue;
      const resolved = teachersForSection(s, u.sectionId)[0];
      if (!resolved) continue;
      for (let i = 0; i < s.periodsPerWeek; i++) {
        demands.push({
          classId: u.classId, sectionId: u.sectionId, unitKey: unitKey(u.classId, u.sectionId),
          subjectId: s.id, subjectName: s.name, teacherId: resolved.id,
          teacherFreedom: freeSlotCount(resolved.id),
        });
      }
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

  // ── Build per-unit drafts (full grid incl. breaks) ──
  const placedByCell = new Map(); // `${unitKey}-${day}-${pn}` -> placement
  for (const p of best.placements) placedByCell.set(`${p.unitKey}-${p.day}-${p.periodNumber}`, p);

  const drafts = units.map((u) => {
    const uKey = unitKey(u.classId, u.sectionId);
    const periods = [];
    for (const day of workingDays) {
      for (const s of slots) {
        const placed = !s.isBreak ? placedByCell.get(`${uKey}-${day}-${s.periodNumber}`) : null;
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
    return { classId: u.classId, sectionId: u.sectionId, className: u.className, sectionName: u.sectionName, label: unitLabel(u.className, u.sectionName), periods };
  });

  // Summarise unplaced demands per unit+subject for a plain-English report.
  const unitByKey = new Map(units.map((u) => [unitKey(u.classId, u.sectionId), u]));
  const unplacedSummary = {};
  for (const d of best.unplaced) {
    const key = `${d.unitKey}|${d.subjectId}`;
    if (!unplacedSummary[key]) {
      const u = unitByKey.get(d.unitKey);
      unplacedSummary[key] = { label: u ? unitLabel(u.className, u.sectionName) : 'Class', subjectName: d.subjectName, count: 0 };
    }
    unplacedSummary[key].count++;
  }
  const unplaced = Object.values(unplacedSummary).map((u) => `${u.label} · ${u.subjectName}: ${u.count} period(s) could not be placed.`);

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
  const unitOcc = new Set();
  const teacherOcc = new Set();
  const subjDay = new Map();    // `${unitKey}-${subjectId}-${day}` -> count
  const teacherDay = new Map(); // `${teacherId}-${day}` -> count
  const unitDay = new Map();    // `${unitKey}-${day}` -> count
  const placements = [];
  const unplaced = [];

  // Most-constrained-first: teachers with least freedom placed first; small
  // random tie-break makes each restart explore a different ordering.
  const ordered = [...demands].sort((a, b) => a.teacherFreedom - b.teacherFreedom || rng() - 0.5);

  for (const d of ordered) {
    let bestCell = null;
    let bestScore = -Infinity;
    for (const cell of cells) {
      if (unitOcc.has(`${d.unitKey}-${cell.day}-${cell.periodNumber}`)) continue;
      if (teacherOcc.has(`${d.teacherId}-${cell.day}-${cell.periodNumber}`)) continue;
      if (isBlocked(d.teacherId, cell.day, cell.periodNumber)) continue;

      let score = 0;
      const sameSubjToday = subjDay.get(`${d.unitKey}-${d.subjectId}-${cell.day}`) || 0;
      const tDay = teacherDay.get(`${d.teacherId}-${cell.day}`) || 0;
      const cDay = unitDay.get(`${d.unitKey}-${cell.day}`) || 0;
      score -= sameSubjToday * 100;        // spread a subject across the week
      score -= tDay * 3;                    // balance each teacher's daily load
      score -= cDay;                        // balance each unit's daily load
      if (tDay >= maxPerDay) score -= 500;  // soft cap on teacher periods/day
      score += rng() * 0.5;                 // tie-break
      if (score > bestScore) { bestScore = score; bestCell = cell; }
    }

    if (!bestCell) { unplaced.push(d); continue; }
    unitOcc.add(`${d.unitKey}-${bestCell.day}-${bestCell.periodNumber}`);
    teacherOcc.add(`${d.teacherId}-${bestCell.day}-${bestCell.periodNumber}`);
    subjDay.set(`${d.unitKey}-${d.subjectId}-${bestCell.day}`, (subjDay.get(`${d.unitKey}-${d.subjectId}-${bestCell.day}`) || 0) + 1);
    teacherDay.set(`${d.teacherId}-${bestCell.day}`, (teacherDay.get(`${d.teacherId}-${bestCell.day}`) || 0) + 1);
    unitDay.set(`${d.unitKey}-${bestCell.day}`, (unitDay.get(`${d.unitKey}-${bestCell.day}`) || 0) + 1);
    placements.push({ classId: d.classId, sectionId: d.sectionId, unitKey: d.unitKey, subjectId: d.subjectId, teacherId: d.teacherId, day: bestCell.day, periodNumber: bestCell.periodNumber });
  }

  return { placements, unplaced };
}

// Persists reviewed drafts — replaces each unit's grid for the year in one
// transaction so a partial failure can't leave a half-applied timetable. The
// caller (frontend) decides which units to include — units the admin chose to
// keep as manually-edited are simply left out of `drafts`.
async function applyGeneratedTimetable(tenantId, academicYear, drafts) {
  const year = academicYear || currentAcademicYear();
  await prisma.$transaction(
    drafts.flatMap((d) => {
      const sectionId = d.sectionId || null;
      return [
        prisma.period.deleteMany({ where: { tenantId, classId: d.classId, sectionId, academicYear: year } }),
        prisma.period.createMany({
          data: d.periods.map((p) => ({
            tenantId, classId: d.classId, sectionId, academicYear: year,
            dayOfWeek: p.dayOfWeek, periodNumber: p.periodNumber,
            startTime: p.startTime, endTime: p.endTime,
            subjectId: p.subjectId || null, teacherId: p.teacherId || null,
            isBreak: p.isBreak || false, breakLabel: p.breakLabel || null,
          })),
        }),
      ];
    })
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
