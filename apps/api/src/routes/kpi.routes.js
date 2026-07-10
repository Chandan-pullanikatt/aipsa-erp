const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const kpi = require('../services/kpi.service');

const router = Router();
// KPI reporting is staff-facing: the Principal / admin files it, and views the
// dashboard. Not exposed to students/parents.
router.use(authenticate, authorize('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const adminOnly = authorize('SUPER_ADMIN', 'SCHOOL_ADMIN');

// ─── Catalog / KPI Builder ──────────────────────────────────────────────────────
router.get('/areas', async (req, res, next) => {
  try {
    res.json(await kpi.listAreas(req.tenant.id, {
      includeInactive: req.query.includeInactive === 'true' && (req.user.role === 'SCHOOL_ADMIN' || req.user.role === 'SUPER_ADMIN'),
    }));
  } catch (e) { next(e); }
});
router.post('/areas', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await kpi.createArea(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.put('/areas/:id', adminOnly, async (req, res, next) => {
  try { res.json(await kpi.updateArea(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/areas/:id', adminOnly, async (req, res, next) => {
  try { await kpi.deleteArea(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

router.post('/areas/:areaId/particulars', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await kpi.addParticular(req.tenant.id, req.params.areaId, req.body)); } catch (e) { next(e); }
});
router.put('/particulars/:id', adminOnly, async (req, res, next) => {
  try { res.json(await kpi.updateParticular(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/particulars/:id', adminOnly, async (req, res, next) => {
  try { await kpi.deleteParticular(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Daily reports ──────────────────────────────────────────────────────────────
router.get('/reports', async (req, res, next) => {
  try { res.json(await kpi.listReports(req.tenant.id, req.query)); } catch (e) { next(e); }
});
router.get('/reports/:date', async (req, res, next) => {
  try { res.json(await kpi.getReport(req.tenant.id, req.params.date)); } catch (e) { next(e); }
});
router.post('/reports', [body('entries').optional().isArray()], validate, async (req, res, next) => {
  try { res.status(201).json(await kpi.saveReport(req.tenant.id, req.user.id, req.body)); } catch (e) { next(e); }
});

// ─── Dashboard (Formula Engine output) ──────────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try { res.json(await kpi.dashboard(req.tenant.id, req.query)); } catch (e) { next(e); }
});

module.exports = router;
