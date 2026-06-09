const prisma = require('../lib/prisma');
const { storage } = require('../lib/storage');

const eventInclude = {
  class: { select: { id: true, name: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  media: { orderBy: { createdAt: 'asc' } },
};

// ─── Admin / teacher ──────────────────────────────────────────────────────────

async function listEvents(tenantId, { classId, scope } = {}) {
  const now = new Date();
  return prisma.schoolEvent.findMany({
    where: {
      tenantId,
      ...(classId && { classId }),
      ...(scope === 'upcoming' && { eventDate: { gte: now } }),
      ...(scope === 'past' && { eventDate: { lt: now } }),
    },
    orderBy: { eventDate: 'desc' },
    include: eventInclude,
  });
}

async function getEvent(tenantId, id) {
  const ev = await prisma.schoolEvent.findFirst({ where: { id, tenantId }, include: eventInclude });
  if (!ev) throw Object.assign(new Error('Event not found'), { status: 404 });
  return ev;
}

async function createEvent(tenantId, createdById, data) {
  const { title, description, eventDate, endDate, location, classId, media } = data;
  if (!eventDate) throw Object.assign(new Error('eventDate is required'), { status: 400 });
  return prisma.schoolEvent.create({
    data: {
      tenantId, createdById,
      title: title.trim(),
      description: description || undefined,
      eventDate: new Date(eventDate),
      endDate: endDate ? new Date(endDate) : undefined,
      location: location || undefined,
      classId: classId || undefined,
      media: Array.isArray(media) && media.length
        ? { create: media.map((m) => ({ tenantId, type: m.type, url: m.url, key: m.key || undefined, caption: m.caption || undefined })) }
        : undefined,
    },
    include: eventInclude,
  });
}

async function updateEvent(tenantId, id, data) {
  const ev = await prisma.schoolEvent.findFirst({ where: { id, tenantId } });
  if (!ev) throw Object.assign(new Error('Event not found'), { status: 404 });
  const { title, description, eventDate, endDate, location, classId } = data;
  return prisma.schoolEvent.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description || null }),
      ...(eventDate !== undefined && { eventDate: new Date(eventDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(location !== undefined && { location: location || null }),
      ...(classId !== undefined && { classId: classId || null }),
    },
    include: eventInclude,
  });
}

async function deleteEvent(tenantId, id) {
  const ev = await prisma.schoolEvent.findFirst({ where: { id, tenantId }, include: { media: true } });
  if (!ev) throw Object.assign(new Error('Event not found'), { status: 404 });
  // Best-effort cleanup of uploaded photos from storage.
  await Promise.all(ev.media.filter((m) => m.key).map((m) => storage.remove(m.key).catch(() => {})));
  await prisma.schoolEvent.delete({ where: { id } });
}

async function addMedia(tenantId, eventId, { type, url, key, caption }) {
  const ev = await prisma.schoolEvent.findFirst({ where: { id: eventId, tenantId } });
  if (!ev) throw Object.assign(new Error('Event not found'), { status: 404 });
  if (!url || !type) throw Object.assign(new Error('type and url are required'), { status: 400 });
  return prisma.eventMedia.create({
    data: { tenantId, eventId, type, url, key: key || undefined, caption: caption || undefined },
  });
}

async function deleteMedia(tenantId, mediaId) {
  const m = await prisma.eventMedia.findFirst({ where: { id: mediaId, tenantId } });
  if (!m) throw Object.assign(new Error('Media not found'), { status: 404 });
  if (m.key) await storage.remove(m.key).catch(() => {});
  await prisma.eventMedia.delete({ where: { id: mediaId } });
}

// ─── Portal (student/parent): school-wide + their class events ─────────────────

async function getEventsForUser(tenantId, user, studentId, { scope } = {}) {
  let classIds = [];
  if (user.role === 'STUDENT') {
    const s = await prisma.student.findFirst({ where: { tenantId, userId: user.id }, select: { classId: true } });
    if (s?.classId) classIds = [s.classId];
  } else if (user.role === 'PARENT') {
    const kids = await prisma.student.findMany({
      where: { tenantId, ...(studentId ? { id: studentId } : {}), guardians: { some: { userId: user.id } } },
      select: { classId: true },
    });
    classIds = kids.map((k) => k.classId).filter(Boolean);
  }

  const now = new Date();
  return prisma.schoolEvent.findMany({
    where: {
      tenantId,
      OR: [{ classId: null }, ...(classIds.length ? [{ classId: { in: classIds } }] : [])],
      ...(scope === 'upcoming' && { eventDate: { gte: now } }),
      ...(scope === 'past' && { eventDate: { lt: now } }),
    },
    orderBy: { eventDate: 'desc' },
    include: eventInclude,
  });
}

module.exports = {
  listEvents, getEvent, createEvent, updateEvent, deleteEvent,
  addMedia, deleteMedia, getEventsForUser,
};
