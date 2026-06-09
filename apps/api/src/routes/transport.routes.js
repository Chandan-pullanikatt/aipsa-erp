const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const transport = require('../services/transport.service');

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

// ─── Public driver tracking (magic link, no login) ────────────────────────────
// Registered BEFORE the auth middleware so drivers can share location without an
// account. The token alone scopes access to a single bus route.
router.get('/track/:token', async (req, res, next) => {
  try { res.json(await transport.getRouteByToken(req.params.token)); } catch (e) { next(e); }
});
router.post('/track/:token/location', async (req, res, next) => {
  try { res.json(await transport.pushLocation(req.params.token, req.body.lat, req.body.lng)); } catch (e) { next(e); }
});

// ─── Everything below requires authentication ─────────────────────────────────
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);
const adminOnly = authorize('SCHOOL_ADMIN');

// Routes
router.get('/routes', async (req, res, next) => {
  try { res.json(await transport.listRoutes(req.tenant.id)); } catch (e) { next(e); }
});
router.post('/routes', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await transport.createRoute(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.get('/routes/:id', async (req, res, next) => {
  try { res.json(await transport.getRoute(req.tenant.id, req.params.id)); } catch (e) { next(e); }
});
router.put('/routes/:id', adminOnly, async (req, res, next) => {
  try { res.json(await transport.updateRoute(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/routes/:id', adminOnly, async (req, res, next) => {
  try { await transport.deleteRoute(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});
router.post('/routes/:id/track-token', adminOnly, async (req, res, next) => {
  try { res.json(await transport.regenerateTrackToken(req.tenant.id, req.params.id)); } catch (e) { next(e); }
});
router.get('/routes/:id/location', async (req, res, next) => {
  try { res.json(await transport.getLiveLocation(req.tenant.id, req.params.id)); } catch (e) { next(e); }
});

// Stops
router.post('/routes/:id/stops', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await transport.addStop(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.put('/stops/:stopId', adminOnly, async (req, res, next) => {
  try { res.json(await transport.updateStop(req.tenant.id, req.params.stopId, req.body)); } catch (e) { next(e); }
});
router.delete('/stops/:stopId', adminOnly, async (req, res, next) => {
  try { await transport.deleteStop(req.tenant.id, req.params.stopId); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// Student assignment
router.post('/routes/:id/students', adminOnly, [body('studentId').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.json(await transport.assignStudent(req.tenant.id, req.params.id, req.body.studentId, req.body.boardingPoint)); } catch (e) { next(e); }
});
router.delete('/students/:studentId', adminOnly, async (req, res, next) => {
  try { res.json(await transport.unassignStudent(req.tenant.id, req.params.studentId)); } catch (e) { next(e); }
});

// Portal (student/parent) — student's assigned route + live location
router.get('/my-transport', async (req, res, next) => {
  try { res.json(await transport.getStudentTransport(req.tenant.id, req.user, req.query.studentId)); } catch (e) { next(e); }
});

module.exports = router;
