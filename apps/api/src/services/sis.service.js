const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

function generatePortalPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Classes ─────────────────────────────────────────────────────────────────

async function listClasses(tenantId) {
  return prisma.class.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { sections: true, students: true } },
    },
  });
}

async function createClass(tenantId, { name }) {
  return prisma.class.create({
    data: { tenantId, name: name.trim() },
    include: { _count: { select: { sections: true, students: true } } },
  });
}

async function updateClass(tenantId, id, { name }) {
  const cls = await prisma.class.findFirst({ where: { id, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.class.update({
    where: { id },
    data: { name: name.trim() },
    include: { _count: { select: { sections: true, students: true } } },
  });
}

async function deleteClass(tenantId, id) {
  const cls = await prisma.class.findFirst({ where: { id, tenantId }, include: { _count: { select: { students: true } } } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  if (cls._count.students > 0) throw Object.assign(new Error('Cannot delete class with enrolled students'), { status: 409 });
  await prisma.class.delete({ where: { id } });
}

// ─── Sections ────────────────────────────────────────────────────────────────

async function listSections(tenantId, classId) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.section.findMany({
    where: { classId, tenantId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { students: true } } },
  });
}

async function createSection(tenantId, classId, { name }) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.section.create({
    data: { tenantId, classId, name: name.trim() },
    include: { _count: { select: { students: true } } },
  });
}

async function updateSection(tenantId, id, { name }) {
  const sec = await prisma.section.findFirst({ where: { id, tenantId } });
  if (!sec) throw Object.assign(new Error('Section not found'), { status: 404 });
  return prisma.section.update({
    where: { id },
    data: { name: name.trim() },
    include: { _count: { select: { students: true } } },
  });
}

async function deleteSection(tenantId, id) {
  const sec = await prisma.section.findFirst({ where: { id, tenantId }, include: { _count: { select: { students: true } } } });
  if (!sec) throw Object.assign(new Error('Section not found'), { status: 404 });
  if (sec._count.students > 0) throw Object.assign(new Error('Cannot delete section with enrolled students'), { status: 409 });
  await prisma.section.delete({ where: { id } });
}

// ─── Students ────────────────────────────────────────────────────────────────

async function generateAdmissionNumber(tenantId) {
  const year = new Date().getFullYear();
  const count = await prisma.student.count({ where: { tenantId } });
  return `ADM-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function listStudents(tenantId, { classId, sectionId, status, search, page = 1, limit = 20 }) {
  const where = {
    tenantId,
    ...(classId && { classId }),
    ...(sectionId && { sectionId }),
    ...(status && { status }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { admissionNumber: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ],
    }),
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [students, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        guardians: { where: { isPrimary: true }, select: { firstName: true, lastName: true, phone: true, relation: true }, take: 1 },
      },
    }),
    prisma.student.count({ where }),
  ]);

  return { students, total, page: parseInt(page), limit: parseInt(limit) };
}

async function getStudent(tenantId, id) {
  const student = await prisma.student.findFirst({
    where: { id, tenantId },
    include: {
      class: true,
      section: true,
      guardians: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
    },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return student;
}

async function createStudent(tenantId, data) {
  const admissionNumber = await generateAdmissionNumber(tenantId);
  const {
    firstName, lastName, dateOfBirth, gender, bloodGroup,
    address, city, state, phone, classId, sectionId, admissionDate,
  } = data;

  if (classId) {
    const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
    if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  }
  if (sectionId) {
    const sec = await prisma.section.findFirst({ where: { id: sectionId, tenantId } });
    if (!sec) throw Object.assign(new Error('Section not found'), { status: 404 });
  }

  const plainPin = generatePortalPin();
  const hashedPin = await bcrypt.hash(plainPin, 10);

  const student = await prisma.student.create({
    data: {
      tenantId,
      admissionNumber,
      portalPin: hashedPin,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender: gender || undefined,
      bloodGroup: bloodGroup || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      phone: phone || undefined,
      classId: classId || undefined,
      sectionId: sectionId || undefined,
      admissionDate: admissionDate ? new Date(admissionDate) : undefined,
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });

  const { portalPin: _pin, ...studentData } = student;
  return { ...studentData, portalPin: plainPin };
}

async function updateStudent(tenantId, id, data) {
  const student = await prisma.student.findFirst({ where: { id, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const {
    firstName, lastName, dateOfBirth, gender, bloodGroup,
    address, city, state, phone, classId, sectionId, status,
  } = data;

  return prisma.student.update({
    where: { id },
    data: {
      ...(firstName && { firstName: firstName.trim() }),
      ...(lastName && { lastName: lastName.trim() }),
      ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
      ...(gender !== undefined && { gender: gender || null }),
      ...(bloodGroup !== undefined && { bloodGroup: bloodGroup || null }),
      ...(address !== undefined && { address: address || null }),
      ...(city !== undefined && { city: city || null }),
      ...(state !== undefined && { state: state || null }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(classId !== undefined && { classId: classId || null }),
      ...(sectionId !== undefined && { sectionId: sectionId || null }),
      ...(status && { status }),
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      guardians: true,
    },
  });
}

// ─── Guardians ───────────────────────────────────────────────────────────────

async function listGuardians(tenantId, studentId) {
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return prisma.guardian.findMany({
    where: { studentId, tenantId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
}

async function createGuardian(tenantId, studentId, data) {
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const { firstName, lastName, relation, phone, email, occupation, isPrimary } = data;

  return prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.guardian.updateMany({ where: { studentId, tenantId }, data: { isPrimary: false } });
    }
    return tx.guardian.create({
      data: {
        tenantId, studentId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        relation,
        phone,
        email: email || undefined,
        occupation: occupation || undefined,
        isPrimary: isPrimary ?? false,
      },
    });
  });
}

async function updateGuardian(tenantId, id, data) {
  const guardian = await prisma.guardian.findFirst({ where: { id, tenantId } });
  if (!guardian) throw Object.assign(new Error('Guardian not found'), { status: 404 });

  const { firstName, lastName, relation, phone, email, occupation, isPrimary } = data;

  return prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.guardian.updateMany({ where: { studentId: guardian.studentId, tenantId }, data: { isPrimary: false } });
    }
    return tx.guardian.update({
      where: { id },
      data: {
        ...(firstName && { firstName: firstName.trim() }),
        ...(lastName && { lastName: lastName.trim() }),
        ...(relation && { relation }),
        ...(phone && { phone }),
        ...(email !== undefined && { email: email || null }),
        ...(occupation !== undefined && { occupation: occupation || null }),
        ...(isPrimary !== undefined && { isPrimary }),
      },
    });
  });
}

async function deleteGuardian(tenantId, id) {
  const guardian = await prisma.guardian.findFirst({ where: { id, tenantId } });
  if (!guardian) throw Object.assign(new Error('Guardian not found'), { status: 404 });
  await prisma.guardian.delete({ where: { id } });
}

async function getPortalPin(tenantId, studentId) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  // Always generate a fresh PIN — stored value is a bcrypt hash, not recoverable.
  const plainPin = generatePortalPin();
  await prisma.student.update({ where: { id: studentId }, data: { portalPin: await bcrypt.hash(plainPin, 10) } });
  return { ...student, portalPin: plainPin };
}

async function getStudentByUserId(tenantId, userId) {
  const student = await prisma.student.findFirst({
    where: { tenantId, userId },
    include: { class: true, section: true },
  });
  if (!student) throw Object.assign(new Error('Student profile not found'), { status: 404 });
  return student;
}

async function getParentStudents(tenantId, userId) {
  const students = await prisma.student.findMany({
    where: {
      tenantId,
      OR: [
        { userId },
        { guardians: { some: { userId } } }
      ]
    },
    orderBy: { firstName: 'asc' },
    include: {
      class: true,
      section: true
    }
  });
  return students.map(({ portalPin: _pin, ...s }) => s);
}

module.exports = {
  listClasses, createClass, updateClass, deleteClass,
  listSections, createSection, updateSection, deleteSection,
  listStudents, getStudent, createStudent, updateStudent,
  listGuardians, createGuardian, updateGuardian, deleteGuardian,
  getPortalPin, getParentStudents, getStudentByUserId,
};
