const prisma = require('../lib/prisma');
const notify = require('./notify.service');

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
  // Fan out across all channels (in-app + push + email + sms + whatsapp) in the
  // background, respecting each recipient's preferences. Fire-and-forget.
  notify.notifyRoles(tenantId, announcement.targetRoles, 'ANNOUNCEMENT', {
    title: announcement.title,
    body: announcement.body,
    referenceId: announcement.id,
  });
  return announcement;
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

// ─── Device tokens (push) ──────────────────────────────────────────────────────

async function registerDeviceToken(tenantId, userId, { token, platform = 'android' } = {}) {
  if (!token) throw Object.assign(new Error('token is required'), { status: 422 });
  // Upsert by token; reassign to this user/tenant if the device was reused.
  await prisma.deviceToken.upsert({
    where: { token },
    create: { tenantId, userId, token, platform },
    update: { tenantId, userId, platform },
  });
  return { message: 'Device registered.' };
}

async function removeDeviceToken(tenantId, userId, token) {
  if (!token) throw Object.assign(new Error('token is required'), { status: 422 });
  await prisma.deviceToken.deleteMany({ where: { token, tenantId, userId } });
  return { message: 'Device removed.' };
}

// ─── Notification preferences ──────────────────────────────────────────────────

const PREF_KEYS = ['inApp', 'email', 'push', 'sms', 'whatsapp'];
const DEFAULT_PREFS = { inApp: true, email: true, push: true, sms: false, whatsapp: false };

async function getPreferences(tenantId, userId) {
  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  return pref || { userId, ...DEFAULT_PREFS };
}

async function updatePreferences(tenantId, userId, data = {}) {
  const clean = {};
  for (const k of PREF_KEYS) if (typeof data[k] === 'boolean') clean[k] = data[k];
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { tenantId, userId, ...DEFAULT_PREFS, ...clean },
    update: clean,
  });
}

module.exports = {
  listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  getNotifications, getUnreadCount, markRead, markAllRead, createNotification,
  registerDeviceToken, removeDeviceToken, getPreferences, updatePreferences,
};