const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const prisma = require('../lib/prisma');
const { getOrCreateJoinCode, regenerateJoinCode } = require('../services/auth.service');

const router = Router();

router.use(authenticate, authorize('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), requireTenant);

// GET /api/schools/profile
router.get('/profile', async (req, res, next) => {
  try {
    const profile = await prisma.schoolProfile.findUnique({
      where: { tenantId: req.tenant.id },
    });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// PUT /api/schools/profile
router.put('/profile', authorize('SCHOOL_ADMIN'), async (req, res, next) => {
  try {
    const { schoolName, address, city, state, phone, email, website, board, logo, establishedYear, lateFeeAmount, lateFeeGraceDays, libraryFinePerDay, premiumLmsPrice } = req.body;
    const profile = await prisma.schoolProfile.update({
      where: { tenantId: req.tenant.id },
      data: {
        schoolName, address, city, state, phone, email, website, board,
        // Sent as '' when the admin clears the logo — store null so the portals fall back to the wordmark.
        ...(logo !== undefined && { logo: logo || null }),
        establishedYear: establishedYear ? parseInt(establishedYear) : undefined,
        ...(lateFeeAmount    !== undefined && { lateFeeAmount: parseFloat(lateFeeAmount) || 0 }),
        ...(lateFeeGraceDays !== undefined && { lateFeeGraceDays: parseInt(lateFeeGraceDays) || 0 }),
        ...(libraryFinePerDay !== undefined && { libraryFinePerDay: parseFloat(libraryFinePerDay) || 0 }),
        ...(premiumLmsPrice  !== undefined && { premiumLmsPrice: premiumLmsPrice !== null ? parseFloat(premiumLmsPrice) : null }),
      },
    });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// GET /api/schools/users
router.get('/users', authorize('SCHOOL_ADMIN'), async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const where = { tenantId: req.tenant.id, ...(role ? { role } : {}) };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true, photoUrl: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/schools/users/:id
router.patch('/users/:id', authorize('SCHOOL_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, role, firstName, lastName, phone } = req.body;
    const tenantId = req.tenant.id;

    // Guard: Prevent self-lockout
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot update your own administrative status or role.' });
    }

    // Verify user belongs to tenant
    const targetUser = await prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    // Update
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(role !== undefined && { role }),
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(lastName !== undefined && { lastName: lastName.trim() }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
      },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true, photoUrl: true, isActive: true },
    });

    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
});

// GET /api/schools/join-code
router.get('/join-code', authorize('SCHOOL_ADMIN'), async (req, res, next) => {
  try {
    const code = await getOrCreateJoinCode(req.tenant.id);
    res.json({ joinCode: code });
  } catch (err) { next(err); }
});

// POST /api/schools/join-code/regenerate
router.post('/join-code/regenerate', authorize('SCHOOL_ADMIN'), async (req, res, next) => {
  try {
    const code = await regenerateJoinCode(req.tenant.id);
    res.json({ joinCode: code });
  } catch (err) { next(err); }
});

module.exports = router;
