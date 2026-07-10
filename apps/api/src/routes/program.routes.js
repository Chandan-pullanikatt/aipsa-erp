const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const program = require('../services/program.service');

const router = Router();
// Programs are visible to everyone in a school (students/parents register;
// teachers get matched; admins manage). SUPER_ADMIN manages AIPSA-global programs.
router.use(authenticate, authorize('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const adminOnly = authorize('SUPER_ADMIN', 'SCHOOL_ADMIN');
const opts = (req) => ({ isSuperAdmin: req.user.role === 'SUPER_ADMIN' });

// ─── Catalog (read) ─────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    res.json(await program.listPrograms(req.tenant.id, {
      type: req.query.type,
      includeInactive: req.query.includeInactive === 'true' && (req.user.role === 'SCHOOL_ADMIN' || req.user.role === 'SUPER_ADMIN'),
    }));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await program.getProgram(req.tenant.id, req.params.id)); } catch (e) { next(e); }
});

// ─── Catalog (admin write) ────────────────────────────────────────────────────
router.post('/', adminOnly,
  [body('title').trim().notEmpty(), body('type').trim().notEmpty(), body('fee').optional().isFloat({ gte: 0 })],
  validate,
  async (req, res, next) => {
    try {
      // Only SUPER_ADMIN may create AIPSA-global (cross-school) programs.
      const isGlobal = req.body.isGlobal === true && req.user.role === 'SUPER_ADMIN';
      res.status(201).json(await program.createProgram(req.tenant.id, req.body, { isGlobal }));
    } catch (e) { next(e); }
  });

router.put('/:id', adminOnly, async (req, res, next) => {
  try { res.json(await program.updateProgram(req.tenant.id, req.params.id, req.body, opts(req))); } catch (e) { next(e); }
});

router.delete('/:id', adminOnly, async (req, res, next) => {
  try { await program.deleteProgram(req.tenant.id, req.params.id, opts(req)); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Program items (admin) ────────────────────────────────────────────────────
router.post('/:id/items', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await program.addItem(req.tenant.id, req.params.id, req.body, opts(req))); } catch (e) { next(e); }
});
router.delete('/:id/items/:itemId', adminOnly, async (req, res, next) => {
  try { await program.deleteItem(req.tenant.id, req.params.id, req.params.itemId, opts(req)); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Registration ──────────────────────────────────────────────────────────────
router.post('/register', [body('programId').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await program.register(req.tenant.id, req.user, req.body)); } catch (e) { next(e); }
});

router.post('/verify-payment',
  [body('razorpay_order_id').notEmpty(), body('razorpay_payment_id').notEmpty(), body('razorpay_signature').notEmpty()],
  validate,
  async (req, res, next) => {
    try { res.json(await program.verifyPayment(req.tenant.id, req.body)); } catch (e) { next(e); }
  });

// The caller's own registrations.
router.get('/me/registrations', async (req, res, next) => {
  try { res.json(await program.myRegistrations(req.tenant.id, req.user.id)); } catch (e) { next(e); }
});

router.post('/registrations/:regId/cancel', async (req, res, next) => {
  try { res.json(await program.cancelRegistration(req.tenant.id, req.user, req.params.regId)); } catch (e) { next(e); }
});

// ─── Registration management (admin) ───────────────────────────────────────────
router.get('/manage/registrations', adminOnly, async (req, res, next) => {
  try { res.json(await program.listRegistrations(req.tenant.id, req.query)); } catch (e) { next(e); }
});

router.post('/registrations/:regId/assign-teacher', adminOnly,
  [body('teacherId').trim().notEmpty()], validate,
  async (req, res, next) => {
    try { res.json(await program.assignTeacher(req.tenant.id, req.params.regId, req.body.teacherId)); } catch (e) { next(e); }
  });

module.exports = router;
