require('dotenv').config();
const app = require('./app');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function autoSeed() {
  try {
    const email = 'admin@aipsa.org';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'AipsaAdmin@2024';
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
