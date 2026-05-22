const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { sendApprovalNotification } = require('../services/email.service');

const router = Router();

router.use(authenticate, authorize('SUPER_ADMIN'));

// GET /api/superadmin/schools — list all schools
router.get('/schools', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = status ? { status } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tenants, total] = await prisma.$transaction([
      prisma.tenant.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          profile: { select: { schoolName: true, city: true, state: true, phone: true, email: true } },
          _count: { select: { users: true } },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    res.json({ tenants, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/superadmin/schools/:id
router.get('/schools/:id', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        profile: true,
        users: { select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true, createdAt: true } },
      },
    });
    if (!tenant) return res.status(404).json({ error: 'School not found' });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/superadmin/schools/:id/approve
router.patch('/schools/:id/approve', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' },
      include: { profile: true, users: { where: { role: 'SCHOOL_ADMIN' }, take: 1 } },
    });

    if (tenant.users[0]) {
      const loginUrl = `${process.env.WEB_URL}/login`;
      await sendApprovalNotification(tenant.users[0].email, tenant.profile?.schoolName || tenant.name, loginUrl).catch(console.error);
    }

    res.json({ message: 'School approved.', tenant });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/superadmin/schools/:id/suspend
router.patch('/schools/:id/suspend', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status: 'SUSPENDED' },
    });
    res.json({ message: 'School suspended.', tenant });
  } catch (err) {
    next(err);
  }
});

// GET /api/superadmin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const [totalSchools, activeSchools, pendingSchools, suspendedSchools, totalUsers] = await prisma.$transaction([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'PENDING' } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
    ]);

    res.json({ totalSchools, activeSchools, pendingSchools, suspendedSchools, totalUsers });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
