const prisma = require('../lib/prisma');
const { createNotification } = require('./communication.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Resolve the student a portal user (STUDENT/PARENT) may act on. Staff pass an
// explicit studentId.
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
  const s = await prisma.student.findFirst({ where: { id: studentId, tenantId }, select: { id: true } });
  if (!s) throw Object.assign(new Error('Student not found'), { status: 404 });
  return s.id;
}

// Notify a student's linked guardians + the student account (best effort).
async function notifyStudentCircle(tenantId, studentId, payload) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
    select: { userId: true, guardians: { where: { userId: { not: null } }, select: { userId: true } } },
  });
  if (!student) return;
  const userIds = [student.userId, ...student.guardians.map((g) => g.userId)].filter(Boolean);
  await Promise.all(userIds.map((uid) => createNotification(tenantId, uid, payload).catch(() => {})));
}

// ─── Hostels (admin) ──────────────────────────────────────────────────────────

async function listHostels(tenantId) {
  const hostels = await prisma.hostel.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { rooms: true, allotments: true } },
      rooms: { select: { capacity: true } },
    },
  });
  return hostels.map((h) => {
    const beds = h.rooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
    const { rooms, ...rest } = h;
    return { ...rest, totalBeds: beds, occupied: h._count.allotments, vacant: Math.max(0, beds - h._count.allotments) };
  });
}

async function getHostel(tenantId, id) {
  const hostel = await prisma.hostel.findFirst({
    where: { id, tenantId },
    include: {
      rooms: {
        orderBy: { roomNumber: 'asc' },
        include: {
          allotments: {
            include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } } } } },
          },
        },
      },
    },
  });
  if (!hostel) throw Object.assign(new Error('Hostel not found'), { status: 404 });
  return hostel;
}

async function createHostel(tenantId, data) {
  const { name, type, wardenName, wardenPhone, address, notes } = data;
  return prisma.hostel.create({
    data: {
      tenantId, name: name.trim(),
      type: type || undefined, wardenName: wardenName || undefined, wardenPhone: wardenPhone || undefined,
      address: address || undefined, notes: notes || undefined,
    },
  });
}

async function updateHostel(tenantId, id, data) {
  const hostel = await prisma.hostel.findFirst({ where: { id, tenantId } });
  if (!hostel) throw Object.assign(new Error('Hostel not found'), { status: 404 });
  const { name, type, wardenName, wardenPhone, address, notes } = data;
  return prisma.hostel.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(type !== undefined && { type: type || null }),
      ...(wardenName !== undefined && { wardenName: wardenName || null }),
      ...(wardenPhone !== undefined && { wardenPhone: wardenPhone || null }),
      ...(address !== undefined && { address: address || null }),
      ...(notes !== undefined && { notes: notes || null }),
    },
  });
}

async function deleteHostel(tenantId, id) {
  const hostel = await prisma.hostel.findFirst({ where: { id, tenantId } });
  if (!hostel) throw Object.assign(new Error('Hostel not found'), { status: 404 });
  await prisma.hostel.delete({ where: { id } });
}

// ─── Rooms (admin) ────────────────────────────────────────────────────────────

async function addRoom(tenantId, hostelId, data) {
  const hostel = await prisma.hostel.findFirst({ where: { id: hostelId, tenantId } });
  if (!hostel) throw Object.assign(new Error('Hostel not found'), { status: 404 });
  const { roomNumber, floor, capacity } = data;
  return prisma.hostelRoom.create({
    data: {
      tenantId, hostelId, roomNumber: roomNumber.trim(),
      floor: floor || undefined,
      capacity: capacity != null && capacity !== '' ? parseInt(capacity) : 1,
    },
  });
}

async function updateRoom(tenantId, roomId, data) {
  const room = await prisma.hostelRoom.findFirst({ where: { id: roomId, tenantId } });
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });
  const { roomNumber, floor, capacity } = data;
  return prisma.hostelRoom.update({
    where: { id: roomId },
    data: {
      ...(roomNumber !== undefined && { roomNumber: roomNumber.trim() }),
      ...(floor !== undefined && { floor: floor || null }),
      ...(capacity !== undefined && { capacity: capacity !== '' && capacity != null ? parseInt(capacity) : 1 }),
    },
  });
}

async function deleteRoom(tenantId, roomId) {
  const room = await prisma.hostelRoom.findFirst({ where: { id: roomId, tenantId } });
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });
  await prisma.hostelRoom.delete({ where: { id: roomId } });
}

// ─── Allotments (admin) ───────────────────────────────────────────────────────

async function allotStudent(tenantId, { roomId, studentId, bedLabel }) {
  const room = await prisma.hostelRoom.findFirst({
    where: { id: roomId, tenantId },
    include: { _count: { select: { allotments: true } } },
  });
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const existing = await prisma.hostelAllotment.findUnique({ where: { studentId } });
  if (existing) throw Object.assign(new Error('Student is already allotted a bed. Vacate first.'), { status: 409 });
  if (room._count.allotments >= room.capacity) {
    throw Object.assign(new Error('Room is full.'), { status: 409 });
  }

  const [allotment] = await prisma.$transaction([
    prisma.hostelAllotment.create({
      data: { tenantId, hostelId: room.hostelId, roomId, studentId, bedLabel: bedLabel || undefined },
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } },
    }),
    // Allotting a bed implies the student is a hosteler.
    prisma.student.update({ where: { id: studentId }, data: { boardingType: 'HOSTELER' } }),
  ]);
  return allotment;
}

async function vacateStudent(tenantId, studentId) {
  const allotment = await prisma.hostelAllotment.findFirst({ where: { studentId, tenantId } });
  if (!allotment) throw Object.assign(new Error('No active allotment for this student'), { status: 404 });
  await prisma.hostelAllotment.delete({ where: { id: allotment.id } });
  return { ok: true };
}

// ─── Mess / food timetable (admin) ────────────────────────────────────────────

async function listMess(tenantId, hostelId) {
  return prisma.messMenu.findMany({
    where: { tenantId, ...(hostelId ? { hostelId } : {}) },
    orderBy: [{ dayOfWeek: 'asc' }, { meal: 'asc' }],
  });
}

async function createMess(tenantId, data) {
  const { hostelId, dayOfWeek, meal, items, time } = data;
  return prisma.messMenu.create({
    data: {
      tenantId, hostelId: hostelId || undefined,
      dayOfWeek: parseInt(dayOfWeek), meal, items: items.trim(), time: time || undefined,
    },
  });
}

async function updateMess(tenantId, id, data) {
  const menu = await prisma.messMenu.findFirst({ where: { id, tenantId } });
  if (!menu) throw Object.assign(new Error('Menu entry not found'), { status: 404 });
  const { dayOfWeek, meal, items, time } = data;
  return prisma.messMenu.update({
    where: { id },
    data: {
      ...(dayOfWeek !== undefined && { dayOfWeek: parseInt(dayOfWeek) }),
      ...(meal !== undefined && { meal }),
      ...(items !== undefined && { items: items.trim() }),
      ...(time !== undefined && { time: time || null }),
    },
  });
}

async function deleteMess(tenantId, id) {
  const menu = await prisma.messMenu.findFirst({ where: { id, tenantId } });
  if (!menu) throw Object.assign(new Error('Menu entry not found'), { status: 404 });
  await prisma.messMenu.delete({ where: { id } });
}

// ─── Gate passes ──────────────────────────────────────────────────────────────

async function listGatePasses(tenantId, { status, studentId } = {}) {
  return prisma.gatePass.findMany({
    where: { tenantId, ...(status ? { status } : {}), ...(studentId ? { studentId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } } } },
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
  });
}

async function createGatePass(tenantId, user, data) {
  const sid = await resolveStudent(tenantId, user, data.studentId);
  const { reason, destination, fromDate, toDate } = data;
  if (!reason || !fromDate || !toDate) throw Object.assign(new Error('reason, fromDate and toDate are required'), { status: 400 });
  const pass = await prisma.gatePass.create({
    data: {
      tenantId, studentId: sid, reason: reason.trim(),
      destination: destination || undefined,
      fromDate: new Date(fromDate), toDate: new Date(toDate),
    },
    include: { student: { select: { firstName: true, lastName: true } } },
  });
  return pass;
}

async function reviewGatePass(tenantId, id, reviewerId, status) {
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw Object.assign(new Error('status must be APPROVED or REJECTED'), { status: 400 });
  }
  const pass = await prisma.gatePass.findFirst({ where: { id, tenantId } });
  if (!pass) throw Object.assign(new Error('Gate pass not found'), { status: 404 });
  if (pass.status !== 'PENDING') throw Object.assign(new Error(`Gate pass already ${pass.status.toLowerCase()}`), { status: 409 });

  const updated = await prisma.gatePass.update({
    where: { id },
    data: { status, reviewedById: reviewerId, reviewedAt: new Date() },
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Notify the student + guardians (no parent approval needed — info only).
  notifyStudentCircle(tenantId, updated.studentId, {
    title: `Gate pass ${status === 'APPROVED' ? 'approved' : 'rejected'}`,
    body: `${updated.student.firstName}'s gate pass (${updated.reason}) was ${status.toLowerCase()}.`,
    type: 'HOSTEL',
    referenceId: id,
  }).catch(() => {});

  return updated;
}

// ─── Complaints / issue reporting ─────────────────────────────────────────────

async function listComplaints(tenantId, { status, studentId } = {}) {
  return prisma.hostelComplaint.findMany({
    where: { tenantId, ...(status ? { status } : {}), ...(studentId ? { studentId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } },
  });
}

async function createComplaint(tenantId, user, data) {
  const sid = await resolveStudent(tenantId, user, data.studentId);
  const { title, category, description } = data;
  if (!title) throw Object.assign(new Error('title is required'), { status: 400 });
  return prisma.hostelComplaint.create({
    data: { tenantId, studentId: sid, title: title.trim(), category: category || undefined, description: description || undefined },
  });
}

async function updateComplaint(tenantId, id, { status, resolution }) {
  const complaint = await prisma.hostelComplaint.findFirst({ where: { id, tenantId } });
  if (!complaint) throw Object.assign(new Error('Complaint not found'), { status: 404 });
  const updated = await prisma.hostelComplaint.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(resolution !== undefined && { resolution: resolution || null }),
      ...(status === 'RESOLVED' && { resolvedAt: new Date() }),
    },
  });
  if (status) {
    notifyStudentCircle(tenantId, updated.studentId, {
      title: `Complaint ${status.toLowerCase().replace('_', ' ')}`,
      body: `Your hostel complaint "${updated.title}" is now ${status.toLowerCase().replace('_', ' ')}.`,
      type: 'HOSTEL',
      referenceId: id,
    }).catch(() => {});
  }
  return updated;
}

// ─── Portal (student/parent) ──────────────────────────────────────────────────

async function getStudentHostel(tenantId, user, studentId) {
  const sid = await resolveStudent(tenantId, user, studentId);
  const student = await prisma.student.findFirst({
    where: { id: sid, tenantId },
    select: {
      id: true, firstName: true, lastName: true, boardingType: true,
      hostelAllotment: {
        include: {
          room: { select: { roomNumber: true, floor: true } },
          hostel: { select: { id: true, name: true, type: true, wardenName: true, wardenPhone: true } },
        },
      },
    },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const hostelId = student.hostelAllotment?.hostel?.id;
  const [mess, gatePasses, complaints, approvedLeaves] = await Promise.all([
    hostelId
      ? prisma.messMenu.findMany({ where: { tenantId, OR: [{ hostelId }, { hostelId: null }] }, orderBy: [{ dayOfWeek: 'asc' }, { meal: 'asc' }] })
      : prisma.messMenu.findMany({ where: { tenantId, hostelId: null }, orderBy: [{ dayOfWeek: 'asc' }, { meal: 'asc' }] }),
    prisma.gatePass.findMany({ where: { tenantId, studentId: sid }, orderBy: { createdAt: 'desc' } }),
    prisma.hostelComplaint.findMany({ where: { tenantId, studentId: sid }, orderBy: { createdAt: 'desc' } }),
    prisma.gatePass.count({ where: { tenantId, studentId: sid, status: 'APPROVED' } }),
  ]);

  return { ...student, mess, gatePasses, complaints, leavesTaken: approvedLeaves };
}

module.exports = {
  listHostels, getHostel, createHostel, updateHostel, deleteHostel,
  addRoom, updateRoom, deleteRoom,
  allotStudent, vacateStudent,
  listMess, createMess, updateMess, deleteMess,
  listGatePasses, createGatePass, reviewGatePass,
  listComplaints, createComplaint, updateComplaint,
  getStudentHostel,
};
