// Demo seed for the home-schooling database. Idempotent (upserts by natural keys).
// Run with: npm run db:hs:seed  (needs HS_DATABASE_URL set).
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../generated/hs-client');

const hsPrisma = new PrismaClient();

async function main() {
  // Demo family account
  const password = await bcrypt.hash('demo1234', 12);
  const account = await hsPrisma.hsAccount.upsert({
    where: { email: 'demo@family.test' },
    update: {},
    create: {
      email: 'demo@family.test',
      password,
      parentFirstName: 'Demo',
      parentLastName: 'Family',
      phone: '9000000000',
    },
  });

  // Demo course → module → lessons
  let course = await hsPrisma.hsCourse.findFirst({ where: { title: 'Grade 5 Mathematics' } });
  if (!course) {
    course = await hsPrisma.hsCourse.create({
      data: {
        title: 'Grade 5 Mathematics',
        description: 'Foundational maths for grade 5 — numbers, fractions, geometry.',
        subject: 'Mathematics',
        gradeLevel: 'Grade 5',
        board: 'CBSE',
        isPublished: true,
        sortOrder: 1,
        modules: {
          create: [{
            title: 'Numbers & Place Value',
            sequence: 1,
            lessons: {
              create: [
                { title: 'Reading large numbers', sequence: 1, isFreePreview: true, durationMin: 12, content: 'Intro lesson (free preview).' },
                { title: 'Place value to millions', sequence: 2, durationMin: 15, content: 'Members-only lesson.' },
              ],
            },
          }],
        },
      },
    });
  }

  // Demo learner + active subscription
  const learner = await hsPrisma.hsLearner.findFirst({ where: { accountId: account.id } });
  if (!learner) {
    await hsPrisma.hsLearner.create({
      data: { accountId: account.id, firstName: 'Aarav', lastName: 'Family', gradeLevel: 'Grade 5' },
    });
  }
  const sub = await hsPrisma.hsSubscription.findFirst({ where: { accountId: account.id } });
  if (!sub) {
    const end = new Date();
    end.setMonth(end.getMonth() + 12);
    await hsPrisma.hsSubscription.create({
      data: { accountId: account.id, plan: 'FAMILY', amount: 999, status: 'ACTIVE', currentPeriodEnd: end },
    });
  }

  console.log('Home-schooling demo seed complete. Login: demo@family.test / demo1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => hsPrisma.$disconnect());
