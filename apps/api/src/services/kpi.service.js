// KPI & Reports — the Principal's Daily School Monitoring Report (docs/dailyreport.xlsx).
// Areas → Particulars form the catalog ("Data Sources"); admins customise it
// ("KPI Builder"); principals file one DailyReport per day with one entry per
// particular ("Reports Module"); numeric particulars (isKpi) feed the dashboard
// ("Formula Engine" / "KPI Dashboard"). See docs/NEW-MODULES-ARCHITECTURE.md.
const prisma = require('../lib/prisma');

const err = (status, message) => Object.assign(new Error(message), { status });

// Default template lifted directly from docs/dailyreport.xlsx. Cloned into a school
// the first time it opens the module; from then on the school owns/edits its copy,
// so hiding Hostel (day schools) or adding particulars never touches other schools.
// isKpi = numeric/aggregatable metric the dashboard trends.
const DEFAULT_TEMPLATE = [
  {
    name: 'School Academics',
    particulars: [
      { name: 'School reporting time', inputType: 'TEXT' },
      { name: 'Stand-up meeting', inputType: 'STATUS' },
      { name: 'School bus reporting status', inputType: 'STATUS' },
      { name: 'Assembly', inputType: 'STATUS' },
      { name: 'Announcement by Principal', inputType: 'TEXT' },
      { name: 'Teachers attendance (present)', inputType: 'NUMBER', isKpi: true },
      { name: 'Students attendance (present)', inputType: 'NUMBER', isKpi: true },
      { name: 'Activity / examination update', inputType: 'TEXT' },
      { name: 'Discipline issue', inputType: 'TEXT' },
      { name: 'Medical / health issue', inputType: 'TEXT' },
      { name: 'Smart class use', inputType: 'STATUS' },
      { name: 'Parents involvement', inputType: 'TEXT' },
      { name: 'Dispersal', inputType: 'STATUS' },
    ],
  },
  {
    name: 'Hostel',
    particulars: [
      { name: 'Hostel attendance', inputType: 'NUMBER', isKpi: true },
      { name: 'Complaint in hostel', inputType: 'TEXT' },
      { name: 'Admission / removal / withdrawal', inputType: 'TEXT' },
      { name: 'Food issue (previous day)', inputType: 'TEXT' },
    ],
  },
  {
    name: 'Administrative',
    particulars: [
      { name: 'Building / field / cleanliness', inputType: 'TEXT' },
      { name: 'Fixed assets / furniture / fittings', inputType: 'TEXT' },
      { name: 'Electrical / electronics / plumbing', inputType: 'TEXT' },
      { name: 'Transport / compliance / bus discipline', inputType: 'TEXT' },
      { name: "Principal's contribution / monitoring / observation", inputType: 'TEXT' },
      { name: 'Fee collection (today)', inputType: 'CURRENCY', isKpi: true },
      { name: 'Fee dues (outstanding)', inputType: 'CURRENCY', isKpi: true },
      { name: 'Daily class record', inputType: 'STATUS' },
      { name: 'Attendance register', inputType: 'STATUS' },
      { name: 'Absentee report', inputType: 'TEXT' },
      { name: 'Suggestion box / complaint register', inputType: 'TEXT' },
    ],
  },
];

// Clone the default template into a tenant that has none yet. Idempotent.
async function ensureTemplate(tenantId) {
  const count = await prisma.kpiArea.count({ where: { tenantId } });
  if (count > 0) return;
  for (let a = 0; a < DEFAULT_TEMPLATE.length; a++) {
    const area = DEFAULT_TEMPLATE[a];
    await prisma.kpiArea.create({
      data: {
        tenantId, name: area.name, order: a,
        particulars: {
          create: area.particulars.map((p, i) => ({
            name: p.name, inputType: p.inputType, isKpi: !!p.isKpi, order: i,
          })),
        },
      },
    });
  }
}

// ─── Catalog: Areas & Particulars (KPI Builder) ─────────────────────────────────

async function listAreas(tenantId, { includeInactive } = {}) {
  await ensureTemplate(tenantId);
  return prisma.kpiArea.findMany({
    where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
    include: { particulars: { where: includeInactive ? {} : { isActive: true }, orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  });
}

async function createArea(tenantId, { name, order }) {
  if (!name) throw err(422, 'Area name is required.');
  return prisma.kpiArea.create({ data: { tenantId, name: name.trim(), order: order ?? 0 } });
}

async function updateArea(tenantId, id, data) {
  const area = await prisma.kpiArea.findFirst({ where: { id, tenantId } });
  if (!area) throw err(404, 'Area not found.');
  const { name, order, isActive } = data;
  return prisma.kpiArea.update({
    where: { id },
    data: { ...(name !== undefined && { name: name.trim() }), ...(order !== undefined && { order }), ...(isActive !== undefined && { isActive }) },
  });
}

async function deleteArea(tenantId, id) {
  const area = await prisma.kpiArea.findFirst({ where: { id, tenantId } });
  if (!area) throw err(404, 'Area not found.');
  await prisma.kpiArea.delete({ where: { id } });
}

async function addParticular(tenantId, areaId, { name, inputType, isKpi, order }) {
  const area = await prisma.kpiArea.findFirst({ where: { id: areaId, tenantId } });
  if (!area) throw err(404, 'Area not found.');
  if (!name) throw err(422, 'Particular name is required.');
  return prisma.kpiParticular.create({
    data: { areaId, name: name.trim(), inputType: inputType || 'TEXT', isKpi: !!isKpi, order: order ?? 0 },
  });
}

async function updateParticular(tenantId, id, data) {
  const p = await prisma.kpiParticular.findFirst({ where: { id, area: { tenantId } } });
  if (!p) throw err(404, 'Particular not found.');
  const { name, inputType, isKpi, order, isActive } = data;
  return prisma.kpiParticular.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }), ...(inputType !== undefined && { inputType }),
      ...(isKpi !== undefined && { isKpi }), ...(order !== undefined && { order }), ...(isActive !== undefined && { isActive }),
    },
  });
}

async function deleteParticular(tenantId, id) {
  const p = await prisma.kpiParticular.findFirst({ where: { id, area: { tenantId } } });
  if (!p) throw err(404, 'Particular not found.');
  await prisma.kpiParticular.delete({ where: { id } });
}

// ─── Daily reports (Reports Module) ─────────────────────────────────────────────

const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// Create or update the report for a given date (one report per school per day).
// entries: [{ particularId, valueText?, valueNum?, remarks?, followUp? }]
async function saveReport(tenantId, userId, { reportDate, status, summary, entries }) {
  const date = dayStart(reportDate || new Date());
  const validParticulars = await prisma.kpiParticular.findMany({
    where: { area: { tenantId } }, select: { id: true },
  });
  const validIds = new Set(validParticulars.map((p) => p.id));
  const clean = (entries || []).filter((e) => validIds.has(e.particularId));

  return prisma.$transaction(async (tx) => {
    const report = await tx.dailyReport.upsert({
      where: { tenantId_reportDate: { tenantId, reportDate: date } },
      create: { tenantId, reportDate: date, preparedById: userId, status: status || 'DRAFT', summary: summary || null },
      update: { status: status || undefined, summary: summary !== undefined ? summary : undefined },
    });
    // Replace entries wholesale — simplest correct semantics for a daily form.
    await tx.dailyReportEntry.deleteMany({ where: { reportId: report.id } });
    if (clean.length) {
      await tx.dailyReportEntry.createMany({
        data: clean.map((e) => ({
          reportId: report.id, particularId: e.particularId,
          valueText: e.valueText ?? null,
          valueNum: e.valueNum != null && e.valueNum !== '' ? Number(e.valueNum) : null,
          remarks: e.remarks ?? null, followUp: e.followUp ?? null,
        })),
      });
    }
    return tx.dailyReport.findUnique({
      where: { id: report.id },
      include: { entries: true, preparedBy: { select: { firstName: true, lastName: true } } },
    });
  });
}

async function getReport(tenantId, reportDate) {
  const date = dayStart(reportDate);
  return prisma.dailyReport.findUnique({
    where: { tenantId_reportDate: { tenantId, reportDate: date } },
    include: {
      entries: { include: { particular: { select: { name: true, inputType: true, isKpi: true, areaId: true } } } },
      preparedBy: { select: { firstName: true, lastName: true } },
    },
  });
}

async function listReports(tenantId, { from, to, limit } = {}) {
  return prisma.dailyReport.findMany({
    where: {
      tenantId,
      ...(from || to ? { reportDate: { ...(from && { gte: dayStart(from) }), ...(to && { lte: dayStart(to) }) } } : {}),
    },
    orderBy: { reportDate: 'desc' },
    take: limit ? Number(limit) : 60,
    include: { preparedBy: { select: { firstName: true, lastName: true } }, _count: { select: { entries: true } } },
  });
}

// ─── Dashboard (Formula Engine) ─────────────────────────────────────────────────
// Trend the numeric KPI particulars over a window. Returns, per KPI particular, a
// dated series plus latest/sum/avg — the aggregates the dashboard renders.
async function dashboard(tenantId, { from, to } = {}) {
  await ensureTemplate(tenantId);
  const kpis = await prisma.kpiParticular.findMany({
    where: { isKpi: true, area: { tenantId } },
    include: { area: { select: { name: true } } },
    orderBy: { order: 'asc' },
  });
  const entries = await prisma.dailyReportEntry.findMany({
    where: {
      particularId: { in: kpis.map((k) => k.id) },
      valueNum: { not: null },
      report: { tenantId, ...(from || to ? { reportDate: { ...(from && { gte: dayStart(from) }), ...(to && { lte: dayStart(to) }) } } : {}) },
    },
    include: { report: { select: { reportDate: true } } },
    orderBy: { report: { reportDate: 'asc' } },
  });

  return kpis.map((k) => {
    const series = entries
      .filter((e) => e.particularId === k.id)
      .map((e) => ({ date: e.report.reportDate, value: e.valueNum }));
    const values = series.map((s) => s.value);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      id: k.id, name: k.name, area: k.area.name, inputType: k.inputType,
      series,
      latest: values.length ? values[values.length - 1] : null,
      sum, avg: values.length ? sum / values.length : null, count: values.length,
    };
  });
}

module.exports = {
  ensureTemplate,
  listAreas, createArea, updateArea, deleteArea,
  addParticular, updateParticular, deleteParticular,
  saveReport, getReport, listReports, dashboard,
};
