const prisma = require('./prisma');

// Ownership guards for ids that arrive in a request body.
//
// A route only proves *who* the caller is; it does not prove that the ids they sent belong to
// their tenant. Where a service upserts using a body-supplied studentId/classId, the row is
// written under the caller's tenantId while pointing at another tenant's records — the write
// succeeds, and the result is a row that belongs to neither school cleanly. Call these before
// any such write.
//
// 404 (not 403) is deliberate and matches the rest of the codebase: a caller must not be able
// to tell the difference between "this id is not yours" and "this id does not exist", or the
// error itself confirms that another tenant holds that id.

function notFound(what) {
  return Object.assign(new Error(`${what} not found`), { status: 404 });
}

// Throws unless every id in `studentIds` belongs to `tenantId`. Deduped so a repeated id in the
// payload cannot skew the count comparison.
async function assertStudentsInTenant(tenantId, studentIds) {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  if (!ids.length) return;

  const found = await prisma.student.count({ where: { id: { in: ids }, tenantId } });
  if (found !== ids.length) throw notFound('Student');
}

async function assertClassInTenant(tenantId, classId) {
  if (!classId) return;

  const cls = await prisma.class.findFirst({ where: { id: classId, tenantId }, select: { id: true } });
  if (!cls) throw notFound('Class');
}

async function assertSectionInTenant(tenantId, sectionId) {
  if (!sectionId) return;

  const section = await prisma.section.findFirst({ where: { id: sectionId, tenantId }, select: { id: true } });
  if (!section) throw notFound('Section');
}

module.exports = { assertStudentsInTenant, assertClassInTenant, assertSectionInTenant };
