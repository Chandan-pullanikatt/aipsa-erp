const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const fee = require('../services/fee.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const adminOnly = authorize('SCHOOL_ADMIN');

// ─── Categories ───────────────────────────────────────────────────────────────
router.get('/categories', async (req, res, next) => {
  try { res.json(await fee.listCategories(req.tenant.id)); } catch (e) { next(e); }
});
router.post('/categories', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await fee.createCategory(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.put('/categories/:id', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.json(await fee.updateCategory(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/categories/:id', adminOnly, async (req, res, next) => {
  try { await fee.deleteCategory(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Structures ───────────────────────────────────────────────────────────────
router.get('/structures', async (req, res, next) => {
  try { res.json(await fee.listStructures(req.tenant.id, req.query)); } catch (e) { next(e); }
});
router.post('/structures', adminOnly, [
  body('feeCategoryId').notEmpty(),
  body('amount').isFloat({ gt: 0 }),
  body('frequency').isIn(['MONTHLY','QUARTERLY','ANNUALLY','ONE_TIME']),
], validate, async (req, res, next) => {
  try { res.status(201).json(await fee.createStructure(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.put('/structures/:id', adminOnly, async (req, res, next) => {
  try { res.json(await fee.updateStructure(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/structures/:id', adminOnly, async (req, res, next) => {
  try { await fee.deleteStructure(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Student Fee Account ──────────────────────────────────────────────────────
router.get('/students/:studentId/account', async (req, res, next) => {
  try { res.json(await fee.getStudentFeeAccount(req.tenant.id, req.params.studentId, req.query.academicYear)); } catch (e) { next(e); }
});

// ─── Payments ────────────────────────────────────────────────────────────────
router.get('/payments', async (req, res, next) => {
  try { res.json(await fee.listPayments(req.tenant.id, req.query)); } catch (e) { next(e); }
});
router.post('/payments', adminOnly, [
  body('studentId').notEmpty(),
  body('feeCategoryId').notEmpty(),
  body('amount').isFloat({ gt: 0 }),
], validate, async (req, res, next) => {
  try { res.status(201).json(await fee.recordPayment(req.tenant.id, req.user.id, req.body)); } catch (e) { next(e); }
});
router.get('/payments/:id', async (req, res, next) => {
  try { res.json(await fee.getPayment(req.tenant.id, req.params.id)); } catch (e) { next(e); }
});

// ─── Late Fee Waivers ─────────────────────────────────────────────────────────
router.post('/students/:studentId/late-fee-waiver', adminOnly, async (req, res, next) => {
  try {
    res.json(await fee.createLateFeeWaiver(req.tenant.id, req.params.studentId, req.body, req.user.id));
  } catch (err) { next(err); }
});

router.delete('/students/:studentId/late-fee-waiver', adminOnly, async (req, res, next) => {
  try {
    await fee.deleteLateFeeWaiver(req.tenant.id, req.params.studentId, req.body);
    res.json({ message: 'Waiver removed.' });
  } catch (err) { next(err); }
});

// ─── Due Report ───────────────────────────────────────────────────────────────
router.get('/due-report', adminOnly, async (req, res, next) => {
  try { res.json(await fee.getDueReport(req.tenant.id, req.query)); } catch (e) { next(e); }
});

// ─── Defaulter Report (class + category, service-aware) ───────────────────────
router.get('/defaulter-report', adminOnly, async (req, res, next) => {
  try {
    const { classId, feeCategoryId, academicYear, defaultersOnly } = req.query;
    res.json(await fee.getDefaulterReport(req.tenant.id, {
      classId, feeCategoryId, academicYear,
      defaultersOnly: defaultersOnly === undefined ? true : defaultersOnly !== 'false',
    }));
  } catch (e) { next(e); }
});

// ─── Academic Year ────────────────────────────────────────────────────────────
router.get('/academic-year', (req, res) => {
  res.json({ academicYear: fee.currentAcademicYear() });
});

module.exports = router;