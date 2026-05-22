const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const svc = require('../services/attendance.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

const adminOrTeacher = authorize('SCHOOL_ADMIN', 'TEACHER');
const adminOnly = authorize('SCHOOL_ADMIN');

// ─── Student Attendance ──────────────────────────────────────────────────────

// POST /api/attendance/students/mark
router.post('/students/mark', adminOrTeacher, [
  body('date').isISO8601(),
  body('classId').notEmpty(),
  body('records').isArray({ min: 1 }),
], validate, async (req, res, next) => {
  try {
    const result = await svc.markStudentAttendance(req.tenant.id, req.user.id, req.body);
    res.json({ marked: result.length });
  } catch (err) { next(err); }
});

// GET /api/attendance/students — query: classId, sectionId, date, studentId
router.get('/students', async (req, res, next) => {
  try {
    res.json(await svc.getStudentAttendance(req.tenant.id, req.query));
  } catch (err) { next(err); }
});

// GET /api/attendance/students/report — query: studentId, fromDate, toDate
router.get('/students/report', async (req, res, next) => {
  try {
    const { studentId, fromDate, toDate } = req.query;
    if (!studentId || !fromDate || !toDate) return res.status(422).json({ error: 'studentId, fromDate, toDate required' });
    res.json(await svc.getStudentAttendanceReport(req.tenant.id, studentId, { fromDate, toDate }));
  } catch (err) { next(err); }
});

// GET /api/attendance/students/summary — query: classId, sectionId, date
router.get('/students/summary', adminOrTeacher, async (req, res, next) => {
  try {
    const { classId, date } = req.query;
    if (!classId || !date) return res.status(422).json({ error: 'classId and date required' });
    res.json(await svc.getClassAttendanceSummary(req.tenant.id, req.query));
  } catch (err) { next(err); }
});

// ─── Teacher Attendance ──────────────────────────────────────────────────────

// POST /api/attendance/teachers/mark
router.post('/teachers/mark', adminOnly, [
  body('userId').notEmpty(),
  body('date').isISO8601(),
  body('status').isIn(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY']),
], validate, async (req, res, next) => {
  try {
    res.json(await svc.markTeacherAttendance(req.tenant.id, req.user.id, req.body));
  } catch (err) { next(err); }
});

// GET /api/attendance/teachers
router.get('/teachers', adminOnly, async (req, res, next) => {
  try {
    res.json(await svc.getTeacherAttendance(req.tenant.id, req.query));
  } catch (err) { next(err); }
});

// ─── Leave ───────────────────────────────────────────────────────────────────

// POST /api/attendance/leave
router.post('/leave', [
  body('fromDate').isISO8601(),
  body('toDate').isISO8601(),
  body('reason').trim().notEmpty(),
], validate, async (req, res, next) => {
  try {
    const user = req.user;
    const applicant = user.role === 'TEACHER' ? { userId: user.id } : { userId: user.id };
    res.status(201).json(await svc.applyLeave(req.tenant.id, applicant, req.body));
  } catch (err) { next(err); }
});

// GET /api/attendance/leave
router.get('/leave', async (req, res, next) => {
  try {
    const user = req.user;
    const filter = { ...req.query };
    if (user.role === 'TEACHER') filter.userId = user.id;
    if (user.role === 'STUDENT' || user.role === 'PARENT') filter.userId = user.id;
    res.json(await svc.listLeaves(req.tenant.id, filter));
  } catch (err) { next(err); }
});

// PATCH /api/attendance/leave/:id/review
router.patch('/leave/:id/review', adminOnly, [
  body('status').isIn(['APPROVED', 'REJECTED']),
], validate, async (req, res, next) => {
  try {
    res.json(await svc.reviewLeave(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

// POST /api/attendance/send-daily-summary
router.post('/send-daily-summary', adminOnly, async (req, res, next) => {
  try {
    res.json(await svc.sendDailySummaryEmail(req.tenant.id));
  } catch (err) { next(err); }
});

module.exports = router;