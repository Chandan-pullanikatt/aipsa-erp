// Prisma client for the SEPARATE home-schooling database (HS_DATABASE_URL).
// Generated from prisma/homeschool/schema.prisma to a custom path so it never
// collides with the ERP client in ./prisma.js. Home-schooling code must use THIS
// client; it shares no tables with the ERP database.
const { PrismaClient } = require('../../prisma/generated/hs-client');

const hsPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = hsPrisma;
