const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const hostel = require('../services/hostel.service');

const router = Router();
router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
const adminOnly = authorize('SCHOOL_ADMIN');

// ─── Hostels ──────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try { res.json(await hostel.listHostels(req.tenant.id)); } catch (e) { next(e); }
});
router.post('/', adminOnly, [body('name').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await hostel.createHostel(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.get('/:id', async (req, res, next) => {
  try { res.json(await hostel.getHostel(req.tenant.id, req.params.id)); } catch (e) { next(e); }
});
router.put('/:id', adminOnly, async (req, res, next) => {
  try { res.json(await hostel.updateHostel(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/:id', adminOnly, async (req, res, next) => {
  try { await hostel.deleteHostel(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Rooms ────────────────────────────────────────────────────────────────────
router.post('/:id/rooms', adminOnly, [body('roomNumber').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await hostel.addRoom(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.put('/rooms/:roomId', adminOnly, async (req, res, next) => {
  try { res.json(await hostel.updateRoom(req.tenant.id, req.params.roomId, req.body)); } catch (e) { next(e); }
});
router.delete('/rooms/:roomId', adminOnly, async (req, res, next) => {
  try { await hostel.deleteRoom(req.tenant.id, req.params.roomId); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Allotments ───────────────────────────────────────────────────────────────
router.post('/allotments', adminOnly, [body('roomId').trim().notEmpty(), body('studentId').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await hostel.allotStudent(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.delete('/allotments/:studentId', adminOnly, async (req, res, next) => {
  try { res.json(await hostel.vacateStudent(req.tenant.id, req.params.studentId)); } catch (e) { next(e); }
});

// ─── Mess / food timetable ────────────────────────────────────────────────────
router.get('/mess/list', async (req, res, next) => {
  try { res.json(await hostel.listMess(req.tenant.id, req.query.hostelId)); } catch (e) { next(e); }
});
router.post('/mess', adminOnly, [body('dayOfWeek').notEmpty(), body('meal').notEmpty(), body('items').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await hostel.createMess(req.tenant.id, req.body)); } catch (e) { next(e); }
});
router.put('/mess/:id', adminOnly, async (req, res, next) => {
  try { res.json(await hostel.updateMess(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/mess/:id', adminOnly, async (req, res, next) => {
  try { await hostel.deleteMess(req.tenant.id, req.params.id); res.json({ message: 'Deleted.' }); } catch (e) { next(e); }
});

// ─── Gate passes ──────────────────────────────────────────────────────────────
// Students/parents create for their own ward; admins list/review all.
router.get('/gate-passes/list', async (req, res, next) => {
  try {
    const { status } = req.query;
    // Portal users only see their own student's passes.
    const studentId = ['STUDENT', 'PARENT'].includes(req.user.role)
      ? (await hostel.getStudentHostel(req.tenant.id, req.user, req.query.studentId)).id
      : req.query.studentId;
    res.json(await hostel.listGatePasses(req.tenant.id, { status, studentId }));
  } catch (e) { next(e); }
});
router.post('/gate-passes', [body('reason').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await hostel.createGatePass(req.tenant.id, req.user, req.body)); } catch (e) { next(e); }
});
router.patch('/gate-passes/:id', adminOnly, async (req, res, next) => {
  try { res.json(await hostel.reviewGatePass(req.tenant.id, req.params.id, req.user.id, req.body.status)); } catch (e) { next(e); }
});

// ─── Complaints ───────────────────────────────────────────────────────────────
router.get('/complaints/list', async (req, res, next) => {
  try {
    const { status } = req.query;
    const studentId = ['STUDENT', 'PARENT'].includes(req.user.role)
      ? (await hostel.getStudentHostel(req.tenant.id, req.user, req.query.studentId)).id
      : req.query.studentId;
    res.json(await hostel.listComplaints(req.tenant.id, { status, studentId }));
  } catch (e) { next(e); }
});
router.post('/complaints', [body('title').trim().notEmpty()], validate, async (req, res, next) => {
  try { res.status(201).json(await hostel.createComplaint(req.tenant.id, req.user, req.body)); } catch (e) { next(e); }
});
router.patch('/complaints/:id', adminOnly, async (req, res, next) => {
  try { res.json(await hostel.updateComplaint(req.tenant.id, req.params.id, req.body)); } catch (e) { next(e); }
});

// ─── Portal (student/parent) ──────────────────────────────────────────────────
router.get('/portal/my-hostel', async (req, res, next) => {
  try { res.json(await hostel.getStudentHostel(req.tenant.id, req.user, req.query.studentId)); } catch (e) { next(e); }
});

module.exports = router;
