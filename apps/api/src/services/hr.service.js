const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Roles that count as employees for the HR directory. Admins and teachers are
// staff too; non-teaching staff use the dedicated STAFF role.
const STAFF_ROLES = ['SCHOOL_ADMIN', 'TEACHER', 'STAFF'];

function genTempPassword() {
  return 'Staff@' + crypto.randomBytes(4).toString('hex');
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
      role: true, isActive: true, createdAt: true,
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
      role: true, isActive: true, createdAt: true,
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
  const { email, firstName, lastName, phone, role = 'STAFF', profile = {} } = data;
  if (!['STAFF', 'TEACHER'].includes(role)) throw badRequest('Role must be STAFF or TEACHER');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict('A user with this email already exists');

  if (profile.departmentId) await assertDepartmentInTenant(tenantId, profile.departmentId);

  const tempPassword = genTempPassword();
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
};
