const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { sendApprovalNotification, sendWelcome } = require('../services/email.service');

const router = Router();

router.use(authenticate, authorize('SUPER_ADMIN'));

// POST /api/superadmin/schools — super admin creates a school (goes live immediately)
router.post('/schools', async (req, res, next) => {
  try {
    const { schoolName, city, state, phone, adminFirstName, adminLastName, adminEmail, adminPassword } = req.body;

    if (!schoolName || !adminEmail || !adminPassword || !adminFirstName || !adminLastName) {
      return res.status(400).json({ error: 'School name, admin name, email and password are required.' });
    }
    if (String(adminPassword).length < 8) {
      return res.status(400).json({ error: 'Admin password must be at least 8 characters.' });
    }

    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existing) return res.status(409).json({ error: 'Email already registered.' });

    const baseSlug = schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const uniqueSlug = `${baseSlug}-${uuidv4().slice(0, 6)}`;
    const hashed = await bcrypt.hash(adminPassword, 12);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: schoolName,
          slug: uniqueSlug,
          status: 'ACTIVE', // created by super admin → live immediately
          profile: { create: { schoolName, city: city || null, state: state || null, phone: phone || null } },
        },
        include: { profile: true, _count: { select: { users: true } } },
      });

      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: adminEmail,
          password: hashed,
          role: 'SCHOOL_ADMIN',
          firstName: adminFirstName,
          lastName: adminLastName,
          phone: phone || null,
          isActive: true,
        },
      });

      return tenant;
    });

    const loginUrl = `${process.env.WEB_URL}/login`;
    sendWelcome(adminEmail, schoolName, loginUrl).catch(console.error);

    res.status(201).json({ message: 'School created.', tenant: result });
  } catch (err) {
    next(err);
  }
});

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
