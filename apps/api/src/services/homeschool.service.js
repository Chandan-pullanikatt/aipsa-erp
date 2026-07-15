// Home Schooling (B2C) — core service: family signup/login, learners, catalog
// browse, lesson access, and progress. Runs entirely on the SEPARATE home-schooling
// database (hsPrisma). A family is a single HsAccount; children are HsLearner rows.
// Content (HsCourse → HsModule → HsLesson) is the global AIPSA catalog, read-only here.
const bcrypt = require('bcryptjs');
const hsPrisma = require('../lib/hsPrisma');
const { signToken } = require('../lib/jwt');
const { getAccess } = require('./hsSubscription.service');
const { sendWelcome } = require('./email.service');

function publicAccount(a) {
  return { id: a.id, email: a.email, parentFirstName: a.parentFirstName, parentLastName: a.parentLastName };
}

// ─── Signup (public, self-service — no approval gate) ─────────────────────────

async function signup({ parentFirstName, parentLastName, email, password, phone }) {
  const existing = await hsPrisma.hsAccount.findUnique({ where: { email } });
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const account = await hsPrisma.hsAccount.create({
    data: { email, password: hashed, parentFirstName, parentLastName, phone: phone || null },
  });

  if (process.env.WEB_URL_HOMESCHOOL) {
    sendWelcome(email, 'AIPSA Home Schooling', `${process.env.WEB_URL_HOMESCHOOL}/login`).catch(console.error);
  }

  const token = signToken({ accountId: account.id, kind: 'HS' });
  return { token, account: publicAccount(account) };
}

// ─── Login (public) ───────────────────────────────────────────────────────────

async function login({ email, password }) {
  const account = await hsPrisma.hsAccount.findUnique({ where: { email } });
  const ok = account && (await bcrypt.compare(password, account.password));
  if (!ok) throw Object.assign(new Error('Invalid email or password'), { status: 401 });

  const token = signToken({ accountId: account.id, kind: 'HS' });
  return { token, account: publicAccount(account) };
}

// ─── Learners (children) ──────────────────────────────────────────────────────

function listLearners(accountId) {
  return hsPrisma.hsLearner.findMany({
    where: { accountId },
    orderBy: { createdAt: 'asc' },
  });
}

function createLearner(accountId, { firstName, lastName, dateOfBirth, gradeLevel, avatarUrl }) {
  return hsPrisma.hsLearner.create({
    data: {
      accountId,
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gradeLevel: gradeLevel || null,
      avatarUrl: avatarUrl || null,
    },
  });
}

async function updateLearner(accountId, learnerId, data) {
  await assertLearner(accountId, learnerId);
  const { firstName, lastName, dateOfBirth, gradeLevel, avatarUrl } = data;
  return hsPrisma.hsLearner.update({
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

async function deleteLearner(accountId, learnerId) {
  await assertLearner(accountId, learnerId);
  await hsPrisma.hsLearner.delete({ where: { id: learnerId } });
  return { message: 'Learner removed.' };
}

async function assertLearner(accountId, learnerId) {
  const learner = await hsPrisma.hsLearner.findFirst({ where: { id: learnerId, accountId } });
  if (!learner) throw Object.assign(new Error('Learner not found'), { status: 404 });
  return learner;
}

// ─── Catalog (global, read-only) ──────────────────────────────────────────────

function listCatalog({ gradeLevel, subject, search } = {}) {
  return hsPrisma.hsCourse.findMany({
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
async function getCourse(accountId, courseId, learnerId) {
  const course = await hsPrisma.hsCourse.findFirst({
    where: { id: courseId, isPublished: true },
    include: {
      modules: {
        orderBy: { sequence: 'asc' },
        include: { lessons: { orderBy: { sequence: 'asc' } } },
      },
    },
  });
  if (!course) throw Object.assign(new Error('Course not found'), { status: 404 });

  const access = await getAccess(accountId);

  let completedIds = new Set();
  if (learnerId) {
    await assertLearner(accountId, learnerId);
    const progress = await hsPrisma.hsLessonProgress.findMany({
      where: { accountId, learnerId, status: 'COMPLETED' },
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
async function getLesson(accountId, lessonId, learnerId) {
  const lesson = await hsPrisma.hsLesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { select: { id: true, title: true, isPublished: true } } } } },
  });
  if (!lesson || !lesson.module.course.isPublished) {
    throw Object.assign(new Error('Lesson not found'), { status: 404 });
  }

  if (!lesson.isFreePreview) {
    const access = await getAccess(accountId);
    if (!access.active) {
      throw Object.assign(new Error('This lesson requires an active subscription'), { status: 402 });
    }
  }

  let completed = false;
  if (learnerId) {
    await assertLearner(accountId, learnerId);
    const p = await hsPrisma.hsLessonProgress.findUnique({
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

async function enrollLearner(accountId, learnerId, courseId) {
  await assertLearner(accountId, learnerId);
  const course = await hsPrisma.hsCourse.findFirst({ where: { id: courseId, isPublished: true } });
  if (!course) throw Object.assign(new Error('Course not found'), { status: 404 });

  return hsPrisma.hsEnrollment.upsert({
    where: { learnerId_courseId: { learnerId, courseId } },
    create: { accountId, learnerId, courseId },
    update: {},
  });
}

function listEnrollments(accountId, learnerId) {
  return hsPrisma.hsEnrollment.findMany({
    where: { accountId, learnerId },
    include: { course: { include: { _count: { select: { modules: true } } } } },
    orderBy: { enrolledAt: 'desc' },
  });
}

// Toggle a lesson complete/incomplete for a learner. Access is enforced when the
// lesson is opened (getLesson); marking progress on a free preview is allowed.
async function toggleLessonProgress(accountId, learnerId, lessonId) {
  await assertLearner(accountId, learnerId);
  const lesson = await hsPrisma.hsLesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) throw Object.assign(new Error('Lesson not found'), { status: 404 });

  const existing = await hsPrisma.hsLessonProgress.findUnique({
    where: { learnerId_lessonId: { learnerId, lessonId } },
  });

  if (existing && existing.status === 'COMPLETED') {
    await hsPrisma.hsLessonProgress.update({
      where: { id: existing.id },
      data: { status: 'IN_PROGRESS', completedAt: null },
    });
    return { completed: false };
  }

  await hsPrisma.hsLessonProgress.upsert({
    where: { learnerId_lessonId: { learnerId, lessonId } },
    create: { accountId, learnerId, lessonId, status: 'COMPLETED', completedAt: new Date() },
    update: { status: 'COMPLETED', completedAt: new Date() },
  });
  return { completed: true };
}

module.exports = {
  signup, login,
  listLearners, createLearner, updateLearner, deleteLearner,
  listCatalog, getCourse, getLesson,
  enrollLearner, listEnrollments, toggleLessonProgress,
};
