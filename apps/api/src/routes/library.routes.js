const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const library = require('../services/library.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const adminOnly = authorize('SCHOOL_ADMIN');

// ─── Catalog ──────────────────────────────────────────────────────────────────
router.get('/books', async (req, res, next) => {
  try { res.json(await library.listBooks(req.tenant.id, req.query)); } catch (e) { next(e); }
});
router.post('/books', adminOnly, [body('title').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await library.createBook(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.put('/books/:id', adminOnly, async (req, res, next) => {
  try { res.json(await library.updateBook(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/books/:id', adminOnly, async (req, res, next) => {
  try { await library.deleteBook(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Issue / Return ───────────────────────────────────────────────────────────
router.get('/issues', adminOnly, async (req, res, next) => {
  try { res.json(await library.listIssues(req.tenant.id, req.query)); } catch (e) { next(e); }
});
router.post('/issues', adminOnly, [body('bookId').trim().notEmpty(), body('studentId').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await library.issueBook(req.tenant.id, req.user.id, req.body)); } catch (e) { next(e); }
});
router.patch('/issues/:id/return', adminOnly, async (req, res, next) => {
  try { res.json(await library.returnBook(req.tenant.id, req.params.id)); } catch (e) { next(e); }
});
router.patch('/issues/:id/collect-fine', adminOnly, async (req, res, next) => {
  try { res.json(await library.collectFine(req.tenant.id, req.params.id)); } catch (e) { next(e); }
});

// ─── Portal (student/parent) ──────────────────────────────────────────────────
router.get('/student', async (req, res, next) => {
  try { res.json(await library.getStudentLibrary(req.tenant.id, req.user, req.query.studentId)); } catch (e) { next(e); }
});

module.exports = router;
