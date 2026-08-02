const prisma = require('../lib/prisma');
const { storage } = require('../lib/storage');

const MAX_ATTACHMENTS = 10;

// Attachments arrive from the uploader as [{ url, key, name, type }]. Keep only
// those four fields so a client can't smuggle extra data into the JSON column,
// and cap the list — a phone gallery makes it easy to select fifty photos.
function normalizeAttachments(input) {
  if (!Array.isArray(input)) return null;
  const clean = input
    .filter(a => a && typeof a.url === 'string' && a.url.trim())
    .slice(0, MAX_ATTACHMENTS)
    .map(a => ({
      url: a.url.trim(),
      key: typeof a.key === 'string' ? a.key : null,
      name: typeof a.name === 'string' ? a.name.slice(0, 120) : null,
      type: a.type === 'pdf' ? 'pdf' : 'image',
    }));
  return clean.length ? clean : null;
}

// `attachmentUrl` predates the list and is still read by older clients. An
// explicitly pasted link wins it, because that's a resource the uploads don't
// contain; otherwise it mirrors the first upload so those clients still see one.
function attachmentFields(attachments, attachmentUrl) {
  const list = normalizeAttachments(attachments);
  const link = typeof attachmentUrl === 'string' ? attachmentUrl.trim() : '';
  return {
    attachments: list,
    attachmentUrl: link || (list ? list[0].url : null),
  };
}

async function createHomework(tenantId, teacherId, { classId, subjectId, title, description, dueDate, attachmentUrl, attachments }) {
  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId } });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return prisma.homework.create({
    data: {
      tenantId, teacherId, classId,
      subjectId: subjectId || null,
      title: title.trim(),
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      ...attachmentFields(attachments, attachmentUrl),
    },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

async function listHomework(tenantId, { teacherId, classId, page = 1, limit = 20 } = {}) {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {
    tenantId,
    ...(teacherId && { teacherId }),
    ...(classId && { classId }),
  };
  const [items, total] = await prisma.$transaction([
    prisma.homework.findMany({
      where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.homework.count({ where }),
  ]);
  return { items, total };
}

async function updateHomework(tenantId, id, teacherId, data) {
  const hw = await prisma.homework.findFirst({ where: { id, tenantId } });
  if (!hw) throw Object.assign(new Error('Homework not found'), { status: 404 });
  if (hw.teacherId !== teacherId) throw Object.assign(new Error('Not authorized'), { status: 403 });
  const { title, description, dueDate, attachmentUrl, attachments } = data;
  return prisma.homework.update({
    where: { id },
    data: {
      ...(title && { title: title.trim() }),
      ...(description !== undefined && { description: description || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      // The list wins when sent: it also rewrites the mirrored attachmentUrl.
      ...(attachments !== undefined
        ? attachmentFields(attachments, attachmentUrl)
        : attachmentUrl !== undefined && { attachmentUrl: attachmentUrl || null }),
    },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  });
}

async function deleteHomework(tenantId, id, userId, userRole) {
  const hw = await prisma.homework.findFirst({ where: { id, tenantId } });
  if (!hw) throw Object.assign(new Error('Homework not found'), { status: 404 });
  if (hw.teacherId !== userId && userRole !== 'SCHOOL_ADMIN') throw Object.assign(new Error('Not authorized'), { status: 403 });
  // Collect the submissions' files before the cascade removes the rows.
  const subs = await prisma.homeworkSubmission.findMany({
    where: { tenantId, homeworkId: id }, select: { attachments: true },
  });
  await prisma.homework.delete({ where: { id } });
  await removeFiles([hw, ...subs]);
}

// Best-effort cleanup of uploaded files whose owning row is gone. A failure here
// only leaves an orphan on disk, so it must never fail the request.
async function removeFiles(rows) {
  const keys = rows.flatMap(r => (Array.isArray(r.attachments) ? r.attachments : []))
    .map(a => a && a.key)
    .filter(Boolean);
  await Promise.all(keys.map(k => storage.remove(k).catch(() => {})));
}

// Returns distinct classes a teacher is assigned to, via the subject they own,
// a co-teaching/section assignment, or a timetable period.
async function getTeacherClasses(tenantId, teacherId) {
  const [subjectClasses, assignedClasses, periodClasses, inchargeClasses, inchargeSections] = await Promise.all([
    prisma.subject.findMany({
      where: { tenantId, teacherId },
      select: { class: { select: { id: true, name: true } } },
    }),
    prisma.subjectTeacher.findMany({
      where: { tenantId, teacherId },
      select: { subject: { select: { class: { select: { id: true, name: true } } } } },
    }),
    prisma.period.findMany({
      where: { tenantId, teacherId },
      select: { class: { select: { id: true, name: true } } },
      distinct: ['classId'],
    }),
    // Class teachers (incharge of the whole class) get the class even without a subject/period there.
    prisma.class.findMany({
      where: { tenantId, inchargeTeacherId: teacherId },
      select: { id: true, name: true },
    }),
    // Section-level incharge teachers get the section's class too.
    prisma.section.findMany({
      where: { tenantId, inchargeTeacherId: teacherId },
      select: { class: { select: { id: true, name: true } } },
    }),
  ]);
  const all = [
    ...subjectClasses.map(s => s.class),
    ...assignedClasses.map(a => a.subject.class),
    ...periodClasses.map(p => p.class),
    ...inchargeClasses,
    ...inchargeSections.map(s => s.class),
  ];
  const seen = new Set();
  return all.filter(c => seen.has(c.id) ? false : seen.add(c.id));
}

async function submitHomework(tenantId, homeworkId, studentId, { note, attachmentUrl, attachments }) {
  const hw = await prisma.homework.findFirst({ where: { id: homeworkId, tenantId } });
  if (!hw) throw Object.assign(new Error('Homework not found'), { status: 404 });

  // Resubmitting replaces the previous attempt, so its files become orphans.
  const previous = await prisma.homeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId } },
    select: { attachments: true },
  });

  const files = attachmentFields(attachments, attachmentUrl);
  const submission = await prisma.homeworkSubmission.upsert({
    where: { homeworkId_studentId: { homeworkId, studentId } },
    update: {
      note: note || null,
      ...files,
      submittedAt: new Date(),
      grade: null,
      feedback: null,
      gradedAt: null,
      gradedById: null,
    },
    create: {
      tenantId,
      homeworkId,
      studentId,
      note: note || null,
      ...files,
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
  });

  if (previous) await removeFiles([previous]);
  return submission;
}

async function getSubmissions(tenantId, homeworkId) {
  const hw = await prisma.homework.findFirst({ where: { id: homeworkId, tenantId } });
  if (!hw) throw Object.assign(new Error('Homework not found'), { status: 404 });

  return prisma.homeworkSubmission.findMany({
    where: { tenantId, homeworkId },
    orderBy: { submittedAt: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      gradedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

async function gradeSubmission(tenantId, submissionId, gradedById, { grade, feedback }) {
  const sub = await prisma.homeworkSubmission.findFirst({ where: { id: submissionId, tenantId } });
  if (!sub) throw Object.assign(new Error('Submission not found'), { status: 404 });

  return prisma.homeworkSubmission.update({
    where: { id: submissionId },
    data: { grade: grade || null, feedback: feedback || null, gradedAt: new Date(), gradedById },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
  });
}

async function getMySubmission(tenantId, homeworkId, studentId) {
  return prisma.homeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId } },
  });
}

module.exports = { createHomework, listHomework, updateHomework, deleteHomework, getTeacherClasses, submitHomework, getSubmissions, gradeSubmission, getMySubmission };