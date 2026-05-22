const prisma = require('../lib/prisma');

const ROLE_MAP = { ALL: null, SCHOOL_ADMIN: 'SCHOOL_ADMIN', TEACHER: 'TEACHER', STUDENT: 'STUDENT', PARENT: 'PARENT' };

// ─── Announcements ────────────────────────────────────────────────────────────

async function listAnnouncements(tenantId, userRole, { page = 1, limit = 20, type } = {}) {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const now = new Date();
  const where = {
    tenantId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    ...(type && { type }),
  };
  // Filter by role: show if targetRoles contains 'ALL' or the user's role
  // Prisma array contains filter
  const roleFilter = { targetRoles: { has: userRole } };
  const allFilter = { targetRoles: { has: 'ALL' } };

  const [items, total] = await prisma.$transaction([
    prisma.announcement.findMany({
      where: { ...where, OR: [roleFilter, allFilter] },
      skip, take: parseInt(limit),
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    }),
    prisma.announcement.count({ where: { ...where, OR: [roleFilter, allFilter] } }),
  ]);
  return { items, total };
}

async function createAnnouncement(tenantId, createdById, data) {
  const { title, body, type, targetRoles, isPinned, expiresAt } = data;
  const announcement = await prisma.announcement.create({
    data: {
      tenantId, createdById, title, body,
      type: type || 'ANNOUNCEMENT',
      targetRoles: targetRoles || ['ALL'],
      isPinned: isPinned || false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });
  // Create notifications in background
  createAnnouncementNotifications(tenantId, announcement).catch(console.error);
  return announcement;
}

async function createAnnouncementNotifications(tenantId, announcement) {
  const targets = announcement.targetRoles;
  const where = {
    tenantId,
    isActive: true,
    ...(targets.includes('ALL') ? {} : { role: { in: targets } }),
  };
  const users = await prisma.user.findMany({ where, select: { id: true } });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map(u => ({
      tenantId, userId: u.id,
      title: announcement.title,
      body: announcement.body.substring(0, 300),
      type: announcement.type,
      referenceId: announcement.id,
    })),
    skipDuplicates: true,
  });
}

async function updateAnnouncement(tenantId, id, data) {
  const a = await prisma.announcement.findFirst({ where: { id, tenantId } });
  if (!a) throw Object.assign(new Error('Announcement not found'), { status: 404 });
  const { title, body, type, targetRoles, isPinned, expiresAt } = data;
  return prisma.announcement.update({
    where: { id },
    data: {
      ...(title && { title }), ...(body && { body }),
      ...(type && { type }), ...(targetRoles && { targetRoles }),
      ...(isPinned !== undefined && { isPinned }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });
}

async function deleteAnnouncement(tenantId, id) {
  const a = await prisma.announcement.findFirst({ where: { id, tenantId } });
  if (!a) throw Object.assign(new Error('Announcement not found'), { status: 404 });
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { tenantId, referenceId: id } }),
    prisma.announcement.delete({ where: { id } }),
  ]);
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function getNotifications(tenantId, userId, { page = 1, limit = 20 } = {}) {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [items, total, unread] = await prisma.$transaction([
    prisma.notification.findMany({
      where: { tenantId, userId },
      skip, take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where: { tenantId, userId } }),
    prisma.notification.count({ where: { tenantId, userId, isRead: false } }),
  ]);
  return { items, total, unread };
}

async function getUnreadCount(tenantId, userId) {
  const count = await prisma.notification.count({ where: { tenantId, userId, isRead: false } });
  return { count };
}

async function markRead(tenantId, userId, id) {
  const n = await prisma.notification.findFirst({ where: { id, tenantId, userId } });
  if (!n) throw Object.assign(new Error('Notification not found'), { status: 404 });
  return prisma.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
}

async function markAllRead(tenantId, userId) {
  await prisma.notification.updateMany({
    where: { tenantId, userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { message: 'All notifications marked as read.' };
}

async function createNotification(tenantId, userId, { title, body, type = 'INFO', referenceId } = {}) {
  return prisma.notification.create({
    data: { tenantId, userId, title, body, type, referenceId: referenceId || null },
  });
}

module.exports = {
  listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  getNotifications, getUnreadCount, markRead, markAllRead, createNotification,
};