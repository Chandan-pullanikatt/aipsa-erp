const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { assertSectionInTenant } = require('../lib/tenantScope');
const svc = require('../services/timetable.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN','TEACHER','STUDENT','PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const adminOrTeacher = authorize('SCHOOL_ADMIN', 'TEACHER');
const adminOnly = authorize('SCHOOL_ADMIN');

// GET  /api/timetable?classId=&sectionId=&academicYear=
router.get('/', async (req, res, next) => {
  try {
    const { classId, sectionId, academicYear } = req.query;
    if (!classId) return res.status(422).json({ error: 'classId required' });
    await assertSectionInTenant(req.tenant.id, sectionId);
    res.json(await svc.getClassTimetable(req.tenant.id, classId, sectionId, academicYear));
  } catch (e) { next(e); }
});

// POST /api/timetable/period — upsert a single period
router.post('/period', adminOrTeacher, [
  body('classId').notEmpty(),
  body('dayOfWeek').isIn(['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']),
  body('periodNumber').isInt({ min: 1, max: 12 }),
  body('startTime').matches(/^\d{2}:\d{2}$/),
  body('endTime').matches(/^\d{2}:\d{2}$/),
], validate, async (req, res, next) => {
  try {
    await assertSectionInTenant(req.tenant.id, req.body.sectionId);
    res.json(await svc.savePeriod(req.tenant.id, req.body));
  } catch (e) { next(e); }
});

// DELETE /api/timetable/period — clear a single period
router.delete('/period', adminOnly, async (req, res, next) => {
  try {
    const { classId, sectionId, academicYear, dayOfWeek, periodNumber } = req.query;
    await assertSectionInTenant(req.tenant.id, sectionId);
    await svc.clearPeriod(req.tenant.id, classId, sectionId, academicYear, dayOfWeek, parseInt(periodNumber));
    res.json({ message: 'Cleared.' });
  } catch (e) { next(e); }
});

// POST /api/timetable/bulk — replace entire timetable for a class (or one section)
router.post('/bulk', adminOnly, [
  body('classId').notEmpty(),
  body('periods').isArray(),
], validate, async (req, res, next) => {
  try {
    const { classId, sectionId, academicYear, periods } = req.body;
    await assertSectionInTenant(req.tenant.id, sectionId);
    res.json(await svc.bulkSaveTimetable(req.tenant.id, classId, sectionId, academicYear, periods));
  } catch (e) { next(e); }
});

// DELETE /api/timetable/class — clear all periods for a class (or one section)
router.delete('/class', adminOnly, async (req, res, next) => {
  try {
    const { classId, sectionId, academicYear } = req.query;
    await assertSectionInTenant(req.tenant.id, sectionId);
    await svc.clearClassTimetable(req.tenant.id, classId, sectionId, academicYear);
    res.json({ message: 'Timetable cleared.' });
  } catch (e) { next(e); }
});

// GET /api/timetable/teacher?teacherId=&academicYear=
router.get('/teacher', async (req, res, next) => {
  try {
    const { teacherId, academicYear } = req.query;
    if (!teacherId) return res.status(422).json({ error: 'teacherId required' });
    res.json(await svc.getTeacherSchedule(req.tenant.id, teacherId, academicYear));
  } catch (e) { next(e); }
});

// GET /api/timetable/conflicts?classId=&sectionId=&academicYear=
router.get('/conflicts', adminOnly, async (req, res, next) => {
  try {
    const { classId, sectionId, academicYear } = req.query;
    if (!classId) return res.status(422).json({ error: 'classId required' });
    await assertSectionInTenant(req.tenant.id, sectionId);
    res.json(await svc.checkConflicts(req.tenant.id, classId, sectionId, academicYear));
  } catch (e) { next(e); }
});

// ─── Generation config (bell schedule) ───────────────────────────────────────

// GET /api/timetable/config?academicYear= — returns saved config or a default
router.get('/config', async (req, res, next) => {
  try {
    res.json(await svc.getTimetableConfig(req.tenant.id, req.query.academicYear));
  } catch (e) { next(e); }
});

// PUT /api/timetable/config — save the school's bell schedule
router.put('/config', adminOnly, [
  body('slots').optional().isArray(),
  body('workingDays').optional().isArray(),
  body('maxPeriodsPerDayPerTeacher').optional().isInt({ min: 1, max: 12 }),
], validate, async (req, res, next) => {
  try {
    res.json(await svc.saveTimetableConfig(req.tenant.id, req.body));
  } catch (e) { next(e); }
});

// ─── Teacher availability (blocked slots) ─────────────────────────────────────

// GET /api/timetable/availability?teacherId=&academicYear=
router.get('/availability', adminOrTeacher, async (req, res, next) => {
  try {
    const { teacherId, academicYear } = req.query;
    res.json(await svc.listTeacherAvailability(req.tenant.id, teacherId, academicYear));
  } catch (e) { next(e); }
});

// POST /api/timetable/availability — block a slot (or whole day if no periodNumber)
router.post('/availability', adminOnly, [
  body('teacherId').notEmpty(),
  body('dayOfWeek').isIn(['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']),
  body('periodNumber').optional({ nullable: true }).isInt({ min: 1, max: 12 }),
], validate, async (req, res, next) => {
  try {
    res.status(201).json(await svc.addTeacherAvailability(req.tenant.id, req.body));
  } catch (e) { next(e); }
});

// DELETE /api/timetable/availability/:id — unblock
router.delete('/availability/:id', adminOnly, async (req, res, next) => {
  try {
    await svc.removeTeacherAvailability(req.tenant.id, req.params.id);
    res.json({ message: 'Removed.' });
  } catch (e) { next(e); }
});

// ─── Auto-generation ──────────────────────────────────────────────────────────

// POST /api/timetable/generate — build a draft timetable for all classes (no write)
router.post('/generate', adminOnly, [
  body('seed').optional().isInt(),
], validate, async (req, res, next) => {
  try {
    const seed = req.body.seed != null ? parseInt(req.body.seed) : undefined;
    res.json(await svc.generateTimetable(req.tenant.id, req.body.academicYear, { seed }));
  } catch (e) { next(e); }
});

// POST /api/timetable/generate/apply — persist reviewed drafts for all classes
router.post('/generate/apply', adminOnly, [
  body('drafts').isArray({ min: 1 }),
], validate, async (req, res, next) => {
  try {
    res.json(await svc.applyGeneratedTimetable(req.tenant.id, req.body.academicYear, req.body.drafts));
  } catch (e) { next(e); }
});

// GET /api/timetable/academic-year
router.get('/academic-year', (req, res) => {
  res.json({ academicYear: svc.currentAcademicYear() });
});

module.exports = router;