const prisma = require('../lib/prisma');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Resolve the student a portal user (STUDENT/PARENT) is allowed to see. Admins
// and teachers pass an explicit studentId.
async function resolveStudent(tenantId, user, studentId) {
  if (user.role === 'STUDENT') {
    const s = await prisma.student.findFirst({ where: { tenantId, userId: user.id }, select: { id: true } });
    if (!s) throw Object.assign(new Error('Student profile not found'), { status: 404 });
    return s.id;
  }
  if (user.role === 'PARENT') {
    const s = await prisma.student.findFirst({
      where: { tenantId, ...(studentId ? { id: studentId } : {}), guardians: { some: { userId: user.id } } },
      select: { id: true },
    });
    if (!s) throw Object.assign(new Error('Student not found or not linked to you'), { status: 404 });
    return s.id;
  }
  if (!studentId) throw Object.assign(new Error('studentId is required'), { status: 400 });
  return studentId;
}

// ─── Routes (admin) ─────────────────────────────────────────────────────────

async function listRoutes(tenantId) {
  return prisma.busRoute.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: {
      stops: { orderBy: { sequence: 'asc' } },
      _count: { select: { students: true } },
    },
  });
}

async function getRoute(tenantId, id) {
  const route = await prisma.busRoute.findFirst({
    where: { id, tenantId },
    include: {
      stops: { orderBy: { sequence: 'asc' } },
      students: {
        orderBy: { firstName: 'asc' },
        select: { id: true, firstName: true, lastName: true, admissionNumber: true, boardingPoint: true, class: { select: { name: true } } },
      },
    },
  });
  if (!route) throw Object.assign(new Error('Route not found'), { status: 404 });
  return route;
}

async function createRoute(tenantId, data) {
  const { name, routeNumber, busNumber, driverName, driverPhone, capacity, notes } = data;
  return prisma.busRoute.create({
    data: {
      tenantId,
      name: name.trim(),
      routeNumber: routeNumber || undefined,
      busNumber: busNumber || undefined,
      driverName: driverName || undefined,
      driverPhone: driverPhone || undefined,
      capacity: capacity != null && capacity !== '' ? parseInt(capacity) : undefined,
      notes: notes || undefined,
    },
  });
}

async function updateRoute(tenantId, id, data) {
  const route = await prisma.busRoute.findFirst({ where: { id, tenantId } });
  if (!route) throw Object.assign(new Error('Route not found'), { status: 404 });
  const { name, routeNumber, busNumber, driverName, driverPhone, capacity, notes } = data;
  return prisma.busRoute.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(routeNumber !== undefined && { routeNumber: routeNumber || null }),
      ...(busNumber !== undefined && { busNumber: busNumber || null }),
      ...(driverName !== undefined && { driverName: driverName || null }),
      ...(driverPhone !== undefined && { driverPhone: driverPhone || null }),
      ...(capacity !== undefined && { capacity: capacity !== '' && capacity != null ? parseInt(capacity) : null }),
      ...(notes !== undefined && { notes: notes || null }),
    },
  });
}

async function deleteRoute(tenantId, id) {
  const route = await prisma.busRoute.findFirst({ where: { id, tenantId } });
  if (!route) throw Object.assign(new Error('Route not found'), { status: 404 });
  await prisma.busRoute.delete({ where: { id } });
}

async function regenerateTrackToken(tenantId, id) {
  const route = await prisma.busRoute.findFirst({ where: { id, tenantId } });
  if (!route) throw Object.assign(new Error('Route not found'), { status: 404 });
  // cuid() default only fires on create, so set a fresh random token explicitly.
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return prisma.busRoute.update({ where: { id }, data: { trackToken: token }, select: { id: true, trackToken: true } });
}

// ─── Stops (admin) ───────────────────────────────────────────────────────────

async function addStop(tenantId, routeId, data) {
  const route = await prisma.busRoute.findFirst({ where: { id: routeId, tenantId } });
  if (!route) throw Object.assign(new Error('Route not found'), { status: 404 });
  const { name, sequence, pickupTime, dropTime, lat, lng } = data;
  return prisma.routeStop.create({
    data: {
      tenantId,
      routeId,
      name: name.trim(),
      sequence: sequence != null && sequence !== '' ? parseInt(sequence) : 0,
      pickupTime: pickupTime || undefined,
      dropTime: dropTime || undefined,
      lat: lat != null && lat !== '' ? parseFloat(lat) : undefined,
      lng: lng != null && lng !== '' ? parseFloat(lng) : undefined,
    },
  });
}

async function updateStop(tenantId, stopId, data) {
  const stop = await prisma.routeStop.findFirst({ where: { id: stopId, tenantId } });
  if (!stop) throw Object.assign(new Error('Stop not found'), { status: 404 });
  const { name, sequence, pickupTime, dropTime, lat, lng } = data;
  return prisma.routeStop.update({
    where: { id: stopId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(sequence !== undefined && { sequence: sequence !== '' && sequence != null ? parseInt(sequence) : 0 }),
      ...(pickupTime !== undefined && { pickupTime: pickupTime || null }),
      ...(dropTime !== undefined && { dropTime: dropTime || null }),
      ...(lat !== undefined && { lat: lat !== '' && lat != null ? parseFloat(lat) : null }),
      ...(lng !== undefined && { lng: lng !== '' && lng != null ? parseFloat(lng) : null }),
    },
  });
}

async function deleteStop(tenantId, stopId) {
  const stop = await prisma.routeStop.findFirst({ where: { id: stopId, tenantId } });
  if (!stop) throw Object.assign(new Error('Stop not found'), { status: 404 });
  await prisma.routeStop.delete({ where: { id: stopId } });
}

// ─── Student assignment (admin) ───────────────────────────────────────────────

async function assignStudent(tenantId, routeId, studentId, boardingPoint) {
  const [route, student] = await Promise.all([
    prisma.busRoute.findFirst({ where: { id: routeId, tenantId } }),
    prisma.student.findFirst({ where: { id: studentId, tenantId } }),
  ]);
  if (!route) throw Object.assign(new Error('Route not found'), { status: 404 });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return prisma.student.update({
    where: { id: studentId },
    data: { busRouteId: routeId, needsBus: true, boardingPoint: boardingPoint || student.boardingPoint || undefined },
    select: { id: true, firstName: true, lastName: true, busRouteId: true, boardingPoint: true },
  });
}

async function unassignStudent(tenantId, studentId) {
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return prisma.student.update({
    where: { id: studentId },
    data: { busRouteId: null, needsBus: false },
    select: { id: true, busRouteId: true },
  });
}

// ─── Live tracking (driver magic-link, public) ────────────────────────────────

async function getRouteByToken(token) {
  const route = await prisma.busRoute.findUnique({
    where: { trackToken: token },
    select: { id: true, name: true, routeNumber: true, busNumber: true, driverName: true, lastLat: true, lastLng: true, lastLocationAt: true },
  });
  if (!route) throw Object.assign(new Error('Invalid tracking link'), { status: 404 });
  return route;
}

async function pushLocation(token, lat, lng) {
  if (lat == null || lng == null) throw Object.assign(new Error('lat and lng are required'), { status: 400 });
  const route = await prisma.busRoute.findUnique({ where: { trackToken: token }, select: { id: true } });
  if (!route) throw Object.assign(new Error('Invalid tracking link'), { status: 404 });
  await prisma.busRoute.update({
    where: { id: route.id },
    data: { lastLat: parseFloat(lat), lastLng: parseFloat(lng), lastLocationAt: new Date() },
  });
  return { ok: true };
}

async function getLiveLocation(tenantId, routeId) {
  const route = await prisma.busRoute.findFirst({
    where: { id: routeId, tenantId },
    select: { id: true, name: true, busNumber: true, driverName: true, driverPhone: true, lastLat: true, lastLng: true, lastLocationAt: true, stops: { orderBy: { sequence: 'asc' }, select: { name: true, lat: true, lng: true, pickupTime: true } } },
  });
  if (!route) throw Object.assign(new Error('Route not found'), { status: 404 });
  // "Live" if a ping arrived in the last 2 minutes.
  const live = route.lastLocationAt ? (Date.now() - new Date(route.lastLocationAt).getTime() < 120000) : false;
  return { ...route, live };
}

// ─── Portal (student/parent) ──────────────────────────────────────────────────

async function getStudentTransport(tenantId, user, studentId) {
  const sid = await resolveStudent(tenantId, user, studentId);
  const student = await prisma.student.findFirst({
    where: { id: sid, tenantId },
    select: {
      id: true, firstName: true, lastName: true, needsBus: true, boardingPoint: true,
      busRoute: {
        select: {
          id: true, name: true, routeNumber: true, busNumber: true, driverName: true, driverPhone: true,
          lastLat: true, lastLng: true, lastLocationAt: true,
          stops: { orderBy: { sequence: 'asc' } },
        },
      },
    },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  const live = student.busRoute?.lastLocationAt
    ? (Date.now() - new Date(student.busRoute.lastLocationAt).getTime() < 120000)
    : false;
  return { ...student, live };
}

module.exports = {
  listRoutes, getRoute, createRoute, updateRoute, deleteRoute, regenerateTrackToken,
  addStop, updateStop, deleteStop,
  assignStudent, unassignStudent,
  getRouteByToken, pushLocation, getLiveLocation,
  getStudentTransport,
};
