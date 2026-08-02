const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { sendStudentApproval } = require('./email.service');
const portalPassword = require('../lib/portalPassword');

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

async function deleteClass(tenantId, id, actingUser) {
  return removeClassOrSection(tenantId, { classId: id }, actingUser);
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

async function deleteSection(tenantId, id, actingUser) {
  return removeClassOrSection(tenantId, { sectionId: id }, actingUser);
}

// ─── Deleting a class or section ─────────────────────────────────────────────
//
// Deleting a class is not a tidy-up. The row anchors a whole grade, so it takes
// its students with it — and with them their marks, fee payments and portal
// logins. Two details make the database a bad judge of that.
//
// Exam and Homework hold a *required* classId, which is Restrict, so Postgres
// refuses the delete outright unless those rows go first. FeeStructure and
// SchoolEvent hold an *optional* one, which is SetNull — and null already means
// "applies to the whole school" (see fee.service listStructures and
// event.service listForUser). Left to referential actions, deleting Class 6
// would quietly promote its fees and its events to every child in the building.
// Both are therefore deleted explicitly below rather than left to the schema.
//
// The student side needs the same care. Fee payments and exam results are
// Restrict and would block the delete; attendance, leaves and registrations are
// SetNull and would instead survive as rows pointing at nobody. All five are
// therefore cleared explicitly ahead of the students. Everything else hanging
// off a student or a class already cascades.
//
// None of this is recoverable, which is why getDeleteImpact exists: the admin
// UI shows these counts and makes them the thing the admin confirms against.

/** Ids of everything in scope, for one class (with its sections) or one section. */
async function resolveDeleteScope(client, tenantId, { classId, sectionId }) {
  const sectionIds = classId
    ? (await client.section.findMany({ where: { tenantId, classId }, select: { id: true } })).map((s) => s.id)
    : [sectionId];

  // The OR catches a student sitting in a section of this class whose own
  // classId drifted out of sync — rare, but it would survive a classId-only
  // delete and then point at a section that no longer exists.
  const students = await client.student.findMany({
    where: classId
      ? { tenantId, OR: [{ classId }, ...(sectionIds.length ? [{ sectionId: { in: sectionIds } }] : [])] }
      : { tenantId, sectionId },
    select: { id: true, userId: true },
  });
  const studentIds = students.map((s) => s.id);
  const userIds = students.map((s) => s.userId).filter(Boolean);

  // Exam.sectionId has no foreign key of its own, so a section delete leaves it
  // dangling unless we find those exams by hand.
  const examIds = (await client.exam.findMany({
    where: classId ? { tenantId, classId } : { tenantId, sectionId },
    select: { id: true },
  })).map((e) => e.id);

  // Subjects belong to the class, so they only go when the whole class does.
  const subjectIds = classId
    ? (await client.subject.findMany({ where: { tenantId, classId }, select: { id: true } })).map((s) => s.id)
    : [];

  return { sectionIds, studentIds, userIds, examIds, subjectIds };
}

/**
 * What deleting this class or section would destroy. Read-only — every count
 * here corresponds to rows removeClassOrSection actually removes.
 */
async function getDeleteImpact(tenantId, { classId, sectionId }) {
  const target = classId
    ? await prisma.class.findFirst({ where: { id: classId, tenantId }, select: { id: true, name: true } })
    : await prisma.section.findFirst({
      where: { id: sectionId, tenantId },
      select: { id: true, name: true, class: { select: { name: true } } },
    });
  if (!target) {
    throw Object.assign(new Error(classId ? 'Class not found' : 'Section not found'), { status: 404 });
  }

  const { sectionIds, studentIds, userIds, examIds, subjectIds } =
    await resolveDeleteScope(prisma, tenantId, { classId, sectionId });

  const byStudent = { tenantId, studentId: { in: studentIds } };
  const zero = () => Promise.resolve(0);

  const [
    examResults, homeworkSubmissions, feePayments, attendance, leaves,
    guardians, bookIssues, purchases, registrations, progressCards, ccaGrades,
    homeworks, feeStructures, events, subjects, lmsMaterials, ccaAreas,
    joinRequests, timetablePeriods, subjectTeacherAssignments,
  ] = await Promise.all([
    prisma.examResult.count({
      where: {
        tenantId,
        OR: [
          { examId: { in: examIds } },
          { studentId: { in: studentIds } },
          ...(subjectIds.length ? [{ subjectId: { in: subjectIds } }] : []),
        ],
      },
    }),
    prisma.homeworkSubmission.count({
      where: {
        tenantId,
        OR: [
          { studentId: { in: studentIds } },
          ...(classId ? [{ homework: { classId } }] : []),
        ],
      },
    }),
    prisma.feePayment.count({ where: byStudent }),
    prisma.attendance.count({
      where: {
        tenantId,
        OR: [
          { studentId: { in: studentIds } },
          ...(classId ? [{ classId }] : []),
          ...(sectionIds.length ? [{ sectionId: { in: sectionIds } }] : []),
        ],
      },
    }),
    prisma.leave.count({ where: byStudent }),
    prisma.guardian.count({ where: byStudent }),
    prisma.bookIssue.count({ where: byStudent }),
    prisma.purchase.count({ where: byStudent }),
    prisma.registration.count({
      where: {
        tenantId,
        OR: [
          { studentId: { in: studentIds } },
          ...(userIds.length ? [{ registrantUserId: { in: userIds } }] : []),
        ],
      },
    }),
    prisma.progressTerm.count({ where: byStudent }),
    prisma.ccaGrade.count({ where: byStudent }),
    // Class-level records. A section delete leaves all of these alone — they
    // belong to the grade, not to 6-A.
    classId ? prisma.homework.count({ where: { tenantId, classId } }) : zero(),
    classId ? prisma.feeStructure.count({ where: { tenantId, classId } }) : zero(),
    classId ? prisma.schoolEvent.count({ where: { tenantId, classId } }) : zero(),
    classId ? prisma.subject.count({ where: { tenantId, classId } }) : zero(),
    subjectIds.length ? prisma.lmsMaterial.count({ where: { tenantId, subjectId: { in: subjectIds } } }) : zero(),
    classId ? prisma.ccaArea.count({ where: { tenantId, classId } }) : zero(),
    classId ? prisma.classJoinRequest.count({ where: { tenantId, classId } }) : zero(),
    prisma.period.count({ where: classId ? { tenantId, classId } : { tenantId, sectionId } }),
    prisma.subjectTeacher.count({
      where: classId
        ? { tenantId, OR: [{ sectionId: { in: sectionIds } }, ...(subjectIds.length ? [{ subjectId: { in: subjectIds } }] : [])] }
        : { tenantId, sectionId },
    }),
  ]);

  return {
    target: {
      id: target.id,
      name: target.name,
      type: classId ? 'class' : 'section',
      className: classId ? target.name : target.class.name,
    },
    counts: {
      students: studentIds.length,
      portalLogins: userIds.length,
      sections: classId ? sectionIds.length : 0,
      exams: examIds.length,
      examResults,
      homeworks,
      homeworkSubmissions,
      feePayments,
      feeStructures,
      attendance,
      leaves,
      guardians,
      events,
      timetablePeriods,
      subjects,
      lmsMaterials,
      ccaAreas,
      ccaGrades,
      progressCards,
      bookIssues,
      purchases,
      registrations,
      joinRequests,
      subjectTeacherAssignments,
    },
  };
}

async function removeClassOrSection(tenantId, { classId, sectionId }, actingUser) {
  const impact = await getDeleteImpact(tenantId, { classId, sectionId });
  const { target, counts } = impact;

  try {
    await runDeleteTransaction(tenantId, { classId, sectionId });
  } catch (err) {
    // A foreign key we have not accounted for means some module added a
    // Restrict relation to Class, Section or Student since this was written.
    // The transaction has rolled back, so nothing is half-deleted — but the
    // global handler would turn this into a bare "Internal server error", and
    // Prisma's own message is not safe to echo (it carries the query and the
    // constraint name). Say what happened and leave the detail in the log.
    if (err && err.code === 'P2003') {
      throw Object.assign(
        new Error(
          `${target.name} could not be deleted: something else in the school still `
          + 'refers to it. Nothing was removed. Please report this — it needs a code change.',
        ),
        { status: 409, cause: err },
      );
    }
    throw err;
  }

  // Written after the transaction, not before it as deleteStudent does: this
  // one can genuinely fail and roll back, and a CLASS_DELETED line for a class
  // that still exists is worse than no line. auditLog has no foreign key back
  // to any of the deleted rows, so nothing is lost by waiting. The counts are
  // the only surviving record of what went with it.
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actingUser ? actingUser.id : null,
      action: classId ? 'CLASS_DELETED' : 'SECTION_DELETED',
      entity: classId ? 'Class' : 'Section',
      entityId: target.id,
      meta: { name: target.name, className: target.className, counts },
    },
  });

  return { deleted: true, ...impact };
}

function runDeleteTransaction(tenantId, { classId, sectionId }) {
  return prisma.$transaction(async (tx) => {
    // Re-resolved inside the transaction rather than reused from the impact
    // read above: a student admitted into the class in between would otherwise
    // be missed by the deletes and then block the final class.delete.
    const { sectionIds, studentIds, userIds, examIds, subjectIds } =
      await resolveDeleteScope(tx, tenantId, { classId, sectionId });

    // Restrict foreign keys, innermost first. Exam results go before exams so
    // that results belonging to a *surviving* exam but a deleted student (or a
    // deleted subject) are cleared too — the exam-level cascade would miss them.
    await tx.examResult.deleteMany({
      where: {
        tenantId,
        OR: [
          { examId: { in: examIds } },
          { studentId: { in: studentIds } },
          ...(subjectIds.length ? [{ subjectId: { in: subjectIds } }] : []),
        ],
      },
    });
    await tx.exam.deleteMany({ where: { tenantId, id: { in: examIds } } });
    await tx.feePayment.deleteMany({ where: { tenantId, studentId: { in: studentIds } } });
    await tx.attendance.deleteMany({
      where: {
        tenantId,
        OR: [
          { studentId: { in: studentIds } },
          ...(classId ? [{ classId }] : []),
          ...(sectionIds.length ? [{ sectionId: { in: sectionIds } }] : []),
        ],
      },
    });
    await tx.leave.deleteMany({ where: { tenantId, studentId: { in: studentIds } } });

    // Registration.studentId is SetNull, so deleting the student would leave a
    // registration attached to nobody. The one a student booked themselves
    // hangs off registrantUserId instead and would cascade with the portal user
    // below — this catches both so the counts shown to the admin are honest.
    await tx.registration.deleteMany({
      where: {
        tenantId,
        OR: [
          { studentId: { in: studentIds } },
          ...(userIds.length ? [{ registrantUserId: { in: userIds } }] : []),
        ],
      },
    });

    if (classId) {
      // Homework is Restrict; fee structures and events are the SetNull pair
      // that would otherwise go school-wide. Submissions, waivers, reminder
      // logs and event media cascade off these.
      await tx.homework.deleteMany({ where: { tenantId, classId } });
      await tx.feeStructure.deleteMany({ where: { tenantId, classId } });
      await tx.schoolEvent.deleteMany({ where: { tenantId, classId } });
    }

    // Guardians, submissions, CCA grades, progress cards, library issues,
    // purchases, hostel and transport rows all cascade off the student.
    await tx.student.deleteMany({ where: { tenantId, id: { in: studentIds } } });

    // The portal login is a separate User the student pointed at, so nothing
    // removes it for us — without this the school keeps orphaned accounts that
    // can still sign in.
    if (userIds.length) await tx.user.deleteMany({ where: { id: { in: userIds } } });

    // Sections, subjects (and their LMS material), CCA areas, timetable periods,
    // subject-teacher assignments and join requests all cascade off the class.
    if (classId) await tx.class.delete({ where: { id: classId } });
    else await tx.section.delete({ where: { id: sectionId } });
  }, { timeout: 120000, maxWait: 15000 });
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
  // Admins may set the admission number themselves (schools usually have their
  // own numbering); left blank we fall back to the generated ADM-YYYY-NNNN.
  const supplied = (data.admissionNumber || '').trim();
  if (supplied) {
    const clash = await prisma.student.findFirst({
      where: { tenantId, admissionNumber: supplied },
      select: { id: true },
    });
    if (clash) throw Object.assign(new Error('That admission number is already in use.'), { status: 409 });
  }
  const admissionNumber = supplied || await generateAdmissionNumber(tenantId);
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

  const student = await prisma.student.create({
    data: {
      tenantId,
      admissionNumber,
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

  // portalPin is left null on create, so the student is on the school-wide
  // derived default — hand that back so the office can pass it on right away.
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const { portalPin: _pin, ...studentData } = student;
  return { ...studentData, portalPin: portalPassword.currentPassword(student, tenant?.name) };
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

// Relations that make a student part of the school's permanent record rather
// than a stray row from an import sheet. Attendance, leaves, fee payments and
// exam results are Restrict foreign keys, so a delete would fail at the
// database anyway; the rest cascade, which is worse — the history would go
// silently. Either way the answer is the same: mark them TRANSFERRED.
const STUDENT_HISTORY_RELATIONS = [
  ['fee payments', (id) => prisma.feePayment.count({ where: { studentId: id } })],
  ['exam results', (id) => prisma.examResult.count({ where: { studentId: id } })],
  ['attendance records', (id) => prisma.attendance.count({ where: { studentId: id } })],
  ['leave requests', (id) => prisma.leave.count({ where: { studentId: id } })],
  ['homework submissions', (id) => prisma.homeworkSubmission.count({ where: { studentId: id } })],
  ['progress cards', (id) => prisma.progressTerm.count({ where: { studentId: id } })],
  ['CCA grades', (id) => prisma.ccaGrade.count({ where: { studentId: id } })],
  ['library issues', (id) => prisma.bookIssue.count({ where: { studentId: id } })],
  ['purchases', (id) => prisma.purchase.count({ where: { studentId: id } })],
  ['programme registrations', (id) => prisma.registration.count({ where: { studentId: id } })],
  ['premium LMS subscriptions', (id) => prisma.premiumLmsSubscription.count({ where: { studentId: id } })],
  ['fee waivers', (id) => prisma.lateFeeWaiver.count({ where: { studentId: id } })],
  ['activity records', (id) => prisma.studentActivity.count({ where: { studentId: id } })],
];

/**
 * Permanently removes a student.
 *
 * Deliberately narrow, and for the same reason as deleteStaff: this undoes a
 * mistake — a duplicate row in an import sheet, an admission that never turned
 * into a joining — not a child who has actually attended. Anyone carrying
 * academic or financial history is refused with a 409 pointing at the status
 * field, which is what a leaver needs and keeps the records the school is
 * required to retain.
 *
 * What does go with the student is only the paperwork that has no meaning
 * without them: guardians, reminder logs, hostel allotment, gate passes and
 * complaints (all onDelete: Cascade), plus the portal login.
 */
async function deleteStudent(tenantId, id, actingUser) {
  const student = await prisma.student.findFirst({
    where: { id, tenantId },
    select: {
      id: true, firstName: true, lastName: true,
      admissionNumber: true, status: true, userId: true,
    },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const name = `${student.firstName} ${student.lastName}`.trim();

  const counts = await Promise.all(STUDENT_HISTORY_RELATIONS.map(([label, count]) =>
    count(id).then((n) => [label, n])));
  const blocking = counts.filter(([, n]) => n > 0).map(([label]) => label);

  // Registration.studentId is SetNull, so the row above only catches
  // registrations made *for* this student. One the student booked themselves
  // hangs off registrantUserId instead, which is Cascade on the portal user we
  // delete below — without this it would take a paid registration with it.
  if (student.userId) {
    const selfRegistrations = await prisma.registration.count({
      where: { tenantId, registrantUserId: student.userId },
    });
    if (selfRegistrations > 0 && !blocking.includes('programme registrations')) {
      blocking.push('programme registrations');
    }
  }

  if (blocking.length) {
    throw Object.assign(
      new Error(
        `${name} has school records (${blocking.join(', ')}) and cannot be deleted. `
        + 'Set the status to Transferred or Inactive instead — this keeps the records '
        + 'and takes the student off the active roll.',
      ),
      { status: 409 },
    );
  }

  // Written before the delete so the row survives it, and outside the
  // transaction below for the same reason it is in deleteStaff: auditLog has no
  // foreign key back to student or user, so it outlives both.
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actingUser ? actingUser.id : null,
      action: 'STUDENT_DELETED',
      entity: 'Student',
      entityId: id,
      meta: { name, admissionNumber: student.admissionNumber, status: student.status },
    },
  });

  // The portal login is a separate User row that the student record points at,
  // so nothing removes it for us — without this the school keeps an orphaned
  // account that can still sign in.
  await prisma.$transaction([
    prisma.student.delete({ where: { id } }),
    ...(student.userId ? [prisma.user.delete({ where: { id: student.userId } })] : []),
  ]);

  return { deleted: true, id, name };
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
        lastName: (lastName || '').trim(),
        relation,
        phone: phone.trim(),
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
        ...(lastName !== undefined && { lastName: (lastName || '').trim() }),
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
    select: { id: true, firstName: true, lastName: true, admissionNumber: true, portalPin: true },

  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const { portalPin, ...rest } = student;
  return {
    ...rest,
    portalPin: portalPassword.currentPassword(student, tenant?.name),
    isCustom: portalPassword.isCustom(student),
  };
}

// Clearing the column restores the school-wide default pattern.
async function resetPortalPin(tenantId, studentId) {
  const student = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  await prisma.student.update({ where: { id: studentId }, data: { portalPin: null } });
  return getPortalPin(tenantId, studentId);
}

// Section-wise credential sheet the office hands out (10-A, 10-B, …).
async function listSectionCredentials(tenantId, sectionId) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, tenantId },
    include: { class: true },
  });
  if (!section) throw Object.assign(new Error('Section not found'), { status: 404 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const students = await prisma.student.findMany({
    where: { tenantId, sectionId, status: 'ACTIVE' },
    orderBy: [{ firstName: 'asc' }],
  });

  return {
    className: `${section.class?.name || ''}${section.name ? ` - ${section.name}` : ''}`.trim(),
    students: students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`.trim(),
      admissionNumber: s.admissionNumber,
      password: portalPassword.currentPassword(s, tenant?.name),
      isCustom: portalPassword.isCustom(s),
    })),
  };
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

// A parent may only touch a child they are actually linked to — either the
// student account is theirs or they are a listed guardian. Same rule as
// getParentStudents, applied to a single student.
async function assertParentOwnsStudent(tenantId, userId, studentId) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      tenantId,
      OR: [{ userId }, { guardians: { some: { userId } } }],
    },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return student;
}

// Admin-side counterpart of setParentStudentPhoto: sets or clears the photo on
// any student in the tenant. `photoUrl` null removes it.
async function setStudentPhoto(tenantId, studentId, photoUrl) {
  const existing = await prisma.student.findFirst({ where: { id: studentId, tenantId } });
  if (!existing) throw Object.assign(new Error('Student not found'), { status: 404 });
  const { portalPin: _pin, ...student } = await prisma.student.update({
    where: { id: studentId },
    data: { photoUrl: photoUrl || null },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      guardians: true,
    },
  });
  return student;
}

async function setParentStudentPhoto(tenantId, userId, studentId, photoUrl) {
  await assertParentOwnsStudent(tenantId, userId, studentId);
  const { portalPin: _pin, ...student } = await prisma.student.update({
    where: { id: studentId },
    data: { photoUrl: photoUrl || null },
    include: { class: true, section: true },
  });
  return student;
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
const { buildDefaultPassword } = portalPassword;

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
  getDeleteImpact,
  listStudents, getStudent, createStudent, updateStudent, deleteStudent,
  listGuardians, createGuardian, updateGuardian, deleteGuardian,
  getPortalPin, resetPortalPin, listSectionCredentials, getParentStudents, getStudentByUserId, setFeeAccessOverride,
  setParentStudentPhoto, setStudentPhoto, assertParentOwnsStudent,
  // Class join codes
  generateClassJoinCode, getClassJoinCode, listClassJoinCodes,
  lookupClassByJoinCode,
  // Join requests
  createStudentJoinRequest, listJoinRequests, approveJoinRequest, rejectJoinRequest, resetStudentPassword,
  // Student activities
  listStudentActivities, createStudentActivity, deleteStudentActivity,
};
