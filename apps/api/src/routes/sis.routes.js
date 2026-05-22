const { Router } = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const sis = require('../services/sis.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

const adminOnly = authorize('SCHOOL_ADMIN');

// ─── Classes ─────────────────────────────────────────────────────────────────

router.get('/classes', async (req, res, next) => {
  try {
    res.json(await sis.listClasses(req.tenant.id));
  } catch (err) { next(err); }
});

router.post('/classes', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.status(201).json(await sis.createClass(req.tenant.id, req.body));
  } catch (err) { next(err); }
});

router.put('/classes/:id', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.json(await sis.updateClass(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

router.delete('/classes/:id', adminOnly, async (req, res, next) => {
  try {
    await sis.deleteClass(req.tenant.id, req.params.id);
    res.json({ message: 'Class deleted.' });
  } catch (err) { next(err); }
});

// ─── Sections ────────────────────────────────────────────────────────────────

router.get('/classes/:classId/sections', async (req, res, next) => {
  try {
    res.json(await sis.listSections(req.tenant.id, req.params.classId));
  } catch (err) { next(err); }
});

router.post('/classes/:classId/sections', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.status(201).json(await sis.createSection(req.tenant.id, req.params.classId, req.body));
  } catch (err) { next(err); }
});

router.put('/sections/:id', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.json(await sis.updateSection(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

router.delete('/sections/:id', adminOnly, async (req, res, next) => {
  try {
    await sis.deleteSection(req.tenant.id, req.params.id);
    res.json({ message: 'Section deleted.' });
  } catch (err) { next(err); }
});

// ─── Students ────────────────────────────────────────────────────────────────

router.get('/students', async (req, res, next) => {
  try {
    const { classId, sectionId, status, search, page, limit } = req.query;
    res.json(await sis.listStudents(req.tenant.id, { classId, sectionId, status, search, page, limit }));
  } catch (err) { next(err); }
});

router.post('/students', adminOnly, [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
], validate, async (req, res, next) => {
  try {
    res.status(201).json(await sis.createStudent(req.tenant.id, req.body));
  } catch (err) { next(err); }
});

router.get('/students/:id', async (req, res, next) => {
  try {
    res.json(await sis.getStudent(req.tenant.id, req.params.id));
  } catch (err) { next(err); }
});

router.put('/students/:id', adminOnly, async (req, res, next) => {
  try {
    res.json(await sis.updateStudent(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

// ─── Guardians ───────────────────────────────────────────────────────────────

router.get('/students/:studentId/guardians', async (req, res, next) => {
  try {
    res.json(await sis.listGuardians(req.tenant.id, req.params.studentId));
  } catch (err) { next(err); }
});

router.post('/students/:studentId/guardians', adminOnly, [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('relation').notEmpty(),
  body('phone').notEmpty(),
], validate, async (req, res, next) => {
  try {
    res.status(201).json(await sis.createGuardian(req.tenant.id, req.params.studentId, req.body));
  } catch (err) { next(err); }
});

router.put('/guardians/:id', adminOnly, async (req, res, next) => {
  try {
    res.json(await sis.updateGuardian(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

router.delete('/guardians/:id', adminOnly, async (req, res, next) => {
  try {
    await sis.deleteGuardian(req.tenant.id, req.params.id);
    res.json({ message: 'Guardian deleted.' });
  } catch (err) { next(err); }
});

// GET /api/sis/students/:id/portal-pin — admin only
router.get('/students/:id/portal-pin', adminOnly, async (req, res, next) => {
  try {
    res.json(await sis.getPortalPin(req.tenant.id, req.params.id));
  } catch (err) { next(err); }
});

// GET /api/sis/parent/students
router.get('/parent/students', authorize('PARENT'), async (req, res, next) => {
  try {
    res.json(await sis.getParentStudents(req.tenant.id, req.user.id));
  } catch (err) { next(err); }
});

// GET /api/sis/student/profile
router.get('/student/profile', authorize('STUDENT'), async (req, res, next) => {
  try {
    res.json(await sis.getStudentByUserId(req.tenant.id, req.user.id));
  } catch (err) { next(err); }
});

module.exports = router;
