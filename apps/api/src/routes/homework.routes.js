const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const svc = require('../services/homework.service');
const prisma = require('../lib/prisma');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN','TEACHER','STUDENT','PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

// GET  /api/homework — list (teacher sees own, admin sees all, student sees their class)
router.get('/', async (req, res, next) => {
  try {
    const u = req.user;
    const filter = { ...req.query };
    if (u.role === 'TEACHER') filter.teacherId = u.id;
    res.json(await svc.listHomework(req.tenant.id, filter));
  } catch (e) { next(e); }
});

// POST /api/homework
router.post('/', authorize('SCHOOL_ADMIN', 'TEACHER'), [
  body('classId').notEmpty(),
  body('title').trim().notEmpty(),
], validate, async (req, res, next) => {
  try {
    const teacherId = req.user.role === 'TEACHER' ? req.user.id : req.body.teacherId;
    if (!teacherId) return res.status(422).json({ error: 'teacherId required' });
    res.status(201).json(await svc.createHomework(req.tenant.id, teacherId, req.body));
  } catch (e) { next(e); }
});

// PUT /api/homework/:id
router.put('/:id', authorize('SCHOOL_ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    res.json(await svc.updateHomework(req.tenant.id, req.params.id, req.user.id, req.body));
  } catch (e) { next(e); }
});

// DELETE /api/homework/:id
router.delete('/:id', authorize('SCHOOL_ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    await svc.deleteHomework(req.tenant.id, req.params.id, req.user.id, req.user.role);
    res.json({ message: 'Deleted.' });
  } catch (e) { next(e); }
});

// GET /api/homework/my-classes — teacher's assigned classes
router.get('/my-classes', authorize('TEACHER'), async (req, res, next) => {
  try {
    res.json(await svc.getTeacherClasses(req.tenant.id, req.user.id));
  } catch (e) { next(e); }
});

// POST /api/homework/:id/submit — student submits homework
router.post('/:id/submit', authorize('STUDENT'), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { tenantId: req.tenant.id, userId: req.user.id },
    });
    if (!student) return res.status(403).json({ error: 'No student profile linked.' });
    const result = await svc.submitHomework(req.tenant.id, req.params.id, student.id, req.body);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// GET /api/homework/:id/my-submission — student views their own submission
router.get('/:id/my-submission', authorize('STUDENT'), async (req, res, next) => {
  try {
    const student = await prisma.student.findFirst({
      where: { tenantId: req.tenant.id, userId: req.user.id },
    });
    if (!student) return res.json(null);
    const sub = await svc.getMySubmission(req.tenant.id, req.params.id, student.id);
    res.json(sub);
  } catch (e) { next(e); }
});

// GET /api/homework/:id/submissions — teacher/admin views all submissions
router.get('/:id/submissions', authorize('SCHOOL_ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    res.json(await svc.getSubmissions(req.tenant.id, req.params.id));
  } catch (e) { next(e); }
});

// PATCH /api/homework/:id/submissions/:subId/grade — teacher grades a submission
router.patch('/:id/submissions/:subId/grade', authorize('SCHOOL_ADMIN', 'TEACHER'), [
  body('grade').optional().trim(),
  body('feedback').optional().trim(),
], validate, async (req, res, next) => {
  try {
    const result = await svc.gradeSubmission(req.tenant.id, req.params.subId, req.user.id, req.body);
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;