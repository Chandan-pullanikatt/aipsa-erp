const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const purchase = require('../services/purchase.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const adminOnly = authorize('SCHOOL_ADMIN');

// ─── Store items ──────────────────────────────────────────────────────────────
router.get('/items', async (req, res, next) => {
  try { res.json(await purchase.listItems(req.tenant.id, { includeInactive: req.query.includeInactive === 'true' })); } catch (e) { next(e); }
});
router.post('/items', adminOnly, [body('name').trim().notEmpty(), body('price').isFloat({ gte: 0 })], validate, async (req, res, next) => {
  try { res.status(201).json(await purchase.createItem(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.put('/items/:id', adminOnly, async (req, res, next) => {
  try { res.json(await purchase.updateItem(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/items/:id', adminOnly, async (req, res, next) => {
  try { await purchase.deleteItem(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Purchases ────────────────────────────────────────────────────────────────
router.get('/', adminOnly, async (req, res, next) => {
  try { res.json(await purchase.listPurchases(req.tenant.id, req.query)); } catch (e) { next(e); }
});
router.post('/', adminOnly, [body('studentId').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await purchase.createPurchase(req.tenant.id, req.user.id, req.body)); } catch (e) { next(e); }
});
router.delete('/:id', adminOnly, async (req, res, next) => {
  try { await purchase.deletePurchase(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// Who hasn't bought a category yet
router.get('/not-purchased', adminOnly, async (req, res, next) => {
  try { res.json(await purchase.notPurchasedReport(req.tenant.id, req.query)); } catch (e) { next(e); }
});

// Per-student history (admins pass studentId; students/parents auto-resolve)
router.get('/student', async (req, res, next) => {
  try { res.json(await purchase.getStudentPurchases(req.tenant.id, req.user, req.query.studentId)); } catch (e) { next(e); }
});

module.exports = router;
