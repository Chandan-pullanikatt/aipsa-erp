const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const catalog = require('../services/hsCatalog.service');

// Global Home-Schooling catalog admin. SUPER_ADMIN only; no requireTenant since
// the catalog is AIPSA-owned, not scoped to any tenant.
const router = Router();
router.use(authenticate, authorize('SUPER_ADMIN'));

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

// Courses
router.get('/courses', async (req, res, next) => {
  try { res.json(await catalog.listCourses()); } catch (err) { next(err); }
});
router.get('/courses/:id', async (req, res, next) => {
  try { res.json(await catalog.getCourse(req.params.id)); } catch (err) { next(err); }
});
router.post('/courses', [
  body('title').trim().notEmpty(),
  body('subject').trim().notEmpty(),
  body('gradeLevel').trim().notEmpty(),
], validate, async (req, res, next) => {
  try { res.status(201).json(await catalog.createCourse(req.body)); } catch (err) { next(err); }
});
router.put('/courses/:id', async (req, res, next) => {
  try { res.json(await catalog.updateCourse(req.params.id, req.body)); } catch (err) { next(err); }
});
router.delete('/courses/:id', async (req, res, next) => {
  try { res.json(await catalog.deleteCourse(req.params.id)); } catch (err) { next(err); }
});

// Modules
router.post('/courses/:courseId/modules', [body('title').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await catalog.createModule(req.params.courseId, req.body)); } catch (err) { next(err); }
});
router.put('/modules/:id', async (req, res, next) => {
  try { res.json(await catalog.updateModule(req.params.id, req.body)); } catch (err) { next(err); }
});
router.delete('/modules/:id', async (req, res, next) => {
  try { res.json(await catalog.deleteModule(req.params.id)); } catch (err) { next(err); }
});

// Lessons
router.post('/modules/:moduleId/lessons', [body('title').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await catalog.createLesson(req.params.moduleId, req.body)); } catch (err) { next(err); }
});
router.put('/lessons/:id', async (req, res, next) => {
  try { res.json(await catalog.updateLesson(req.params.id, req.body)); } catch (err) { next(err); }
});
router.delete('/lessons/:id', async (req, res, next) => {
  try { res.json(await catalog.deleteLesson(req.params.id)); } catch (err) { next(err); }
});

module.exports = router;
