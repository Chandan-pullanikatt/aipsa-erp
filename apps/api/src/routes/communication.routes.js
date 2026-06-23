const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const comm = require('../services/communication.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN','TEACHER','STUDENT','PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const adminOnly = authorize('SCHOOL_ADMIN');

// ─── Announcements ────────────────────────────────────────────────────────────

router.get('/announcements', async (req, res, next) => {
  try {
    res.json(await comm.listAnnouncements(req.tenant.id, req.user.role, req.query));
  } catch (e) { next(e); }
});

router.post('/announcements', adminOnly, [
  body('title').trim().notEmpty(),
  body('body').trim().notEmpty(),
], validate, async (req, res, next) => {
  try {
    res.status(201).json(await comm.createAnnouncement(req.tenant.id, req.user.id, req.body));
  } catch (e) { next(e); }
});

router.put('/announcements/:id', adminOnly, async (req, res, next) => {
  try {
    res.json(await comm.updateAnnouncement(req.tenant.id, req.params.id, req.body));
  } catch (e) { next(e); }
});

router.delete('/announcements/:id', adminOnly, async (req, res, next) => {
  try {
    await comm.deleteAnnouncement(req.tenant.id, req.params.id);
    res.json({ message: 'Deleted.' });
  } catch (e) { next(e); }
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get('/notifications', async (req, res, next) => {
  try {
    res.json(await comm.getNotifications(req.tenant.id, req.user.id, req.query));
  } catch (e) { next(e); }
});

router.get('/notifications/unread-count', async (req, res, next) => {
  try {
    res.json(await comm.getUnreadCount(req.tenant.id, req.user.id));
  } catch (e) { next(e); }
});

router.patch('/notifications/read-all', async (req, res, next) => {
  try {
    res.json(await comm.markAllRead(req.tenant.id, req.user.id));
  } catch (e) { next(e); }
});

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    res.json(await comm.markRead(req.tenant.id, req.user.id, req.params.id));
  } catch (e) { next(e); }
});

// ─── Push device tokens ─────────────────────────────────────────────────────────

router.post('/device-token', [body('token').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.json(await comm.registerDeviceToken(req.tenant.id, req.user.id, req.body));
  } catch (e) { next(e); }
});

router.delete('/device-token', async (req, res, next) => {
  try {
    res.json(await comm.removeDeviceToken(req.tenant.id, req.user.id, req.body?.token || req.query.token));
  } catch (e) { next(e); }
});

// ─── Notification preferences ───────────────────────────────────────────────────

router.get('/notification-preferences', async (req, res, next) => {
  try {
    res.json(await comm.getPreferences(req.tenant.id, req.user.id));
  } catch (e) { next(e); }
});

router.patch('/notification-preferences', async (req, res, next) => {
  try {
    res.json(await comm.updatePreferences(req.tenant.id, req.user.id, req.body));
  } catch (e) { next(e); }
});

module.exports = router;