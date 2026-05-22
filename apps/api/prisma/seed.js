const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@aipsa.org' } });
  if (existing) {
    console.log('Super admin already exists, skipping seed.');
    return;
  }

  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) {
    console.error('SUPER_ADMIN_PASSWORD environment variable is required to run seed.');
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);

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

  console.log('Super admin seeded: admin@aipsa.org');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
