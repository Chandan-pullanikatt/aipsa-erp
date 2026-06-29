// Home Schooling (B2C) — core service: family signup, learners, catalog browse,
// lesson access, and progress. A home-schooling family is a Tenant of type
// INDIVIDUAL with a single HS_PARENT user; children are HsLearner rows. Content
// (HsCourse → HsModule → HsLesson) is the global AIPSA catalog, read-only here.
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { signToken } = require('../lib/jwt');
const { getAccess } = require('./hsSubscription.service');
const { sendWelcome } = require('./email.service');

// ─── Signup (public, self-service — no approval gate) ─────────────────────────

async function signup({ parentFirstName, parentLastName, email, password, phone }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const baseSlug = `family-${parentLastName || parentFirstName}`
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const slug = `${baseSlug}-${uuidv4().slice(0, 6)}`;
  const hashed = await bcrypt.hash(password, 12);

  const { tenant, user } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: `${parentFirstName} ${parentLastName}`.trim() || 'Home School',
        slug,
        type: 'INDIVIDUAL',
        status: 'ACTIVE', // B2C is self-service: no super-admin approval needed
      },
    });
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email,
        password: hashed,
        role: 'HS_PARENT',
        firstName: parentFirstName,
        lastName: parentLastName,
        phone,
        isActive: true,
      },
    });
    return { tenant, user };
  });

  if (process.env.WEB_URL_HOMESCHOOL) {
    sendWelcome(email, 'AIPSA Home Schooling', `${process.env.WEB_URL_HOMESCHOOL}/login`).catch(console.error);
  }

  const token = signToken({ userId: user.id, tenantId: tenant.id, role: user.role });
  return {
    token,
    user: {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: user.role, tenantId: tenant.id, tenantStatus: tenant.status,
    },
  };
}

// ─── Learners (children) ──────────────────────────────────────────────────────

function listLearners(tenantId) {
  return prisma.hsLearner.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  });
}

function createLearner(tenantId, { firstName, lastName, dateOfBirth, gradeLevel, avatarUrl }) {
  return prisma.hsLearner.create({
    data: {
      tenantId,
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gradeLevel: gradeLevel || null,
      avatarUrl: avatarUrl || null,
    },
  });
}

async function updateLearner(tenantId, learnerId, data) {
  await assertLearner(tenantId, learnerId);
  const { firstName, lastName, dateOfBirth, gradeLevel, avatarUrl } = data;
  return prisma.hsLearner.update({
    where: { id: learnerId },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
      ...(gradeLevel !== undefined && { gradeLevel }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    },
  });
}

async function deleteLearner(tenantId, learnerId) {
  await assertLearner(tenantId, learnerId);
  await prisma.hsLearner.delete({ where: { id: learnerId } });
  return { message: 'Learner removed.' };
}

async function assertLearner(tenantId, learnerId) {
  const learner = await prisma.hsLearner.findFirst({ where: { id: learnerId, tenantId } });
  if (!learner) throw Object.assign(new Error('Learner not found'), { status: 404 });
  return learner;
}

// ─── Catalog (global, read-only) ──────────────────────────────────────────────

function listCatalog({ gradeLevel, subject, search } = {}) {
  return prisma.hsCourse.findMany({
    where: {
      isPublished: true,
      ...(gradeLevel && { gradeLevel }),
      ...(subject && { subject }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    include: { _count: { select: { modules: true } } },
  });
}

// Full course tree for a learner. Lesson bodies are withheld unless the lesson is
// a free preview or the family has an active subscription — the list of lessons
// (titles) is always visible so families can see what they'd unlock.
async function getCourse(tenantId, courseId, learnerId) {
  const course = await prisma.hsCourse.findFirst({
    where: { id: courseId, isPublished: true },
    include: {
      modules: {
        orderBy: { sequence: 'asc' },
        include: { lessons: { orderBy: { sequence: 'asc' } } },
      },
    },
  });
  if (!course) throw Object.assign(new Error('Course not found'), { status: 404 });

  const access = await getAccess(tenantId);

  let completedIds = new Set();
  if (learnerId) {
    await assertLearner(tenantId, learnerId);
    const progress = await prisma.hsLessonProgress.findMany({
      where: { tenantId, learnerId, status: 'COMPLETED' },
      select: { lessonId: true },
    });
    completedIds = new Set(progress.map((p) => p.lessonId));
  }

  const modules = course.modules.map((m) => ({
    id: m.id, title: m.title, sequence: m.sequence,
    lessons: m.lessons.map((l) => {
      const unlocked = l.isFreePreview || access.active;
      return {
        id: l.id, title: l.title, description: l.description, sequence: l.sequence,
        durationMin: l.durationMin, isFreePreview: l.isFreePreview,
        unlocked, completed: completedIds.has(l.id),
      };
    }),
  }));

  return {
    id: course.id, title: course.title, description: course.description,
    subject: course.subject, gradeLevel: course.gradeLevel, board: course.board,
    coverUrl: course.coverUrl, hasAccess: access.active, modules,
  };
}

// Single lesson with its full body — enforces the access gate server-side.
// When a learnerId is supplied, includes whether that child has completed it.
async function getLesson(tenantId, lessonId, learnerId) {
  const lesson = await prisma.hsLesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { select: { id: true, title: true, isPublished: true } } } } },
  });
  if (!lesson || !lesson.module.course.isPublished) {
    throw Object.assign(new Error('Lesson not found'), { status: 404 });
  }

  if (!lesson.isFreePreview) {
    const access = await getAccess(tenantId);
    if (!access.active) {
      throw Object.assign(new Error('This lesson requires an active subscription'), { status: 402 });
    }
  }

  let completed = false;
  if (learnerId) {
    await assertLearner(tenantId, learnerId);
    const p = await prisma.hsLessonProgress.findUnique({
      where: { learnerId_lessonId: { learnerId, lessonId } },
      select: { status: true },
    });
    completed = p?.status === 'COMPLETED';
  }

  return {
    id: lesson.id, title: lesson.title, description: lesson.description,
    content: lesson.content, videoUrl: lesson.videoUrl, attachmentUrl: lesson.attachmentUrl,
    durationMin: lesson.durationMin, isFreePreview: lesson.isFreePreview, completed,
    course: { id: lesson.module.course.id, title: lesson.module.course.title },
  };
}

// ─── Enrollment + progress ────────────────────────────────────────────────────

async function enrollLearner(tenantId, learnerId, courseId) {
  await assertLearner(tenantId, learnerId);
  const course = await prisma.hsCourse.findFirst({ where: { id: courseId, isPublished: true } });
  if (!course) throw Object.assign(new Error('Course not found'), { status: 404 });

  return prisma.hsEnrollment.upsert({
    where: { learnerId_courseId: { learnerId, courseId } },
    create: { tenantId, learnerId, courseId },
    update: {},
  });
}

function listEnrollments(tenantId, learnerId) {
  return prisma.hsEnrollment.findMany({
    where: { tenantId, learnerId },
    include: { course: { include: { _count: { select: { modules: true } } } } },
    orderBy: { enrolledAt: 'desc' },
  });
}

// Toggle a lesson complete/incomplete for a learner. Access is enforced when the
// lesson is opened (getLesson); marking progress on a free preview is allowed.
async function toggleLessonProgress(tenantId, learnerId, lessonId) {
  await assertLearner(tenantId, learnerId);
  const lesson = await prisma.hsLesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) throw Object.assign(new Error('Lesson not found'), { status: 404 });

  const existing = await prisma.hsLessonProgress.findUnique({
    where: { learnerId_lessonId: { learnerId, lessonId } },
  });

  if (existing && existing.status === 'COMPLETED') {
    await prisma.hsLessonProgress.update({
      where: { id: existing.id },
      data: { status: 'IN_PROGRESS', completedAt: null },
    });
    return { completed: false };
  }

  await prisma.hsLessonProgress.upsert({
    where: { learnerId_lessonId: { learnerId, lessonId } },
    create: { tenantId, learnerId, lessonId, status: 'COMPLETED', completedAt: new Date() },
    update: { status: 'COMPLETED', completedAt: new Date() },
  });
  return { completed: true };
}

module.exports = {
  signup,
  listLearners, createLearner, updateLearner, deleteLearner,
  listCatalog, getCourse, getLesson,
  enrollLearner, listEnrollments, toggleLessonProgress,
};
