const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log("Tenants:", JSON.stringify(tenants, null, 2));
  
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, firstName: true, lastName: true, tenantId: true }
  });
  console.log("Users:", JSON.stringify(users, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
