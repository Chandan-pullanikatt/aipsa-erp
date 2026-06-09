const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const events = require('../services/event.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const staffOnly = authorize('SCHOOL_ADMIN', 'TEACHER');

// ─── Portal (student/parent): only their school + class events ─────────────────
router.get('/feed', async (req, res, next) => {
  try { res.json(await events.getEventsForUser(req.tenant.id, req.user, req.query.studentId, { scope: req.query.scope })); } catch (e) { next(e); }
});

// ─── Admin / teacher curation ─────────────────────────────────────────────────
router.get('/', staffOnly, async (req, res, next) => {
  try { res.json(await events.listEvents(req.tenant.id, req.query)); } catch (e) { next(e); }
});
router.post('/', staffOnly, [body('title').trim().notEmpty(), body('eventDate').notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await events.createEvent(req.tenant.id, req.user.id, req.body)); } catch (e) { next(e); }
});
router.get('/:id', async (req, res, next) => {
  try { res.json(await events.getEvent(req.tenant.id, req.params.id)); } catch (e) { next(e); }
});
router.put('/:id', staffOnly, async (req, res, next) => {
  try { res.json(await events.updateEvent(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/:id', staffOnly, async (req, res, next) => {
  try { await events.deleteEvent(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// Media
router.post('/:id/media', staffOnly, async (req, res, next) => {
  try { res.status(201).json(await events.addMedia(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/media/:mediaId', staffOnly, async (req, res, next) => {
  try { await events.deleteMedia(req.tenant.id, req.params.mediaId); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

module.exports = router;
