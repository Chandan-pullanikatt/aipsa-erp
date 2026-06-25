const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const sisService = require('../services/sis.service');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');

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
    res.status(201).json({ message: 'School registered. Pending AIPSA approval.', ...result });
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
  body('role').isIn(['TEACHER', 'PARENT']),
], validate, async (req, res, next) => {
  try {
    const result = await authService.joinSchool(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// POST /api/auth/link-student — parent links their account to a student
router.post('/link-student',
  authenticate, authorize('PARENT'), requireTenant,
  [
    body('admissionNumber').trim().notEmpty(),
    body('portalPin').trim().notEmpty(),
  ], validate,
  async (req, res, next) => {
    try {
      const result = await authService.linkStudentToParent(req.user.id, req.tenant.id, req.body);
      res.json(result);
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

// GET /api/auth/class-code/:code — public, lookup class info for confirmation step
router.get('/class-code/:code', async (req, res, next) => {
  try {
    const result = await sisService.lookupClassByJoinCode(req.params.code.toUpperCase());
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/auth/student-join — public, submit self-registration request
router.post('/student-join', [
  body('joinCode').trim().notEmpty(),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('parentPhone').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
], validate, async (req, res, next) => {
  try {
    const { joinCode, ...data } = req.body;
    const result = await sisService.createStudentJoinRequest(joinCode.toUpperCase(), data);
    res.status(201).json({ message: 'Registration request submitted. Your class teacher will review it shortly.', request: result });
  } catch (err) { next(err); }
});

module.exports = router;
