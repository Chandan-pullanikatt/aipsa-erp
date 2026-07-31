const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const sisService = require('../services/sis.service');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { joinPhotoUpload } = require('../middleware/upload');
const { storage } = require('../lib/storage');

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

// POST /api/auth/register
router.post('/register', [
  body('schoolName').trim().notEmpty(),
  body('adminEmail').isEmail().normalizeEmail(),
  body('adminPassword').isLength({ min: 8 }),
  body('adminFirstName').trim().notEmpty(),
  body('adminLastName').trim().notEmpty(),
], validate, async (req, res, next) => {
  try {
    const result = await authService.registerSchool(req.body);
    res.status(201).json({ message: 'School registered. Pending EduBridge approval.', ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], validate, async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
], validate, async (req, res, next) => {
  try {
    await authService.requestPasswordReset(req.body.email);
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
], validate, async (req, res, next) => {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ message: 'Password reset successful.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/invite — admin sends magic link to teacher, staff or parent
router.post('/invite',
  authenticate, authorize('SCHOOL_ADMIN'), requireTenant,
  [
    body('email').isEmail().normalizeEmail(),
    body('role').isIn(['TEACHER', 'STAFF', 'PARENT']),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
  ], validate,
  async (req, res, next) => {
    try {
      const result = await authService.inviteUser(req.tenant.id, req.body);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// POST /api/auth/accept-invite — set password and activate account
router.post('/accept-invite', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
], validate, async (req, res, next) => {
  try {
    const result = await authService.acceptInvite(req.body.token, req.body.password);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/auth/join — self-join via school code
router.post('/join', [
  body('joinCode').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').isIn(['TEACHER']),
], validate, async (req, res, next) => {
  try {
    const result = await authService.joinSchool(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// POST /api/auth/pin-login — parents/students sign in with admission number + password
router.post('/pin-login', [
  body('admissionNumber').trim().notEmpty(),
  body('password').notEmpty(),
], validate, async (req, res, next) => {
  try {
    const result = await authService.loginWithPin(req.body);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/auth/portal-password — parent replaces the shared default password
router.post('/portal-password',
  authenticate, authorize('PARENT', 'STUDENT'), requireTenant,
  [
    body('admissionNumber').trim().notEmpty(),
    body('newPassword').isLength({ min: 6 }),
  ], validate,
  async (req, res, next) => {
    try {
      res.json(await authService.changePortalPassword(req.user.id, req.tenant.id, req.body));
    } catch (err) { next(err); }
  }
);

// POST /api/auth/change-password — authenticated, used on forced first-login change
router.post('/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ], validate,
  async (req, res, next) => {
    try {
      const result = await authService.changePassword(req.user.id, req.body);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// POST /api/auth/account/delete — authenticated, user requests deletion of their
// own account + data (required by Google Play). Deactivates immediately; PII purge
// runs on a grace-period job. Confirm intent with the literal "DELETE".
router.post('/account/delete',
  authenticate,
  [
    body('confirm').equals('DELETE').withMessage('Type DELETE to confirm.'),
  ], validate,
  async (req, res, next) => {
    try {
      const result = await authService.requestAccountDeletion(req.user.id, { ipAddress: req.ip });
      res.json(result);
    } catch (err) { next(err); }
  }
);

// GET /api/auth/class-code/:code — public, lookup class info for confirmation step
router.get('/class-code/:code', async (req, res, next) => {
  try {
    const result = await sisService.lookupClassByJoinCode(req.params.code.toUpperCase());
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/auth/student-join/photo — public, passport photo for the self-registration
// form. No login exists yet at this point, so instead of tenant auth we require a
// valid, active class join code (same check the details step already passed) to
// keep this from being an open anonymous upload endpoint.
router.post('/student-join/photo', joinPhotoUpload.single('file'), async (req, res, next) => {
  try {
    const joinCode = (req.body.joinCode || '').trim().toUpperCase();
    if (!joinCode) return res.status(400).json({ error: 'joinCode is required.' });
    if (!req.file) return res.status(400).json({ error: 'No file provided (field name: "file").' });

    const cls = await sisService.lookupClassByJoinCode(joinCode);
    const folder = `aipsa/join-requests/${cls.classId}`;
    const result = await storage.upload(req.file.buffer, {
      folder,
      resourceType: 'image',
      contentType: req.file.mimetype,
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// POST /api/auth/student-join — public, submit self-registration request
router.post('/student-join', [
  body('joinCode').trim().notEmpty(),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('parentPhone').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('dateOfBirth').optional({ checkFalsy: true }).isISO8601(),
  body('gender').optional({ checkFalsy: true }).isIn(['MALE', 'FEMALE', 'OTHER']),
  body('bloodGroup').optional({ checkFalsy: true }).trim(),
  body('phone').optional({ checkFalsy: true }).trim(),
  body('address').optional({ checkFalsy: true }).trim(),
  body('city').optional({ checkFalsy: true }).trim(),
  body('state').optional({ checkFalsy: true }).trim(),
  body('photoUrl').optional({ checkFalsy: true }).trim(),
], validate, async (req, res, next) => {
  try {
    const { joinCode, ...data } = req.body;
    const result = await sisService.createStudentJoinRequest(joinCode.toUpperCase(), data);
    res.status(201).json({ message: 'Registration request submitted. Your class teacher will review it shortly.', request: result });
  } catch (err) { next(err); }
});

module.exports = router;
