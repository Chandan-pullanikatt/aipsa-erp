const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const svc = require('../services/hr.service');
const teacherImport = require('../services/teacherImport.service');
const { csvUpload, joinPhotoUpload } = require('../middleware/upload');
const { storage } = require('../lib/storage');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

const profileValidators = [
  body('profile.employmentType').optional().isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT']),
  body('profile.joiningDate').optional({ nullable: true }).isISO8601(),
];

// ─── Departments ──────────────────────────────────────────────────────────────

// GET /api/hr/departments
router.get('/departments', async (req, res, next) => {
  try {
    res.json(await svc.listDepartments(req.tenant.id));
  } catch (err) { next(err); }
});

// POST /api/hr/departments
router.post('/departments', [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.status(201).json(await svc.createDepartment(req.tenant.id, req.body));
  } catch (err) { next(err); }
});

// PUT /api/hr/departments/:id
router.put('/departments/:id', [body('name').optional().trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.json(await svc.updateDepartment(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

// DELETE /api/hr/departments/:id
router.delete('/departments/:id', async (req, res, next) => {
  try {
    res.json(await svc.deleteDepartment(req.tenant.id, req.params.id));
  } catch (err) { next(err); }
});

// ─── Staff Directory ────────────────────────────────────────────────────────────

// GET /api/hr/staff — query: search, departmentId, role
router.get('/staff', async (req, res, next) => {
  try {
    res.json(await svc.listStaff(req.tenant.id, req.query));
  } catch (err) { next(err); }
});

// ─── Bulk import (staff list CSV) ────────────────────────────────────────────
// Declared before /staff/:id so "import" is not swallowed as an id.

// GET /api/hr/staff/import/template — the CSV shape the school should fill
router.get('/staff/import/template', (req, res) => {
  res.type('text/csv').attachment('teacher-import-template.csv').send(teacherImport.templateCsv());
});

// POST /api/hr/staff/import/preview — validate only, writes nothing
router.post('/staff/import/preview', csvUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided (field name: "file").' });
    res.json(await teacherImport.previewImport(req.tenant.id, {
      csv: req.file.buffer.toString('utf8'),
      emailDomain: req.body.emailDomain,
    }));
  } catch (err) { next(err); }
});

// POST /api/hr/staff/import — apply it; returns one-time temp passwords
router.post('/staff/import', csvUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided (field name: "file").' });
    res.status(201).json(await teacherImport.commitImport(req.tenant.id, {
      csv: req.file.buffer.toString('utf8'),
      emailDomain: req.body.emailDomain,
    }));
  } catch (err) { next(err); }
});

// GET /api/hr/staff/:id
router.get('/staff/:id', async (req, res, next) => {
  try {
    res.json(await svc.getStaff(req.tenant.id, req.params.id));
  } catch (err) { next(err); }
});

// POST /api/hr/staff — create a staff/teacher login + employment record
router.post('/staff', [
  body('email').isEmail().normalizeEmail(),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').optional().isIn(['STAFF', 'TEACHER']),
  ...profileValidators,
], validate, async (req, res, next) => {
  try {
    res.status(201).json(await svc.createStaff(req.tenant.id, req.body));
  } catch (err) { next(err); }
});

// PUT /api/hr/staff/:id/profile — upsert employment record for an existing user
router.put('/staff/:id/profile', [
  body('employmentType').optional().isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT']),
  body('joiningDate').optional({ nullable: true }).isISO8601(),
], validate, async (req, res, next) => {
  try {
    res.json(await svc.updateStaffProfile(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

// POST /api/hr/staff/:id/reset-password — issues a fresh readable temp password
// for a member who is locked out. Returns it once; the stored copy is hashed.
router.post('/staff/:id/reset-password', async (req, res, next) => {
  try {
    res.json(await svc.resetStaffPassword(req.tenant.id, req.params.id, req.user, {
      ipAddress: req.ip,
    }));
  } catch (err) { next(err); }
});

// POST /api/hr/staff/:id/photo — upload/replace the directory photo
router.post('/staff/:id/photo', joinPhotoUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided (field name: "file").' });
    const { url } = await storage.upload(req.file.buffer, {
      folder: `aipsa/${req.tenant.id}/staff-photos`,
      contentType: req.file.mimetype,
    });
    res.status(201).json(await svc.setStaffPhoto(req.tenant.id, req.params.id, url));
  } catch (err) { next(err); }
});

// DELETE /api/hr/staff/:id/photo
router.delete('/staff/:id/photo', async (req, res, next) => {
  try {
    res.json(await svc.setStaffPhoto(req.tenant.id, req.params.id, null));
  } catch (err) { next(err); }
});

// DELETE /api/hr/staff/:id — permanent, and only for accounts with no school
// records. Leavers should be deactivated via the status route instead.
router.delete('/staff/:id', async (req, res, next) => {
  try {
    res.json(await svc.deleteStaff(req.tenant.id, req.params.id, req.user));
  } catch (err) { next(err); }
});

// PATCH /api/hr/staff/:id/status — deactivate (soft-delete) or reactivate a staff account
router.patch('/staff/:id/status', [
  body('isActive').isBoolean().toBoolean(),
], validate, async (req, res, next) => {
  try {
    res.json(await svc.setStaffStatus(
      req.tenant.id, req.params.id, req.body.isActive, req.user, { ipAddress: req.ip },
    ));
  } catch (err) { next(err); }
});

module.exports = router;
