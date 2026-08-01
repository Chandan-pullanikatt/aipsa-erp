const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Roles that count as employees for the HR directory. Admins and teachers are
// staff too; non-teaching staff use the dedicated STAFF role.
const STAFF_ROLES = ['SCHOOL_ADMIN', 'TEACHER', 'STAFF'];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Temp password the admin can read down a phone line: full name + "erp".
 *
 * The full name, not just the first: a staff room holds several Anithas, and on
 * first-name-only passwords each of them could guess the others'. Padded with
 * the year when a short name would fall under the 8 characters the
 * change-password endpoint demands, so every member can replace what they were
 * given. Every account is created with `mustChangePassword`, so the readable
 * value is only valid until first sign-in.
 */
function tempPasswordFor(firstName, lastName) {
  const stem = `${slug(firstName)}${slug(lastName)}erp`;
  return stem.length >= 8 ? stem : `${stem}${new Date().getFullYear()}`;
}

// ─── Departments ──────────────────────────────────────────────────────────────

async function listDepartments(tenantId) {
  return prisma.department.findMany({
    where: { tenantId },
    include: {
      head: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { staff: true } },
    },
    orderBy: { name: 'asc' },
  });
}

async function createDepartment(tenantId, { name, headId }) {
  if (headId) await assertUserInTenant(tenantId, headId);
  try {
    return await prisma.department.create({
      data: { tenantId, name: name.trim(), headId: headId || null },
    });
  } catch (err) {
    if (err.code === 'P2002') throw conflict('A department with this name already exists');
    throw err;
  }
}

async function updateDepartment(tenantId, id, { name, headId }) {
  await assertDepartmentInTenant(tenantId, id);
  if (headId) await assertUserInTenant(tenantId, headId);
  try {
    return await prisma.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(headId !== undefined && { headId: headId || null }),
      },
    });
  } catch (err) {
    if (err.code === 'P2002') throw conflict('A department with this name already exists');
    throw err;
  }
}

async function deleteDepartment(tenantId, id) {
  await assertDepartmentInTenant(tenantId, id);
  // StaffProfile.departmentId is SetNull on delete — staff are detached, not removed.
  await prisma.department.delete({ where: { id } });
  return { deleted: true };
}

// ─── Staff Directory ────────────────────────────────────────────────────────────

async function listStaff(tenantId, { search, departmentId, role } = {}) {
  const where = {
    tenantId,
    role: role && STAFF_ROLES.includes(role) ? role : { in: STAFF_ROLES },
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(departmentId && { staffProfile: { departmentId } }),
  };

  return prisma.user.findMany({
    where,
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true,
      photoUrl: true, role: true, isActive: true, createdAt: true,
      staffProfile: {
        include: { department: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getStaff(tenantId, userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: { in: STAFF_ROLES } },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true,
      photoUrl: true, role: true, isActive: true, createdAt: true,
      staffProfile: {
        include: { department: { select: { id: true, name: true } } },
      },
    },
  });
  if (!user) throw notFound('Staff member not found');
  return user;
}

// Creates a login account (role STAFF or TEACHER) plus its employment record in
// one transaction. Returns the generated temp password for the admin to share;
// the staff member must change it on first login.
async function createStaff(tenantId, data) {
  const {
    email, firstName, lastName, phone, role = 'STAFF', profile = {},
    // Bulk imports derive a predictable password per row so the admin can hand
    // out one legible sheet; single creates keep the random default.
    password,
  } = data;
  if (!['STAFF', 'TEACHER'].includes(role)) throw badRequest('Role must be STAFF or TEACHER');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict('A user with this email already exists');

  if (profile.departmentId) await assertDepartmentInTenant(tenantId, profile.departmentId);

  const tempPassword = password || tempPasswordFor(firstName, lastName);
  const hashed = await bcrypt.hash(tempPassword, 12);

  try {
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: email.trim(),
        password: hashed,
        role,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone ? phone.trim() : null,
        isActive: true,
        mustChangePassword: true,
        staffProfile: { create: buildProfileData(tenantId, profile) },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        role: true, isActive: true,
        staffProfile: { include: { department: { select: { id: true, name: true } } } },
      },
    });
    return { ...user, tempPassword };
  } catch (err) {
    if (err.code === 'P2002') throw conflict('Employee ID already in use');
    throw err;
  }
}

// Upserts the employment record for an existing staff/teacher user.
async function updateStaffProfile(tenantId, userId, profile) {
  await assertUserInTenant(tenantId, userId, STAFF_ROLES);
  if (profile.departmentId) await assertDepartmentInTenant(tenantId, profile.departmentId);

  const data = buildProfileData(tenantId, profile);
  try {
    return await prisma.staffProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      include: { department: { select: { id: true, name: true } } },
    });
  } catch (err) {
    if (err.code === 'P2002') throw conflict('Employee ID already in use');
    throw err;
  }
}

// Deactivates or reactivates a staff/teacher account. Deactivation is a soft
// delete: it blocks login (auth checks isActive) and stops push delivery, but
// preserves the user's financial/academic records, which the school is required
// to retain. Hard erasure is handled separately by the grace-period purge job.
async function setStaffStatus(tenantId, userId, isActive, actingUser, { ipAddress } = {}) {
  // Admins must not lock themselves out, and a school must never be left without
  // an active admin to manage it.
  if (actingUser && userId === actingUser.id) {
    throw badRequest('You cannot change your own account status');
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: { in: STAFF_ROLES } },
    select: { id: true, role: true, email: true, isActive: true },
  });
  if (!user) throw notFound('Staff member not found');

  if (!isActive && user.role === 'SCHOOL_ADMIN') {
    const activeAdmins = await prisma.user.count({
      where: { tenantId, role: 'SCHOOL_ADMIN', isActive: true },
    });
    if (activeAdmins <= 1) throw conflict('Cannot deactivate the last active school admin');
  }

  // No-op if already in the requested state — return the current record.
  if (user.isActive === isActive) return getStaff(tenantId, userId);

  await prisma.$transaction([
    // Deactivation stops push delivery immediately (matches account-deletion flow).
    ...(!isActive ? [prisma.deviceToken.deleteMany({ where: { userId } })] : []),
    prisma.user.update({ where: { id: userId }, data: { isActive } }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: actingUser ? actingUser.id : null,
        action: isActive ? 'STAFF_REACTIVATED' : 'STAFF_DEACTIVATED',
        entity: 'User',
        entityId: userId,
        meta: { email: user.email, role: user.role },
        ipAddress: ipAddress || null,
      },
    }),
  ]);

  return getStaff(tenantId, userId);
}

// Sets or clears the directory photo. `photoUrl` null removes it. The caller
// uploads through the shared storage adapter first and passes the returned url.
async function setStaffPhoto(tenantId, userId, photoUrl) {
  await assertUserInTenant(tenantId, userId, STAFF_ROLES);
  await prisma.user.update({ where: { id: userId }, data: { photoUrl } });
  return getStaff(tenantId, userId);
}

// Relations that mean this person is part of the school's record, not a typo in
// the import sheet. Each is a required FK (Restrict) or history the school is
// expected to keep, so removing the user would either fail at the database or
// quietly take academic data with it.
const HISTORY_RELATIONS = [
  ['homework', (id) => prisma.homework.count({ where: { teacherId: id } })],
  ['fee payments collected', (id) => prisma.feePayment.count({ where: { collectedById: id } })],
  ['announcements', (id) => prisma.announcement.count({ where: { createdById: id } })],
  ['graded submissions', (id) => prisma.homeworkSubmission.count({ where: { gradedById: id } })],
  ['attendance records', (id) => prisma.attendance.count({ where: { userId: id } })],
  ['student activities', (id) => prisma.studentActivity.count({ where: { addedById: id } })],
  ['library issues', (id) => prisma.bookIssue.count({ where: { issuedById: id } })],
  ['events', (id) => prisma.schoolEvent.count({ where: { createdById: id } })],
  ['purchases', (id) => prisma.purchase.count({ where: { recordedById: id } })],
  ['fee waivers', (id) => prisma.lateFeeWaiver.count({ where: { waivedById: id } })],
  ['timetable periods', (id) => prisma.period.count({ where: { teacherId: id } })],
  ['subjects', (id) => prisma.subject.count({ where: { teacherId: id } })],
];

/**
 * Permanently removes a staff/teacher account.
 *
 * Deliberately narrow: this exists to undo a mistake — a duplicate row in an
 * import sheet, a person who never joined — not to remove someone who has
 * worked here. Anyone carrying academic or financial history is refused with a
 * 409 pointing at deactivation, which is the correct tool for a leaver and
 * preserves the records the school must retain. Without that guard the delete
 * would either fail on a foreign key or cascade into homework and marks.
 */
async function deleteStaff(tenantId, userId, actingUser) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: { in: STAFF_ROLES } },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, photoUrl: true },
  });
  if (!user) throw notFound('Staff member not found');

  if (actingUser && userId === actingUser.id) {
    throw badRequest('You cannot delete your own account');
  }

  if (user.role === 'SCHOOL_ADMIN') {
    const admins = await prisma.user.count({ where: { tenantId, role: 'SCHOOL_ADMIN' } });
    if (admins <= 1) throw conflict('Cannot delete the last school admin');
  }

  const counts = await Promise.all(HISTORY_RELATIONS.map(([label, count]) =>
    count(userId).then((n) => [label, n])));
  const blocking = counts.filter(([, n]) => n > 0).map(([label]) => label);
  if (blocking.length) {
    throw conflict(
      `${user.firstName} ${user.lastName} has school records (${blocking.join(', ')}) and cannot be deleted. `
      + 'Deactivate the account instead — this keeps the records and blocks sign-in.',
    );
  }

  // The audit row outlives the user (auditLog.userId is not a foreign key to a
  // required relation), so the deletion itself stays accountable.
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actingUser ? actingUser.id : null,
      action: 'STAFF_DELETED',
      entity: 'User',
      entityId: userId,
      meta: { email: user.email, role: user.role, name: `${user.firstName} ${user.lastName}`.trim() },
    },
  });

  // Remaining relations (staff profile, device tokens, notification prefs,
  // subject assignments) are all onDelete: Cascade and carry nothing of record.
  await prisma.user.delete({ where: { id: userId } });

  return { deleted: true, id: userId, name: `${user.firstName} ${user.lastName}`.trim() };
}

// Puts a staff/teacher account back on a temp password the admin can read out.
// Stored hashes are one-way, so a forgotten password can only be replaced, never
// recovered — this is the supported route when the emailed reset link is not an
// option (synthetic `.local` addresses have no mailbox to receive it).
async function resetStaffPassword(tenantId, userId, actingUser, { ipAddress } = {}) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: { in: STAFF_ROLES } },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  });
  if (!user) throw notFound('Staff member not found');

  // Admins change their own password through the account screen, which asks for
  // the current one. Routing self-service through here would let anyone with a
  // borrowed open session mint a known credential.
  if (actingUser && userId === actingUser.id) {
    throw badRequest('Use the account settings screen to change your own password');
  }

  const tempPassword = tempPasswordFor(user.firstName, user.lastName);
  const hashed = await bcrypt.hash(tempPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: true },
    }),
    // Any half-finished email reset must die with the old password, or the link
    // in the mailbox would still set a credential the admin does not know about.
    prisma.passwordReset.updateMany({
      where: { userId, used: false },
      data: { used: true },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: actingUser ? actingUser.id : null,
        action: 'STAFF_PASSWORD_RESET',
        entity: 'User',
        entityId: userId,
        meta: { email: user.email, role: user.role },
        ipAddress: ipAddress || null,
      },
    }),
  ]);

  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    tempPassword,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildProfileData(tenantId, p) {
  return {
    tenantId,
    ...(p.employeeId !== undefined && { employeeId: p.employeeId ? p.employeeId.trim() : null }),
    ...(p.departmentId !== undefined && { departmentId: p.departmentId || null }),
    ...(p.designation !== undefined && { designation: p.designation ? p.designation.trim() : null }),
    ...(p.joiningDate !== undefined && { joiningDate: p.joiningDate ? new Date(p.joiningDate) : null }),
    ...(p.employmentType !== undefined && { employmentType: p.employmentType }),
    ...(p.emergencyContact !== undefined && { emergencyContact: p.emergencyContact ? p.emergencyContact.trim() : null }),
  };
}

async function assertDepartmentInTenant(tenantId, id) {
  const dept = await prisma.department.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!dept) throw notFound('Department not found');
}

async function assertUserInTenant(tenantId, id, roles) {
  const user = await prisma.user.findFirst({
    where: { id, tenantId, ...(roles && { role: { in: roles } }) },
    select: { id: true },
  });
  if (!user) throw notFound('Staff member not found');
}

const badRequest = (m) => Object.assign(new Error(m), { status: 400 });
const notFound = (m) => Object.assign(new Error(m), { status: 404 });
const conflict = (m) => Object.assign(new Error(m), { status: 409 });

module.exports = {
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listStaff, getStaff, createStaff, updateStaffProfile, setStaffStatus,
  resetStaffPassword, tempPasswordFor, setStaffPhoto, deleteStaff,
};
