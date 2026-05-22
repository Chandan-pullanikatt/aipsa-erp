const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
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

// GET  /api/timetable?classId=&academicYear=
router.get('/', async (req, res, next) => {
  try {
    const { classId, academicYear } = req.query;
    if (!classId) return res.status(422).json({ error: 'classId required' });
    res.json(await svc.getClassTimetable(req.tenant.id, classId, academicYear));
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
    res.json(await svc.savePeriod(req.tenant.id, req.body));
  } catch (e) { next(e); }
});

// DELETE /api/timetable/period — clear a single period
router.delete('/period', adminOnly, async (req, res, next) => {
  try {
    const { classId, academicYear, dayOfWeek, periodNumber } = req.query;
    await svc.clearPeriod(req.tenant.id, classId, academicYear, dayOfWeek, parseInt(periodNumber));
    res.json({ message: 'Cleared.' });
  } catch (e) { next(e); }
});

// POST /api/timetable/bulk — replace entire timetable for a class
router.post('/bulk', adminOnly, [
  body('classId').notEmpty(),
  body('periods').isArray(),
], validate, async (req, res, next) => {
  try {
    const { classId, academicYear, periods } = req.body;
    res.json(await svc.bulkSaveTimetable(req.tenant.id, classId, academicYear, periods));
  } catch (e) { next(e); }
});

// DELETE /api/timetable/class — clear all periods for a class
router.delete('/class', adminOnly, async (req, res, next) => {
  try {
    const { classId, academicYear } = req.query;
    await svc.clearClassTimetable(req.tenant.id, classId, academicYear);
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

// GET /api/timetable/conflicts?classId=&academicYear=
router.get('/conflicts', adminOnly, async (req, res, next) => {
  try {
    const { classId, academicYear } = req.query;
    if (!classId) return res.status(422).json({ error: 'classId required' });
    res.json(await svc.checkConflicts(req.tenant.id, classId, academicYear));
  } catch (e) { next(e); }
});

// GET /api/timetable/academic-year
router.get('/academic-year', (req, res) => {
  res.json({ academicYear: svc.currentAcademicYear() });
});

module.exports = router;