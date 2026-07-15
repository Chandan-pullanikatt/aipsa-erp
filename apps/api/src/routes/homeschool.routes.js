const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { hsAuthenticate } = require('../middleware/hsAuth');
const hs = require('../services/homeschool.service');
const subscription = require('../services/hsSubscription.service');

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

// ─── Public: family signup (self-service B2C) ────────────────────────────────
router.post('/signup', [
  body('parentFirstName').trim().notEmpty(),
  body('parentLastName').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
], validate, async (req, res, next) => {
  try {
    const result = await hs.signup(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// ─── Public: family login ─────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], validate, async (req, res, next) => {
  try {
    res.json(await hs.login(req.body));
  } catch (err) { next(err); }
});

// ─── Everything below requires a logged-in home-schooling account ─────────────
router.use(hsAuthenticate);

// Learners (children)
router.get('/learners', async (req, res, next) => {
  try { res.json(await hs.listLearners(req.account.id)); } catch (err) { next(err); }
});
router.post('/learners', [body('firstName').trim().notEmpty(), body('lastName').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await hs.createLearner(req.account.id, req.body)); } catch (err) { next(err); }
});
router.put('/learners/:id', async (req, res, next) => {
  try { res.json(await hs.updateLearner(req.account.id, req.params.id, req.body)); } catch (err) { next(err); }
});
router.delete('/learners/:id', async (req, res, next) => {
  try { res.json(await hs.deleteLearner(req.account.id, req.params.id)); } catch (err) { next(err); }
});

// Catalog
router.get('/catalog', async (req, res, next) => {
  try {
    const { gradeLevel, subject, search } = req.query;
    res.json(await hs.listCatalog({ gradeLevel, subject, search }));
  } catch (err) { next(err); }
});
router.get('/courses/:id', async (req, res, next) => {
  try { res.json(await hs.getCourse(req.account.id, req.params.id, req.query.learnerId)); } catch (err) { next(err); }
});
router.get('/lessons/:id', async (req, res, next) => {
  try { res.json(await hs.getLesson(req.account.id, req.params.id, req.query.learnerId)); } catch (err) { next(err); }
});

// Enrollment + progress
router.post('/learners/:learnerId/enroll', [body('courseId').notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await hs.enrollLearner(req.account.id, req.params.learnerId, req.body.courseId)); } catch (err) { next(err); }
});
router.get('/learners/:learnerId/enrollments', async (req, res, next) => {
  try { res.json(await hs.listEnrollments(req.account.id, req.params.learnerId)); } catch (err) { next(err); }
});
router.post('/learners/:learnerId/lessons/:lessonId/progress', async (req, res, next) => {
  try { res.json(await hs.toggleLessonProgress(req.account.id, req.params.learnerId, req.params.lessonId)); } catch (err) { next(err); }
});

// Subscription
router.get('/subscription/status', async (req, res, next) => {
  try { res.json(await subscription.getStatus(req.account.id)); } catch (err) { next(err); }
});
router.post('/subscription/initiate', async (req, res, next) => {
  try { res.json(await subscription.initiatePayment(req.account.id)); } catch (err) { next(err); }
});
router.post('/subscription/verify', [
  body('razorpay_order_id').notEmpty(),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_signature').notEmpty(),
], validate, async (req, res, next) => {
  try { res.json(await subscription.verifyPayment(req.account.id, req.body)); } catch (err) { next(err); }
});

module.exports = router;
