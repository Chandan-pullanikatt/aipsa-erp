const prisma = require('../lib/prisma');

const DAY = 86400000;

async function resolveStudent(tenantId, user, studentId) {
  if (user.role === 'STUDENT') {
    const s = await prisma.student.findFirst({ where: { tenantId, userId: user.id }, select: { id: true } });
    if (!s) throw Object.assign(new Error('Student profile not found'), { status: 404 });
    return s.id;
  }
  if (user.role === 'PARENT') {
    const s = await prisma.student.findFirst({
      where: { tenantId, ...(studentId ? { id: studentId } : {}), guardians: { some: { userId: user.id } } },
      select: { id: true },
    });
    if (!s) throw Object.assign(new Error('Student not found or not linked to you'), { status: 404 });
    return s.id;
  }
  if (!studentId) throw Object.assign(new Error('studentId is required'), { status: 400 });
  return studentId;
}

async function finePerDay(tenantId) {
  const p = await prisma.schoolProfile.findUnique({ where: { tenantId }, select: { libraryFinePerDay: true } });
  return p?.libraryFinePerDay ?? 0;
}

function overdueDays(dueDate, asOf = new Date()) {
  const d = Math.floor((asOf.setHours(0, 0, 0, 0) - new Date(dueDate).setHours(0, 0, 0, 0)) / DAY);
  return Math.max(0, d);
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

async function listBooks(tenantId, { search, category } = {}) {
  return prisma.libraryBook.findMany({
    where: {
      tenantId,
      ...(category && { category }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } },
          { isbn: { contains: search } },
        ],
      }),
    },
    orderBy: { title: 'asc' },
  });
}

async function createBook(tenantId, data) {
  const { title, author, isbn, category, readingLevel, coverUrl, totalCopies } = data;
  const copies = totalCopies != null && totalCopies !== '' ? parseInt(totalCopies) : 1;
  return prisma.libraryBook.create({
    data: {
      tenantId, title: title.trim(),
      author: author || undefined, isbn: isbn || undefined, category: category || undefined,
      readingLevel: readingLevel || undefined, coverUrl: coverUrl || undefined,
      totalCopies: copies, availableCopies: copies,
    },
  });
}

async function updateBook(tenantId, id, data) {
  const book = await prisma.libraryBook.findFirst({ where: { id, tenantId } });
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
  const { title, author, isbn, category, readingLevel, coverUrl, totalCopies } = data;
  // Keep availableCopies consistent if totalCopies changes (by the same delta).
  let availableCopies;
  if (totalCopies !== undefined && totalCopies !== '') {
    const newTotal = parseInt(totalCopies);
    const delta = newTotal - book.totalCopies;
    availableCopies = Math.max(0, book.availableCopies + delta);
  }
  return prisma.libraryBook.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(author !== undefined && { author: author || null }),
      ...(isbn !== undefined && { isbn: isbn || null }),
      ...(category !== undefined && { category: category || null }),
      ...(readingLevel !== undefined && { readingLevel: readingLevel || null }),
      ...(coverUrl !== undefined && { coverUrl: coverUrl || null }),
      ...(totalCopies !== undefined && totalCopies !== '' && { totalCopies: parseInt(totalCopies), availableCopies }),
    },
  });
}

async function deleteBook(tenantId, id) {
  const book = await prisma.libraryBook.findFirst({ where: { id, tenantId } });
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
  await prisma.libraryBook.delete({ where: { id } });
}

// ─── Issue / Return ───────────────────────────────────────────────────────────

async function issueBook(tenantId, issuedById, { bookId, studentId, dueDate }) {
  const [book, student] = await Promise.all([
    prisma.libraryBook.findFirst({ where: { id: bookId, tenantId } }),
    prisma.student.findFirst({ where: { id: studentId, tenantId } }),
  ]);
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  if (book.availableCopies < 1) throw Object.assign(new Error('No copies available.'), { status: 409 });

  const due = dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * DAY); // default 14-day loan

  const [issue] = await prisma.$transaction([
    prisma.bookIssue.create({
      data: { tenantId, bookId, studentId, issuedById, dueDate: due },
      include: {
        book: { select: { title: true } },
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
      },
    }),
    prisma.libraryBook.update({ where: { id: bookId }, data: { availableCopies: { decrement: 1 } } }),
  ]);
  return issue;
}

async function returnBook(tenantId, issueId) {
  const issue = await prisma.bookIssue.findFirst({ where: { id: issueId, tenantId } });
  if (!issue) throw Object.assign(new Error('Issue record not found'), { status: 404 });
  if (issue.returnedAt) throw Object.assign(new Error('Already returned.'), { status: 409 });

  const rate = await finePerDay(tenantId);
  const fine = overdueDays(issue.dueDate) * rate;

  const [updated] = await prisma.$transaction([
    prisma.bookIssue.update({
      where: { id: issueId },
      data: { returnedAt: new Date(), fineAmount: fine },
      include: { book: { select: { title: true } }, student: { select: { firstName: true, lastName: true } } },
    }),
    prisma.libraryBook.update({ where: { id: issue.bookId }, data: { availableCopies: { increment: 1 } } }),
  ]);
  return updated;
}

async function collectFine(tenantId, issueId) {
  const issue = await prisma.bookIssue.findFirst({ where: { id: issueId, tenantId } });
  if (!issue) throw Object.assign(new Error('Issue record not found'), { status: 404 });
  return prisma.bookIssue.update({ where: { id: issueId }, data: { fineCollected: true } });
}

// status: 'issued' (not returned), 'overdue', 'returned'
async function listIssues(tenantId, { status, studentId } = {}) {
  const where = { tenantId, ...(studentId && { studentId }) };
  if (status === 'issued') where.returnedAt = null;
  else if (status === 'returned') where.returnedAt = { not: null };
  else if (status === 'overdue') { where.returnedAt = null; where.dueDate = { lt: new Date() }; }

  const issues = await prisma.bookIssue.findMany({
    where,
    orderBy: { issuedAt: 'desc' },
    include: {
      book: { select: { id: true, title: true, author: true } },
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } } } },
    },
  });
  const rate = await finePerDay(tenantId);
  return issues.map((i) => {
    const od = i.returnedAt ? 0 : overdueDays(i.dueDate);
    return { ...i, overdueDays: od, accruingFine: i.returnedAt ? i.fineAmount : od * rate };
  });
}

async function getStudentLibrary(tenantId, user, studentId) {
  const sid = await resolveStudent(tenantId, user, studentId);
  const [student, issues] = await Promise.all([
    prisma.student.findFirst({ where: { id: sid, tenantId }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } }),
    prisma.bookIssue.findMany({
      where: { tenantId, studentId: sid },
      orderBy: { issuedAt: 'desc' },
      include: { book: { select: { title: true, author: true, coverUrl: true } } },
    }),
  ]);
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  const rate = await finePerDay(tenantId);
  const enriched = issues.map((i) => {
    const od = i.returnedAt ? 0 : overdueDays(i.dueDate);
    return { ...i, overdueDays: od, accruingFine: i.returnedAt ? i.fineAmount : od * rate };
  });
  return {
    student,
    current: enriched.filter((i) => !i.returnedAt),
    history: enriched.filter((i) => i.returnedAt),
    booksRead: enriched.filter((i) => i.returnedAt).length,
  };
}

module.exports = {
  listBooks, createBook, updateBook, deleteBook,
  issueBook, returnBook, collectFine, listIssues, getStudentLibrary,
};
