// Home Schooling — global catalog administration (SUPER_ADMIN only). The catalog
// (HsCourse → HsModule → HsLesson) is AIPSA-owned and NOT tenant-scoped, so these
// run without the tenant guard. Families consume it read-only via homeschool.service.
const prisma = require('../lib/prisma');

// ── Courses ──
function listCourses() {
  return prisma.hsCourse.findMany({
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    include: { _count: { select: { modules: true, enrollments: true } } },
  });
}

function getCourse(courseId) {
  return prisma.hsCourse.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { sequence: 'asc' },
        include: { lessons: { orderBy: { sequence: 'asc' } } },
      },
    },
  });
}

function createCourse(data) {
  const { title, subject, gradeLevel, description, board, coverUrl, isPublished, sortOrder } = data;
  return prisma.hsCourse.create({
    data: {
      title, subject, gradeLevel,
      description: description || null,
      board: board || null,
      coverUrl: coverUrl || null,
      isPublished: !!isPublished,
      sortOrder: sortOrder ?? 0,
    },
  });
}

async function updateCourse(courseId, data) {
  await assertCourse(courseId);
  const fields = ['title', 'subject', 'gradeLevel', 'description', 'board', 'coverUrl', 'isPublished', 'sortOrder'];
  const patch = {};
  for (const f of fields) if (data[f] !== undefined) patch[f] = data[f];
  return prisma.hsCourse.update({ where: { id: courseId }, data: patch });
}

async function deleteCourse(courseId) {
  await assertCourse(courseId);
  await prisma.hsCourse.delete({ where: { id: courseId } }); // cascades modules → lessons
  return { message: 'Course deleted.' };
}

// ── Modules ──
async function createModule(courseId, { title, sequence }) {
  await assertCourse(courseId);
  return prisma.hsModule.create({ data: { courseId, title, sequence: sequence ?? 0 } });
}

function updateModule(moduleId, { title, sequence }) {
  return prisma.hsModule.update({
    where: { id: moduleId },
    data: { ...(title !== undefined && { title }), ...(sequence !== undefined && { sequence }) },
  });
}

async function deleteModule(moduleId) {
  await prisma.hsModule.delete({ where: { id: moduleId } });
  return { message: 'Module deleted.' };
}

// ── Lessons ──
function createLesson(moduleId, data) {
  const { title, description, content, videoUrl, attachmentUrl, durationMin, sequence, isFreePreview } = data;
  return prisma.hsLesson.create({
    data: {
      moduleId, title,
      description: description || null,
      content: content || null,
      videoUrl: videoUrl || null,
      attachmentUrl: attachmentUrl || null,
      durationMin: durationMin ?? null,
      sequence: sequence ?? 0,
      isFreePreview: !!isFreePreview,
    },
  });
}

function updateLesson(lessonId, data) {
  const fields = ['title', 'description', 'content', 'videoUrl', 'attachmentUrl', 'durationMin', 'sequence', 'isFreePreview'];
  const patch = {};
  for (const f of fields) if (data[f] !== undefined) patch[f] = data[f];
  return prisma.hsLesson.update({ where: { id: lessonId }, data: patch });
}

async function deleteLesson(lessonId) {
  await prisma.hsLesson.delete({ where: { id: lessonId } });
  return { message: 'Lesson deleted.' };
}

async function assertCourse(courseId) {
  const course = await prisma.hsCourse.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw Object.assign(new Error('Course not found'), { status: 404 });
}

module.exports = {
  listCourses, getCourse, createCourse, updateCourse, deleteCourse,
  createModule, updateModule, deleteModule,
  createLesson, updateLesson, deleteLesson,
};
