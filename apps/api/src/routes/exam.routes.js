const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const svc = require('../services/exam.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN','TEACHER','STUDENT','PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const adminOrTeacher = authorize('SCHOOL_ADMIN', 'TEACHER');
const adminOnly = authorize('SCHOOL_ADMIN');

// ─── Subjects ─────────────────────────────────────────────────────────────────
router.get('/subjects', async (req, res, next) => {
  try { res.json(await svc.listSubjects(req.tenant.id, req.query)); } catch (e) { next(e); }
});
router.post('/subjects', adminOnly, [
  body('classId').notEmpty(), body('name').trim().notEmpty(),
  body('periodsPerWeek').optional().isInt({ min: 0, max: 40 }),
  body('teachers').optional().isArray({ max: 20 }),
  body('teachers.*.teacherId').optional().notEmpty(),
], validate, async (req, res, next) => {
  try { res.status(201).json(await svc.createSubject(req.tenant.id, req.body)); } catch (e) { next(e); }
});
// Same subject across many classes in one submit.
router.post('/subjects/bulk', adminOnly, [
  body('classIds').isArray({ min: 1, max: 60 }),
  body('name').trim().notEmpty(),
  body('periodsPerWeek').optional().isInt({ min: 0, max: 40 }),
  body('teachers').optional().isArray({ max: 20 }),
  body('teachers.*.teacherId').optional().notEmpty(),
], validate, async (req, res, next) => {
  try { res.status(201).json(await svc.createSubjectsBulk(req.tenant.id, req.body)); } catch (e) { next(e); }
});

router.put('/subjects/:id', adminOnly, [
  body('periodsPerWeek').optional().isInt({ min: 0, max: 40 }),
  body('teachers').optional().isArray({ max: 20 }),
  body('teachers.*.teacherId').optional().notEmpty(),
], validate, async (req, res, next) => {
  try { res.json(await svc.updateSubject(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
// Teacher-centric view of every class × subject, and a bulk save of one
// teacher's assignments across all of them.
router.get('/teachers/:teacherId/teaching-grid', adminOnly, async (req, res, next) => {
  try { res.json(await svc.getTeachingGrid(req.tenant.id, req.params.teacherId)); } catch (e) { next(e); }
});
router.put('/teachers/:teacherId/subjects', adminOnly, [
  body('assignments').isArray({ max: 400 }),
  body('assignments.*.subjectId').notEmpty(),
], validate, async (req, res, next) => {
  try { res.json(await svc.setTeacherSubjects(req.tenant.id, req.params.teacherId, req.body.assignments)); } catch (e) { next(e); }
});

router.delete('/subjects/:id', adminOnly, async (req, res, next) => {
  try { await svc.deleteSubject(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Exams ────────────────────────────────────────────────────────────────────
router.get('/exams', async (req, res, next) => {
  try { res.json(await svc.listExams(req.tenant.id, req.query)); } catch (e) { next(e); }
});
router.post('/exams', adminOnly, [
  body('name').trim().notEmpty(),
  body('classId').notEmpty(),
  body('startDate').isISO8601(),
], validate, async (req, res, next) => {
  try { res.status(201).json(await svc.createExam(req.tenant.id, req.body)); } catch (e) { next(e); }
});
// Same exam term scheduled across many classes in one submit.
router.post('/exams/bulk', adminOnly, [
  body('name').trim().notEmpty(),
  body('classIds').isArray({ min: 1, max: 60 }),
  body('startDate').isISO8601(),
], validate, async (req, res, next) => {
  try { res.status(201).json(await svc.createExamsBulk(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.put('/exams/:id', adminOrTeacher, async (req, res, next) => {
  try { res.json(await svc.updateExam(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/exams/:id', adminOnly, async (req, res, next) => {
  try { await svc.deleteExam(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});
router.get('/exams/:id/summary', async (req, res, next) => {
  try { res.json(await svc.getExamSummary(req.tenant.id, req.params.id)); } catch (e) { next(e); }
});

// ─── Marks Entry ─────────────────────────────────────────────────────────────
router.get('/exams/:examId/marks/:subjectId', adminOrTeacher, async (req, res, next) => {
  try { res.json(await svc.getMarksEntry(req.tenant.id, req.params.examId, req.params.subjectId)); } catch (e) { next(e); }
});
router.post('/exams/:examId/marks/:subjectId', adminOrTeacher, [
  body('records').isArray({ min: 1 }),
], validate, async (req, res, next) => {
  try {
    const saved = await svc.saveMarks(req.tenant.id, req.params.examId, req.params.subjectId, req.body.records);
    res.json({ saved: saved.length });
  } catch (e) { next(e); }
});

// ─── Report Card ──────────────────────────────────────────────────────────────
router.get('/report-card/:studentId', async (req, res, next) => {
  try { res.json(await svc.getStudentReportCard(req.tenant.id, req.params.studentId, req.query.academicYear)); } catch (e) { next(e); }
});

// ─── Academic Year ────────────────────────────────────────────────────────────
router.get('/academic-year', (req, res) => {
  res.json({ academicYear: svc.currentAcademicYear() });
});

module.exports = router;