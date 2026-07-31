const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const svc = require('../services/progress.service');
const sis = require('../services/sis.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const adminOnly = authorize('SCHOOL_ADMIN');
const adminOrTeacher = authorize('SCHOOL_ADMIN', 'TEACHER');

// ─── CCA areas (admin config) ────────────────────────────────────────────────
router.get('/cca/areas', adminOrTeacher, async (req, res, next) => {
  try { res.json(await svc.listCcaAreas(req.tenant.id, req.query)); } catch (e) { next(e); }
});
router.post('/cca/areas', adminOnly, [
  body('classId').notEmpty(), body('name').trim().notEmpty(),
], validate, async (req, res, next) => {
  try { res.status(201).json(await svc.createCcaArea(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.put('/cca/areas/:id', adminOnly, async (req, res, next) => {
  try { res.json(await svc.updateCcaArea(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/cca/areas/:id', adminOnly, async (req, res, next) => {
  try { await svc.deleteCcaArea(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── CCA grading (CCA teacher / admin) ───────────────────────────────────────
router.get('/cca/entry', adminOrTeacher, async (req, res, next) => {
  try { res.json(await svc.getCcaEntry(req.tenant.id, req.user, req.query)); } catch (e) { next(e); }
});
router.post('/cca/entry', adminOrTeacher, [
  body('term').notEmpty(), body('records').isArray({ min: 1 }),
], validate, async (req, res, next) => {
  try { res.json(await svc.saveCcaGrades(req.tenant.id, req.user, req.body)); } catch (e) { next(e); }
});

// ─── Progress term entry + publish (class teacher / admin) ───────────────────
router.get('/entry', adminOrTeacher, async (req, res, next) => {
  try { res.json(await svc.getProgressEntry(req.tenant.id, req.user, req.query)); } catch (e) { next(e); }
});
router.post('/entry', adminOrTeacher, [
  body('studentId').notEmpty(), body('term').notEmpty(),
], validate, async (req, res, next) => {
  try { res.json(await svc.saveProgressTerm(req.tenant.id, req.user, req.body)); } catch (e) { next(e); }
});
router.post('/publish', adminOrTeacher, [
  body('studentId').notEmpty(), body('term').notEmpty(),
], validate, async (req, res, next) => {
  try { res.json(await svc.publishProgressTerm(req.tenant.id, req.user, req.body)); } catch (e) { next(e); }
});
router.post('/unpublish', adminOrTeacher, [
  body('studentId').notEmpty(), body('term').notEmpty(),
], validate, async (req, res, next) => {
  try { res.json(await svc.unpublishProgressTerm(req.tenant.id, req.user, req.body)); } catch (e) { next(e); }
});

// ─── Holistic card + live faculty (any role) ─────────────────────────────────

// Parents and students may only read their own records.
async function ownStudentOnly(req, res, next) {
  if (req.user.role !== 'PARENT' && req.user.role !== 'STUDENT') return next();
  try {
    const own = await sis.getParentStudents(req.tenant.id, req.user.id);
    if (!own.some((s) => s.id === req.params.studentId)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  } catch (e) { next(e); }
}

router.get('/card/:studentId', ownStudentOnly, async (req, res, next) => {
  try { res.json(await svc.getHolisticCard(req.tenant.id, req.params.studentId, req.query.academicYear, req.user.role)); } catch (e) { next(e); }
});
router.get('/teachers/:studentId', ownStudentOnly, async (req, res, next) => {
  try { res.json(await svc.getMyTeachers(req.tenant.id, req.params.studentId)); } catch (e) { next(e); }
});

module.exports = router;
