const { Router } = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { csvUpload } = require('../middleware/upload');
const sis = require('../services/sis.service');
const studentImport = require('../services/studentImport.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

const adminOnly = authorize('SCHOOL_ADMIN');

// ─── Classes ─────────────────────────────────────────────────────────────────

router.get('/classes', async (req, res, next) => {
  try {
    res.json(await sis.listClasses(req.tenant.id));
  } catch (err) { next(err); }
});

router.post('/classes', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.status(201).json(await sis.createClass(req.tenant.id, req.body));
  } catch (err) { next(err); }
});

router.put('/classes/:id', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.json(await sis.updateClass(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

router.delete('/classes/:id', adminOnly, async (req, res, next) => {
  try {
    await sis.deleteClass(req.tenant.id, req.params.id);
    res.json({ message: 'Class deleted.' });
  } catch (err) { next(err); }
});

router.patch('/classes/:id', adminOnly, async (req, res, next) => {
  try {
    res.json(await sis.patchClass(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

// ─── Sections ────────────────────────────────────────────────────────────────

router.get('/classes/:classId/sections', async (req, res, next) => {
  try {
    res.json(await sis.listSections(req.tenant.id, req.params.classId));
  } catch (err) { next(err); }
});

router.post('/classes/:classId/sections', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.status(201).json(await sis.createSection(req.tenant.id, req.params.classId, req.body));
  } catch (err) { next(err); }
});

router.put('/sections/:id', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try {
    res.json(await sis.updateSection(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

router.delete('/sections/:id', adminOnly, async (req, res, next) => {
  try {
    await sis.deleteSection(req.tenant.id, req.params.id);
    res.json({ message: 'Section deleted.' });
  } catch (err) { next(err); }
});

// ─── Students ────────────────────────────────────────────────────────────────

router.get('/students', async (req, res, next) => {
  try {
    const { classId, sectionId, status, search, page, limit } = req.query;
    res.json(await sis.listStudents(req.tenant.id, { classId, sectionId, status, search, page, limit }));
  } catch (err) { next(err); }
});

router.post('/students', adminOnly, [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('boardingType').optional({ checkFalsy: true }).isIn(['DAY_SCHOLAR', 'HOSTELER']),
], validate, async (req, res, next) => {
  try {
    res.status(201).json(await sis.createStudent(req.tenant.id, req.body));
  } catch (err) { next(err); }
});

// ─── Bulk import (class register CSV) ────────────────────────────────────────

// GET /api/sis/students/import/template — the CSV shape the school should fill
router.get('/students/import/template', adminOnly, (req, res) => {
  res.type('text/csv').attachment('student-import-template.csv').send(studentImport.templateCsv());
});

// POST /api/sis/students/import/preview — validate only, writes nothing
router.post('/students/import/preview', adminOnly, csvUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided (field name: "file").' });
    if (!req.body.classId) return res.status(400).json({ error: 'Pick a class first.' });
    res.json(await studentImport.previewImport(req.tenant.id, {
      classId: req.body.classId,
      csv: req.file.buffer.toString('utf8'),
    }));
  } catch (err) { next(err); }
});

// POST /api/sis/students/import — apply it; returns one-time portal PINs
router.post('/students/import', adminOnly, csvUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided (field name: "file").' });
    if (!req.body.classId) return res.status(400).json({ error: 'Pick a class first.' });
    res.status(201).json(await studentImport.commitImport(req.tenant.id, {
      classId: req.body.classId,
      sectionId: req.body.sectionId || null,
      csv: req.file.buffer.toString('utf8'),
    }));
  } catch (err) { next(err); }
});

router.get('/students/:id', async (req, res, next) => {
  try {
    res.json(await sis.getStudent(req.tenant.id, req.params.id));
  } catch (err) { next(err); }
});

router.put('/students/:id', adminOnly, async (req, res, next) => {
  try {
    res.json(await sis.updateStudent(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

// ─── Guardians ───────────────────────────────────────────────────────────────

router.get('/students/:studentId/guardians', async (req, res, next) => {
  try {
    res.json(await sis.listGuardians(req.tenant.id, req.params.studentId));
  } catch (err) { next(err); }
});

router.post('/students/:studentId/guardians', adminOnly, [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('relation').notEmpty(),
  body('phone').notEmpty(),
], validate, async (req, res, next) => {
  try {
    res.status(201).json(await sis.createGuardian(req.tenant.id, req.params.studentId, req.body));
  } catch (err) { next(err); }
});

router.put('/guardians/:id', adminOnly, async (req, res, next) => {
  try {
    res.json(await sis.updateGuardian(req.tenant.id, req.params.id, req.body));
  } catch (err) { next(err); }
});

router.delete('/guardians/:id', adminOnly, async (req, res, next) => {
  try {
    await sis.deleteGuardian(req.tenant.id, req.params.id);
    res.json({ message: 'Guardian deleted.' });
  } catch (err) { next(err); }
});

// PATCH /api/sis/students/:id/fee-override — admin only
router.patch('/students/:id/fee-override', adminOnly, async (req, res, next) => {
  try {
    const enabled = req.body.enabled === true || req.body.enabled === 'true';
    res.json(await sis.setFeeAccessOverride(req.tenant.id, req.params.id, enabled));
  } catch (err) { next(err); }
});

// GET /api/sis/students/:id/portal-pin — admin only
router.get('/students/:id/portal-pin', adminOnly, async (req, res, next) => {
  try {
    res.json(await sis.getPortalPin(req.tenant.id, req.params.id));
  } catch (err) { next(err); }
});

// POST /api/sis/students/:id/reset-password — admin resets to default pattern
router.post('/students/:id/reset-password', adminOnly, async (req, res, next) => {
  try {
    res.json(await sis.resetStudentPassword(req.tenant.id, req.params.id));
  } catch (err) { next(err); }
});

// ─── Class Join Codes ─────────────────────────────────────────────────────────

// POST /api/sis/classes/:classId/join-code — teacher or admin generates/regenerates code
router.post('/classes/:classId/join-code',
  authorize('SCHOOL_ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      res.json(await sis.generateClassJoinCode(req.tenant.id, req.params.classId));
    } catch (err) { next(err); }
  }
);

// GET /api/sis/classes/:classId/join-code — teacher or admin views code
router.get('/classes/:classId/join-code',
  authorize('SCHOOL_ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      res.json(await sis.getClassJoinCode(req.tenant.id, req.params.classId));
    } catch (err) { next(err); }
  }
);

// GET /api/sis/join-codes — admin views all class codes
router.get('/join-codes', adminOnly, async (req, res, next) => {
  try {
    res.json(await sis.listClassJoinCodes(req.tenant.id));
  } catch (err) { next(err); }
});

// ─── Class Join Requests ──────────────────────────────────────────────────────

// GET /api/sis/classes/:classId/join-requests — teacher or admin lists requests
router.get('/classes/:classId/join-requests',
  authorize('SCHOOL_ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      const { status, page, limit } = req.query;
      res.json(await sis.listJoinRequests(req.tenant.id, { classId: req.params.classId, status, page, limit }));
    } catch (err) { next(err); }
  }
);

// GET /api/sis/join-requests — admin or teacher sees all requests across all classes
router.get('/join-requests',
  authorize('SCHOOL_ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      const { classId, status, page, limit } = req.query;
      res.json(await sis.listJoinRequests(req.tenant.id, { classId, status, page, limit }));
    } catch (err) { next(err); }
  }
);

// PATCH /api/sis/join-requests/:id/approve — teacher or admin approves
router.patch('/join-requests/:id/approve',
  authorize('SCHOOL_ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      res.json(await sis.approveJoinRequest(req.tenant.id, req.params.id, req.user.id));
    } catch (err) { next(err); }
  }
);

// PATCH /api/sis/join-requests/:id/reject — teacher or admin rejects
router.patch('/join-requests/:id/reject',
  authorize('SCHOOL_ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      res.json(await sis.rejectJoinRequest(req.tenant.id, req.params.id, req.user.id));
    } catch (err) { next(err); }
  }
);

// ─── Student Activities ────────────────────────────────────────────────────────

// GET /api/sis/students/:id/activities — teacher + admin
router.get('/students/:id/activities',
  authorize('SCHOOL_ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      res.json(await sis.listStudentActivities(req.tenant.id, req.params.id));
    } catch (err) { next(err); }
  }
);

// POST /api/sis/students/:id/activities — teacher + admin
router.post('/students/:id/activities',
  authorize('SCHOOL_ADMIN', 'TEACHER'),
  [
    body('type').notEmpty().withMessage('type is required'),
    body('title').trim().notEmpty().withMessage('title is required'),
    body('date').notEmpty().withMessage('date is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      res.status(201).json(
        await sis.createStudentActivity(req.tenant.id, req.params.id, req.body, req.user.id)
      );
    } catch (err) { next(err); }
  }
);

// DELETE /api/sis/activities/:id — creator or admin
router.delete('/activities/:id',
  authorize('SCHOOL_ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      await sis.deleteStudentActivity(req.tenant.id, req.params.id, req.user.id, req.user.role);
      res.json({ message: 'Activity deleted.' });
    } catch (err) { next(err); }
  }
);

// GET /api/sis/parent/students
router.get('/parent/students', authorize('PARENT'), async (req, res, next) => {
  try {
    res.json(await sis.getParentStudents(req.tenant.id, req.user.id));
  } catch (err) { next(err); }
});

// GET /api/sis/student/profile
router.get('/student/profile', authorize('STUDENT'), async (req, res, next) => {
  try {
    res.json(await sis.getStudentByUserId(req.tenant.id, req.user.id));
  } catch (err) { next(err); }
});

module.exports = router;
