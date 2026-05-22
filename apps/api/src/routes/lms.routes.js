const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const lms = require('../services/lms.service');
const prisma = require('../lib/prisma');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

const adminOrTeacher = authorize('SCHOOL_ADMIN', 'TEACHER');

// GET /api/lms/subjects
router.get('/subjects', async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    const { classId, teacherId, search, studentId } = req.query;
    const filters = { search };

    if (role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { tenantId: req.tenant.id, userId },
      });
      if (!student || !student.classId) {
        return res.json([]);
      }
      filters.classId = student.classId;
    } else if (role === 'PARENT') {
      if (!studentId) {
        return res.status(400).json({ error: 'studentId is required for parent access' });
      }
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          tenantId: req.tenant.id,
          OR: [
            { userId },
            { guardians: { some: { userId } } }
          ]
        },
      });
      if (!student || !student.classId) {
        return res.json([]);
      }
      filters.classId = student.classId;
    } else if (role === 'TEACHER') {
      if (classId) {
        filters.classId = classId;
      } else {
        filters.teacherId = userId;
      }
    } else if (role === 'SCHOOL_ADMIN') {
      if (classId) filters.classId = classId;
      if (teacherId) filters.teacherId = teacherId;
    }

    const subjects = await lms.listLmsSubjects(req.tenant.id, filters);
    res.json(subjects);
  } catch (err) { next(err); }
});

// GET /api/lms/subjects/:subjectId/materials
router.get('/subjects/:subjectId/materials', async (req, res, next) => {
  try {
    const userId = ['STUDENT', 'PARENT'].includes(req.user.role) ? req.user.id : null;
    const materials = await lms.getSubjectMaterials(req.tenant.id, req.params.subjectId, userId);
    res.json(materials);
  } catch (err) { next(err); }
});

// GET /api/lms/subjects/:subjectId/progress
router.get('/subjects/:subjectId/progress', async (req, res, next) => {
  try {
    const progress = await lms.getSubjectProgress(req.tenant.id, req.params.subjectId, req.user.id);
    res.json(progress);
  } catch (err) { next(err); }
});

// POST /api/lms/materials/:id/progress  (student/parent toggle)
router.post('/materials/:id/progress', authorize('STUDENT', 'PARENT'), async (req, res, next) => {
  try {
    const result = await lms.toggleMaterialProgress(req.tenant.id, req.params.id, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/lms/materials
router.post('/materials', adminOrTeacher, [
  body('subjectId').notEmpty(),
  body('title').trim().notEmpty(),
], validate, async (req, res, next) => {
  try {
    const { subjectId, ...data } = req.body;
    const material = await lms.createMaterial(req.tenant.id, subjectId, data);
    res.status(201).json(material);
  } catch (err) { next(err); }
});

// PUT /api/lms/materials/:id
router.put('/materials/:id', adminOrTeacher, [
  body('title').optional().trim().notEmpty(),
], validate, async (req, res, next) => {
  try {
    const material = await lms.updateMaterial(req.tenant.id, req.params.id, req.body);
    res.json(material);
  } catch (err) { next(err); }
});

// DELETE /api/lms/materials/:id
router.delete('/materials/:id', adminOrTeacher, async (req, res, next) => {
  try {
    const result = await lms.deleteMaterial(req.tenant.id, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
