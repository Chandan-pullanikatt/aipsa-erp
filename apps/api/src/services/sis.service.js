const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { sendStudentApproval } = require('./email.service');

function generatePortalPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Classes ─────────────────────────────────────────────────────────────────

const CLASS_INCLUDE = {
  _count: { select: { sections: true, students: true } },
  inchargeTeacher: { select: { id: true, firstName: true, lastName: true } },
};

async function listClasses(tenantId) {
  return prisma.class.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: CLASS_INCLUDE,
  });
}

async function createClass(tenantId, { name }) {
  return prisma.class.create({
    data: { tenantId, name: name.trim() },
    include: CLASS_INCLUDE,
  });
}

async function updateClass(tenantId, id, { name }) {
  const cls = await prisma.class.findFirst({ where: { id, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.class.update({
    where: { id },
    data: { name: name.trim() },
    include: CLASS_INCLUDE,
  });
}

async function patchClass(tenantId, classId, { name, inchargeTeacherId }) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (inchargeTeacherId !== undefined) data.inchargeTeacherId = inchargeTeacherId || null;
  return prisma.class.update({ where: { id: classId }, data, include: CLASS_INCLUDE });
}

async function deleteClass(tenantId, id) {
  const cls = await prisma.class.findFirst({ where: { id, tenantId }, include: { _count: { select: { students: true } } } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  if (cls._count.students > 0) throw Object.assign(new Error('Cannot delete class with enrolled students'), { status: 409 });
  await prisma.class.delete({ where: { id } });
}

// ─── Sections ────────────────────────────────────────────────────────────────

const SECTION_INCLUDE = {
  _count: { select: { students: true } },
  inchargeTeacher: { select: { id: true, firstName: true, lastName: true } },
};

async function listSections(tenantId, classId) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.section.findMany({
    where: { classId, tenantId },
    orderBy: { name: 'asc' },
    include: SECTION_INCLUDE,
  });
}

async function createSection(tenantId, classId, { name }) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.section.create({
    data: { tenantId, classId, name: name.trim() },
    include: SECTION_INCLUDE,
  });
}

async function updateSection(tenantId, id, { name }) {
  const sec = await prisma.section.findFirst({ where: { id, tenantId } });
  if (!sec) throw Object.assign(new Error('Section not found'), { status: 404 });
  return prisma.section.update({
    where: { id },
    data: { name: name.trim() },
    include: SECTION_INCLUDE,
  });
}

async function patchSection(tenantId, id, { inchargeTeacherId }) {
  const sec = await prisma.section.findFirst({ where: { id, tenantId } });
  if (!sec) throw Object.assign(new Error('Section not found'), { status: 404 });
  const data = {};
  if (inchargeTeacherId !== undefined) data.inchargeTeacherId = inchargeTeacherId || null;
  return prisma.section.update({ where: { id }, data, include: SECTION_INCLUDE });
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
    photoUrl, boardingType, needsBus,
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
      photoUrl: photoUrl || undefined,
      boardingType: boardingType || undefined,
      needsBus: needsBus !== undefined ? !!needsBus : undefined,
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
    photoUrl, boardingType, needsBus,
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
      ...(photoUrl !== undefined && { photoUrl: photoUrl || null }),
      ...(boardingType !== undefined && { boardingType: boardingType || 'DAY_SCHOLAR' }),
      ...(needsBus !== undefined && { needsBus: !!needsBus }),
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

async function setFeeAccessOverride(tenantId, studentId, enabled) {
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return prisma.student.update({
    where: { id: studentId },
    data: { feeAccessOverride: !!enabled },
    include: { class: true, section: true, guardians: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
  });
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

// ─── Class Join Codes ─────────────────────────────────────────────────────────

const CLASS_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateClassCode(className) {
  const prefix = className.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  const suffix = Array.from({ length: 4 }, () =>
    CLASS_CODE_CHARS[Math.floor(Math.random() * CLASS_CODE_CHARS.length)]
  ).join('');
  return `${prefix}-${suffix}`;
}

async function generateClassJoinCode(tenantId, classId) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });

  let code;
  let attempts = 0;
  do {
    code = generateClassCode(cls.name);
    const existing = await prisma.class.findUnique({ where: { joinCode: code } });
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  return prisma.class.update({
    where: { id: classId },
    data: { joinCode: code },
    select: { id: true, name: true, joinCode: true },
  });
}

async function getClassJoinCode(tenantId, classId) {
  const cls = await prisma.class.findFirst({
    where: { id: classId, tenantId },
    select: { id: true, name: true, joinCode: true },
  });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return cls;
}

async function listClassJoinCodes(tenantId) {
  return prisma.class.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, joinCode: true,
      _count: { select: { students: true, joinRequests: true } },
    },
  });
}

// ─── Public: Lookup class by join code (for confirmation UI) ──────────────────

async function lookupClassByJoinCode(joinCode) {
  const cls = await prisma.class.findUnique({
    where: { joinCode },
    include: {
      tenant: {
        select: { status: true, profile: { select: { schoolName: true } } },
      },
    },
  });
  if (!cls) throw Object.assign(new Error('Invalid class code'), { status: 404 });
  if (cls.tenant.status !== 'ACTIVE') {
    throw Object.assign(new Error('This school is not currently accepting registrations'), { status: 403 });
  }
  return {
    classId: cls.id,
    className: cls.name,
    schoolName: cls.tenant.profile?.schoolName || 'Unknown School',
  };
}

// ─── Class Join Requests ──────────────────────────────────────────────────────

async function createStudentJoinRequest(joinCode, {
  firstName, lastName, dateOfBirth, gender, bloodGroup, phone,
  address, city, state, photoUrl, parentPhone, email,
}) {
  const cls = await prisma.class.findUnique({
    where: { joinCode },
    include: { tenant: { select: { id: true, status: true } } },
  });
  if (!cls) throw Object.assign(new Error('Invalid class code'), { status: 404 });
  if (cls.tenant.status !== 'ACTIVE') {
    throw Object.assign(new Error('School is not currently accepting registrations'), { status: 403 });
  }

  // Prevent duplicate pending request from the same email for the same class
  const existing = await prisma.classJoinRequest.findFirst({
    where: { classId: cls.id, email: email.toLowerCase(), status: 'PENDING' },
  });
  if (existing) {
    throw Object.assign(new Error('A pending request already exists for this email in this class'), { status: 409 });
  }

  return prisma.classJoinRequest.create({
    data: {
      tenantId: cls.tenant.id,
      classId: cls.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender: gender || undefined,
      bloodGroup: bloodGroup?.trim() || undefined,
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined,
      city: city?.trim() || undefined,
      state: state?.trim() || undefined,
      photoUrl: photoUrl?.trim() || undefined,
      parentPhone: parentPhone.trim(),
      email: email.trim().toLowerCase(),
    },
    select: {
      id: true, firstName: true, lastName: true, email: true, status: true, createdAt: true,
      gender: true, bloodGroup: true, phone: true, address: true, city: true, state: true, photoUrl: true,
      class: { select: { name: true } },
    },
  });
}

async function listJoinRequests(tenantId, { classId, status = 'PENDING', page = 1, limit = 50 }) {
  const where = {
    tenantId,
    ...(classId && { classId }),
    ...(status && { status }),
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [requests, total] = await prisma.$transaction([
    prisma.classJoinRequest.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            // Sections travel with the request so the reviewer can pick one at approval
            // time — the requesting student has no way to know their section.
            sections: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
          },
        },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.classJoinRequest.count({ where }),
  ]);

  return { requests, total, page: parseInt(page), limit: parseInt(limit) };
}

// Default password pattern: aipsa{firstWordOfSchool}{admissionNumber}, sanitized.
// Uses the admission number (unique per student) instead of DOB, which is not
// unique. Example: school "AIPSA Public School" + "ADM-2026-0001" -> "aipsaaipsaadm20260001".
// Deterministic so the school can recite it; students change it on first login.
function buildDefaultPassword(schoolName, admissionNumber) {
  const firstWord = (schoolName || '').trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const adm = String(admissionNumber || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `aipsa${firstWord}${adm}`;
}

async function approveJoinRequest(tenantId, requestId, reviewerId, { sectionId } = {}) {
  const req = await prisma.classJoinRequest.findFirst({
    where: { id: requestId, tenantId },
    include: {
      class: { select: { id: true, name: true } },
      tenant: { select: { slug: true, name: true } },
    },
  });
  if (!req) throw Object.assign(new Error('Request not found'), { status: 404 });
  if (req.status !== 'PENDING') {
    throw Object.assign(new Error(`Request is already ${req.status.toLowerCase()}`), { status: 409 });
  }

  // Section is optional, but if given it must belong to the class being joined.
  let sectionName = null;
  if (sectionId) {
    const section = await prisma.section.findFirst({
      where: { id: sectionId, tenantId, classId: req.classId },
      select: { name: true },
    });
    if (!section) throw Object.assign(new Error('Section not found in this class'), { status: 404 });
    sectionName = section.name;
  }

  // Check email not already used
  const existingUser = await prisma.user.findUnique({ where: { email: req.email } });
  if (existingUser) {
    throw Object.assign(new Error('An account with this email already exists'), { status: 409 });
  }

  const admissionNumber = await generateAdmissionNumber(tenantId);
  const plainPin = generatePortalPin();
  const hashedPin = await bcrypt.hash(plainPin, 10);
  const defaultPassword = buildDefaultPassword(req.tenant.name, admissionNumber);
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    // Create User account
    const user = await tx.user.create({
      data: {
        tenantId,
        email: req.email,
        password: hashedPassword,
        role: 'STUDENT',
        firstName: req.firstName,
        lastName: req.lastName,
        isActive: true,
        mustChangePassword: true,
      },
    });

    // Create Student record
    const student = await tx.student.create({
      data: {
        tenantId,
        admissionNumber,
        portalPin: hashedPin,
        firstName: req.firstName,
        lastName: req.lastName,
        dateOfBirth: req.dateOfBirth || undefined,
        gender: req.gender || undefined,
        bloodGroup: req.bloodGroup || undefined,
        // The request's own "phone" field is the student's contact number, kept
        // distinct from parentPhone (used only to reach a guardian pre-admission).
        phone: req.phone || req.parentPhone,
        address: req.address || undefined,
        city: req.city || undefined,
        state: req.state || undefined,
        photoUrl: req.photoUrl || undefined,
        classId: req.classId,
        sectionId: sectionId || undefined,
        userId: user.id,
        status: 'ACTIVE',
      },
    });

    // Mark request approved
    await tx.classJoinRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: reviewerId },
    });

    return { user, student, defaultPassword };
  });

  const loginUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/login`;
  sendStudentApproval(req.email, {
    firstName: req.firstName,
    schoolName: req.tenant.name,
    admissionNumber,
    tempPassword: result.defaultPassword,
    loginUrl,
  }).catch(() => {}); // fire-and-forget — don't block or fail the response

  return {
    message: 'Student approved and account created.',
    admissionNumber,
    defaultPassword: result.defaultPassword,
    studentId: result.student.id,
    className: req.class.name,
    sectionName,
  };
}

async function resetStudentPassword(tenantId, studentId) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
    select: { id: true, admissionNumber: true, firstName: true, lastName: true, user: { select: { id: true } } },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  if (!student.user) throw Object.assign(new Error('Student has no login account yet'), { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const defaultPassword = buildDefaultPassword(tenant.name, student.admissionNumber);
  const hashed = await bcrypt.hash(defaultPassword, 12);

  await prisma.user.update({
    where: { id: student.user.id },
    data: { password: hashed, mustChangePassword: true },
  });

  return { defaultPassword };
}

async function rejectJoinRequest(tenantId, requestId, reviewerId) {
  const req = await prisma.classJoinRequest.findFirst({
    where: { id: requestId, tenantId },
  });
  if (!req) throw Object.assign(new Error('Request not found'), { status: 404 });
  if (req.status !== 'PENDING') {
    throw Object.assign(new Error(`Request is already ${req.status.toLowerCase()}`), { status: 409 });
  }

  return prisma.classJoinRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', reviewedAt: new Date(), reviewedById: reviewerId },
    select: { id: true, firstName: true, lastName: true, status: true },
  });
}

// ─── Student Activities ────────────────────────────────────────────────────────

async function listStudentActivities(tenantId, studentId) {
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return prisma.studentActivity.findMany({
    where: { tenantId, studentId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: {
      addedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
}

async function createStudentActivity(tenantId, studentId, { type, title, description, date }, addedById) {
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  const validTypes = ['DISCIPLINARY', 'ACHIEVEMENT', 'REMARK'];
  if (!validTypes.includes(type)) throw Object.assign(new Error('Invalid activity type'), { status: 422 });
  return prisma.studentActivity.create({
    data: {
      tenantId,
      studentId,
      type,
      title: title.trim(),
      description: description?.trim() || undefined,
      date: new Date(date),
      addedById,
    },
    include: {
      addedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
}

async function deleteStudentActivity(tenantId, activityId, requesterId, requesterRole) {
  const activity = await prisma.studentActivity.findFirst({ where: { id: activityId, tenantId } });
  if (!activity) throw Object.assign(new Error('Activity not found'), { status: 404 });
  const isAdmin = requesterRole === 'SCHOOL_ADMIN';
  const isCreator = activity.addedById === requesterId;
  if (!isAdmin && !isCreator) {
    throw Object.assign(new Error('You can only delete your own activity records'), { status: 403 });
  }
  await prisma.studentActivity.delete({ where: { id: activityId } });
}

module.exports = {
  listClasses, createClass, updateClass, deleteClass, patchClass,
  listSections, createSection, updateSection, patchSection, deleteSection,
  listStudents, getStudent, createStudent, updateStudent,
  listGuardians, createGuardian, updateGuardian, deleteGuardian,
  getPortalPin, getParentStudents, getStudentByUserId, setFeeAccessOverride,
  // Class join codes
  generateClassJoinCode, getClassJoinCode, listClassJoinCodes,
  lookupClassByJoinCode,
  // Join requests
  createStudentJoinRequest, listJoinRequests, approveJoinRequest, rejectJoinRequest, resetStudentPassword,
  // Student activities
  listStudentActivities, createStudentActivity, deleteStudentActivity,
};
