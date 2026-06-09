require('dotenv').config();
const app = require('./app');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function autoSeed() {
  try {
    const email = 'admin@aipsa.org';
    const rawPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (!rawPassword || !rawPassword.trim()) {
      console.warn('[Auto-Seed] SUPER_ADMIN_PASSWORD is not set — skipping super admin seed.');
      return;
    }
    const password = rawPassword.trim();
    const hashed = await bcrypt.hash(password, 12);
    
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email,
          password: hashed,
          role: 'SUPER_ADMIN',
          firstName: 'AIPSA',
          lastName: 'Admin',
          tenantId: null,
          isActive: true,
        },
      });
      console.log(`[Auto-Seed] Super admin (${email}) created successfully.`);
    } else {
      await prisma.user.update({
        where: { email },
        data: { password: hashed },
      });
      console.log(`[Auto-Seed] Super admin (${email}) password synchronized successfully.`);
    }
  } catch (err) {
    console.error('[Auto-Seed] Error seeding super admin:', err);
  } finally {
    await prisma.$disconnect();
  }
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`API server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  await autoSeed();
});
