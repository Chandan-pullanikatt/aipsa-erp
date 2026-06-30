const prisma = require('../lib/prisma');

// Ensures requests only access data belonging to the user's tenant.
// Must run after authenticate middleware.
async function requireTenant(req, res, next) {
  if (!req.user.tenantId) {
    return res.status(403).json({ error: 'No tenant associated with this user' });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user.tenantId },
    select: { id: true, status: true, slug: true, profile: { select: { schoolName: true } } },
  });

  if (!tenant) {
    return res.status(403).json({ error: 'Tenant not found' });
  }

  if (tenant.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'School account is suspended. Contact EduBridge support.' });
  }

  req.tenant = tenant;
  next();
}

module.exports = { requireTenant };
