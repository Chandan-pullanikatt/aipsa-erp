// One-off: create a STUDENT login account for demos.
// Links to an existing student record if found, otherwise picks the first
// unlinked ACTIVE student in the St Mary's tenant.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const DEMO_EMAIL = 'student.demo@stmarys.edu';
const DEMO_PASSWORD = 'Student@1234';
const PREFERRED_ADM = 'ADM-2026-0005'; // Ananya Krishnan

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'stmarys' } })
    || await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found — is the DB seeded?');

  // Reuse the account if it already exists (idempotent re-runs)
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12);

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, isActive: true, mustChangePassword: false, role: 'STUDENT' },
    });
  } else {
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: DEMO_EMAIL,
        password: hashed,
        role: 'STUDENT',
        firstName: 'Demo',
        lastName: 'Student',
        isActive: true,
        mustChangePassword: false,
      },
    });
  }

  // Link to a student record so the portal has data to show
  let student = await prisma.student.findFirst({
    where: { tenantId: tenant.id, admissionNumber: PREFERRED_ADM },
  });
  if (!student) {
    student = await prisma.student.findFirst({
      where: { tenantId: tenant.id, userId: null },
      orderBy: { admissionNumber: 'asc' },
    });
  }
  if (student) {
    await prisma.student.update({ where: { id: student.id }, data: { userId: user.id } });
  }

  console.log('\n✅ Demo student account ready:');
  console.log('   Email:    ', DEMO_EMAIL);
  console.log('   Password: ', DEMO_PASSWORD);
  console.log('   Linked to:', student ? `${student.firstName} ${student.lastName} (${student.admissionNumber})` : 'NO student record (login works, portal may be empty)');
  console.log('   Tenant:   ', tenant.name);
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
