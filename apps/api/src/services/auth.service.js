const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { signToken } = require('../lib/jwt');
const { sendPasswordReset, sendWelcome, sendInvite } = require('./email.service');

async function registerSchool({ schoolName, adminEmail, adminPassword, adminFirstName, adminLastName, city, state, phone }) {
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const slug = schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const uniqueSlug = `${slug}-${uuidv4().slice(0, 6)}`;

  const hashed = await bcrypt.hash(adminPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: schoolName,
        slug: uniqueSlug,
        status: 'PENDING',
        profile: {
          create: {
            schoolName,
            city,
            state,
            phone,
          },
        },
      },
    });

    const admin = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        password: hashed,
        role: 'SCHOOL_ADMIN',
        firstName: adminFirstName,
        lastName: adminLastName,
        phone,
      },
    });

    return { tenant, admin };
  });

  const loginUrl = `${process.env.WEB_URL}/login`;
  await sendWelcome(adminEmail, schoolName, loginUrl).catch(console.error);

  return { tenantId: result.tenant.id, slug: result.tenant.slug };
}

async function login({ email, password }) {
  // Failsafe: if database is completely empty, auto-seed the super admin
  const userCount = await prisma.user.count();
  if (userCount === 0 && process.env.SUPER_ADMIN_PASSWORD) {
    try {
      const seedPassword = process.env.SUPER_ADMIN_PASSWORD.trim();
      const hashed = await bcrypt.hash(seedPassword, 12);
      await prisma.user.create({
        data: {
          email: 'admin@aipsa.org',
          password: hashed,
          role: 'SUPER_ADMIN',
          firstName: 'AIPSA',
          lastName: 'Admin',
          tenantId: null,
          isActive: true,
        },
      });
      console.log('[Failsafe-Seed] Super admin created successfully on login attempt.');
    } catch (seedErr) {
      console.error('[Failsafe-Seed] Failed to seed super admin:', seedErr);
    }
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: { select: { id: true, status: true, slug: true } } },
  });

  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  if (!user.isActive) throw Object.assign(new Error('Account is disabled'), { status: 403 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  if (user.tenant && user.tenant.status === 'SUSPENDED') {
    throw Object.assign(new Error('School account is suspended'), { status: 403 });
  }

  const token = signToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      tenantStatus: user.tenant?.status ?? null,
      tenantSlug: user.tenant?.slug ?? null,
      mustChangePassword: user.mustChangePassword ?? false,
    },
  };
}

async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // silently succeed to prevent email enumeration

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } });

  const resetUrl = `${process.env.WEB_URL}/reset-password?token=${token}`;
  await sendPasswordReset(email, resetUrl).catch(console.error);
}

async function resetPassword(token, newPassword) {
  const record = await prisma.passwordReset.findUnique({ where: { token } });

  if (!record || record.used || record.expiresAt < new Date()) {
    throw Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    prisma.passwordReset.update({ where: { id: record.id }, data: { used: true } }),
  ]);
}

// ─── Change Password (forced on first login) ─────────────────────────────────

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw Object.assign(new Error('Current password is incorrect'), { status: 400 });

  if (currentPassword === newPassword) {
    throw Object.assign(new Error('New password must be different from your current password'), { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, mustChangePassword: false },
  });

  return { message: 'Password changed successfully.' };
}

// ─── Join Code ────────────────────────────────────────────────────────────────

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateJoinCode(schoolName) {
  const prefix = schoolName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  const suffix = Array.from({ length: 4 }, () => JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)]).join('');
  return `${prefix}-${suffix}`;
}

async function getOrCreateJoinCode(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw Object.assign(new Error('Tenant not found'), { status: 404 });
  if (tenant.joinCode) return tenant.joinCode;
  const code = generateJoinCode(tenant.name);
  await prisma.tenant.update({ where: { id: tenantId }, data: { joinCode: code } });
  return code;
}

async function regenerateJoinCode(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw Object.assign(new Error('Tenant not found'), { status: 404 });
  const code = generateJoinCode(tenant.name);
  await prisma.tenant.update({ where: { id: tenantId }, data: { joinCode: code } });
  return code;
}

// ─── Invite (Magic Link) ─────────────────────────────────────────────────────

async function inviteUser(tenantId, { email, role, firstName, lastName }) {
  if (!['TEACHER', 'PARENT'].includes(role)) {
    throw Object.assign(new Error('Can only invite teachers or parents'), { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { profile: { select: { schoolName: true } } },
  });
  if (!tenant) throw Object.assign(new Error('Tenant not found'), { status: 404 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Object.assign(new Error('Email already has an account'), { status: 409 });

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  await prisma.invite.create({
    data: { tenantId, email, role, firstName, lastName, token, expiresAt },
  });

  const schoolName = tenant.profile?.schoolName || tenant.name;
  const inviteUrl = `${process.env.WEB_URL}/accept-invite?token=${token}`;
  await sendInvite(email, firstName, schoolName, role, inviteUrl).catch(console.error);

  return { message: `Invite sent to ${email}` };
}

async function acceptInvite(token, password) {
  const invite = await prisma.invite.findUnique({ where: { token } });

  if (!invite || invite.used || invite.expiresAt < new Date()) {
    throw Object.assign(new Error('Invalid or expired invite link'), { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) throw Object.assign(new Error('Account already exists. Please login.'), { status: 409 });

  const hashed = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.create({
      data: {
        tenantId: invite.tenantId,
        email: invite.email,
        password: hashed,
        role: invite.role,
        firstName: invite.firstName,
        lastName: invite.lastName,
        isActive: true,
      },
    }),
    prisma.invite.update({ where: { id: invite.id }, data: { used: true } }),
  ]);

  return { message: 'Account created. You can now login.' };
}

// ─── Self-Join via School Code ────────────────────────────────────────────────

async function joinSchool({ joinCode, email, password, firstName, lastName, role }) {
  if (!['TEACHER', 'PARENT'].includes(role)) {
    throw Object.assign(new Error('Invalid role'), { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { joinCode } });
  if (!tenant) throw Object.assign(new Error('Invalid school code'), { status: 404 });
  if (tenant.status !== 'ACTIVE') throw Object.assign(new Error('School is not accepting registrations yet'), { status: 403 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { tenantId: tenant.id, email, password: hashed, role, firstName, lastName, isActive: true },
  });

  return { message: 'Account created. You can now login.', tenantName: tenant.name };
}

// ─── Parent: Link to Student ──────────────────────────────────────────────────

async function linkStudentToParent(userId, tenantId, { admissionNumber, portalPin }) {
  const student = await prisma.student.findFirst({
    where: { tenantId, admissionNumber },
  });

  if (!student) throw Object.assign(new Error('Student not found. Check the admission number.'), { status: 404 });

  // Support both bcrypt hashes (new) and any legacy plaintext PINs.
  const stored = student.portalPin || '';
  const isBcrypt = stored.startsWith('$2');
  const pinValid = isBcrypt
    ? await bcrypt.compare(portalPin, stored)
    : stored === portalPin;

  if (!pinValid) throw Object.assign(new Error('Incorrect PIN. Check with the school office.'), { status: 403 });

  // Opportunistically upgrade a legacy plaintext PIN to a hash on first successful use.
  if (!isBcrypt) {
    await prisma.student.update({ where: { id: student.id }, data: { portalPin: await bcrypt.hash(stored, 10) } });
  }

  if (student.userId) {
    throw Object.assign(new Error('This student already has a linked account'), { status: 409 });
  }

  await prisma.student.update({ where: { id: student.id }, data: { userId } });

  const primaryGuardian = await prisma.guardian.findFirst({
    where: { studentId: student.id, isPrimary: true },
  });
  if (primaryGuardian && !primaryGuardian.userId) {
    await prisma.guardian.update({ where: { id: primaryGuardian.id }, data: { userId } });
  }

  return { message: 'Student linked successfully.', studentName: `${student.firstName} ${student.lastName}` };
}

module.exports = {
  registerSchool, login, requestPasswordReset, resetPassword,
  changePassword,
  getOrCreateJoinCode, regenerateJoinCode,
  inviteUser, acceptInvite,
  joinSchool, linkStudentToParent,
};
