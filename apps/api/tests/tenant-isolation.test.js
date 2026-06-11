/**
 * Multi-tenant isolation test (standalone, no test framework needed).
 *
 *   Run a Postgres the app can reach, then:   node tests/tenant-isolation.test.js
 *
 * It creates two throwaway tenants (A with data, B empty), then drives the REAL
 * service layer trying to read tenant A's records using tenant B's id. Every such
 * read must be denied (throw 4xx, or return null/empty). A single leak fails the run.
 *
 * All test data uses the slug prefix `iso-test-` and is deleted at the end, even on
 * failure. It never touches the demo or production tenants.
 */
const prisma = require('../src/lib/prisma');
const sis = require('../src/services/sis.service');
const fee = require('../src/services/fee.service');
const exam = require('../src/services/exam.service');
const hostel = require('../src/services/hostel.service');

let pass = 0;
let fail = 0;

/** A read is "denied" if it throws (4xx) OR yields null / empty array / no rows. */
async function expectDenied(label, fn) {
  try {
    const result = await fn();
    const leaked =
      result != null &&
      !(Array.isArray(result) && result.length === 0) &&
      !(result && typeof result === 'object' && Array.isArray(result.items) && result.items.length === 0);
    if (leaked) {
      fail++;
      console.error(`  ❌ LEAK: ${label} returned cross-tenant data:`, JSON.stringify(result).slice(0, 120));
    } else {
      pass++;
      console.log(`  ✅ ${label} — empty/null (denied)`);
    }
  } catch (err) {
    pass++;
    console.log(`  ✅ ${label} — threw ${err.status || ''} ${err.message} (denied)`);
  }
}

/**
 * A mutation is isolated if it (a) throws when run cross-tenant AND (b) leaves the
 * target row untouched. `stillThere` must re-fetch the row and return it (or null).
 */
async function expectMutationDenied(label, fn, stillThere) {
  let threw = false;
  try {
    await fn();
  } catch {
    threw = true;
  }
  const row = await stillThere();
  if (!threw && row == null) {
    fail++;
    console.error(`  ❌ LEAK: ${label} — mutation succeeded cross-tenant and changed/deleted the row`);
  } else if (!threw) {
    fail++;
    console.error(`  ❌ LEAK: ${label} — mutation did NOT throw cross-tenant (row still present, but call was allowed)`);
  } else if (row == null) {
    fail++;
    console.error(`  ❌ LEAK: ${label} — threw but the target row was deleted anyway`);
  } else {
    pass++;
    console.log(`  ✅ ${label} — threw & row intact (denied)`);
  }
}

async function expectAllowed(label, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✅ ${label} — own-tenant read succeeded`);
  } catch (err) {
    fail++;
    console.error(`  ❌ ${label} — own-tenant read FAILED:`, err.message);
  }
}

async function makeTenant(slug, withData) {
  const tenant = await prisma.tenant.create({ data: { name: slug, slug, status: 'ACTIVE' } });
  const admin = await prisma.user.create({
    data: { tenantId: tenant.id, email: `${slug}@iso.test`, password: 'x', role: 'SCHOOL_ADMIN', firstName: 'Iso', lastName: 'Admin' },
  });
  const data = {};
  if (withData) {
    const cls = await prisma.class.create({ data: { tenantId: tenant.id, name: 'Class X' } });
    const sec = await prisma.section.create({ data: { tenantId: tenant.id, classId: cls.id, name: 'A' } });
    data.student = await prisma.student.create({
      data: {
        tenantId: tenant.id, admissionNumber: `ISO-${slug}-1`, firstName: 'Secret', lastName: 'Student',
        classId: cls.id, sectionId: sec.id,
      },
    });
    data.hostel = await prisma.hostel.create({ data: { tenantId: tenant.id, name: 'Iso Hostel', type: 'BOYS' } });
    // An EMPTY class + its section: no enrolled students, so the ONLY thing that can
    // block a delete is tenant scoping — making the delete-isolation test meaningful.
    data.emptyClass = await prisma.class.create({ data: { tenantId: tenant.id, name: 'Deletable Class' } });
    data.emptySection = await prisma.section.create({ data: { tenantId: tenant.id, classId: data.emptyClass.id, name: 'Z' } });
    data.exam = await prisma.exam.create({
      data: { tenantId: tenant.id, name: 'Iso Exam', classId: cls.id, academicYear: '2026-2027', startDate: new Date('2026-05-01') },
    });
  }
  return { tenant, admin, ...data };
}

async function main() {
  console.log('\n🔐  Multi-tenant isolation test\n');
  const A = await makeTenant('iso-test-a', true);
  const B = await makeTenant('iso-test-b', false);

  console.log('Cross-tenant reads (tenant B trying to read tenant A\'s data):');
  await expectDenied('sis.getStudent(B, A.studentId)',          () => sis.getStudent(B.tenant.id, A.student.id));
  await expectDenied('sis.getPortalPin(B, A.studentId)',        () => sis.getPortalPin(B.tenant.id, A.student.id));
  await expectDenied('fee.getStudentFeeAccount(B, A.studentId)',() => fee.getStudentFeeAccount(B.tenant.id, A.student.id));
  await expectDenied('exam.getStudentReportCard(B, A.studentId)',() => exam.getStudentReportCard(B.tenant.id, A.student.id));
  await expectDenied('hostel.getHostel(B, A.hostelId)',         () => hostel.getHostel(B.tenant.id, A.hostel.id));
  await expectDenied('sis.listStudents(B) excludes A',          async () => {
    const r = await sis.listStudents(B.tenant.id, {});
    return (r.students || []).find((s) => s.id === A.student.id) || null; // null => denied
  });

  console.log('\nCross-tenant writes/deletes (tenant B trying to modify tenant A\'s data):');
  const found = (model, id) => () => prisma[model].findUnique({ where: { id } });

  await expectMutationDenied('sis.updateStudent(B, A.studentId)',
    () => sis.updateStudent(B.tenant.id, A.student.id, { firstName: 'HACKED' }),
    async () => {
      const s = await prisma.student.findUnique({ where: { id: A.student.id } });
      return s && s.firstName === 'Secret' ? s : null; // null => was mutated
    });
  await expectMutationDenied('sis.updateClass(B, A.emptyClassId)',
    () => sis.updateClass(B.tenant.id, A.emptyClass.id, { name: 'HACKED' }),
    async () => {
      const c = await prisma.class.findUnique({ where: { id: A.emptyClass.id } });
      return c && c.name === 'Deletable Class' ? c : null;
    });
  await expectMutationDenied('sis.deleteClass(B, A.emptyClassId)',
    () => sis.deleteClass(B.tenant.id, A.emptyClass.id),
    found('class', A.emptyClass.id));
  await expectMutationDenied('sis.updateSection(B, A.emptySectionId)',
    () => sis.updateSection(B.tenant.id, A.emptySection.id, { name: 'Y' }),
    found('section', A.emptySection.id));
  await expectMutationDenied('sis.deleteSection(B, A.emptySectionId)',
    () => sis.deleteSection(B.tenant.id, A.emptySection.id),
    found('section', A.emptySection.id));
  await expectMutationDenied('exam.updateExam(B, A.examId)',
    () => exam.updateExam(B.tenant.id, A.exam.id, { name: 'HACKED' }),
    async () => {
      const e = await prisma.exam.findUnique({ where: { id: A.exam.id } });
      return e && e.name === 'Iso Exam' ? e : null;
    });
  await expectMutationDenied('exam.deleteExam(B, A.examId)',
    () => exam.deleteExam(B.tenant.id, A.exam.id),
    found('exam', A.exam.id));
  await expectMutationDenied('hostel.updateHostel(B, A.hostelId)',
    () => hostel.updateHostel(B.tenant.id, A.hostel.id, { name: 'HACKED' }),
    async () => {
      const h = await prisma.hostel.findUnique({ where: { id: A.hostel.id } });
      return h && h.name === 'Iso Hostel' ? h : null;
    });
  await expectMutationDenied('hostel.deleteHostel(B, A.hostelId)',
    () => hostel.deleteHostel(B.tenant.id, A.hostel.id),
    found('hostel', A.hostel.id));

  console.log('\nControl — tenant A reading/mutating its OWN data (must succeed):');
  await expectAllowed('sis.getStudent(A, A.studentId)', () => sis.getStudent(A.tenant.id, A.student.id));
  await expectAllowed('sis.deleteClass(A, A.emptyClassId)', () => sis.deleteClass(A.tenant.id, A.emptyClass.id));

  // cleanup
  await prisma.tenant.deleteMany({ where: { slug: { in: ['iso-test-a', 'iso-test-b'] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@iso.test' } } });

  console.log(`\n──────── ${pass} passed, ${fail} failed ────────\n`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('Test crashed:', e);
  try { await prisma.tenant.deleteMany({ where: { slug: { in: ['iso-test-a', 'iso-test-b'] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@iso.test' } } }); } catch {}
  await prisma.$disconnect();
  process.exit(1);
});
