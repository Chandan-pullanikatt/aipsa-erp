const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const svc = require('../services/homework.service');

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

module.exports = router;