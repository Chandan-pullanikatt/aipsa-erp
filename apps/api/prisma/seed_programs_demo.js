/**
 * AIPSA — Programs & Registrations demo seed
 * Creates a spread of AIPSA-global programs (tenantId: null) so they appear for
 * every school's students/parents/admins without targeting a specific tenant.
 * Covers every ProgramType and the sub-item + teacher-match + metadata paths.
 *
 * Run:  node prisma/seed_programs_demo.js   (from apps/api)
 * Idempotent: matches on (tenantId null + title); re-running updates in place.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

// Each entry mirrors what an admin would create in the UI.
const PROGRAMS = [
  {
    type: 'EVENT', category: 'Marathon', title: 'Youth First Marathon',
    description: 'Annual inter-school marathon promoting fitness and youth spirit. Includes a t-shirt and finisher medal.',
    fee: 200, audience: 'ANYONE', capacity: 500, closesAt: daysFromNow(30),
  },
  {
    type: 'EVENT', category: 'Conclave', title: 'Education Excellence Conclave',
    description: 'A gathering for Principals and Directors on leadership, policy and school development.',
    fee: 1000, audience: 'PRINCIPAL', closesAt: daysFromNow(45),
    metadata: { schoolDevelopmentFund: true },
  },
  {
    type: 'COUNSELING', category: 'Parental Counseling', title: 'Parental Counseling Session',
    description: 'Free guidance for parents on supporting their child’s learning and well-being.',
    fee: 0, audience: 'PARENT',
  },
  {
    type: 'COUNSELING', category: 'Student Counseling', title: 'Student Counseling Session',
    description: 'One-on-one counseling for students — academics, career and well-being.',
    fee: 0, audience: 'STUDENT',
  },
  {
    type: 'COMPETITION', category: 'Olympiad', title: 'National Olympiad 2026',
    description: 'Subject Olympiads with certificates and scholarships for toppers.',
    fee: 0, audience: 'STUDENT', closesAt: daysFromNow(20),
    items: [
      { name: 'Mathematics Olympiad', fee: 150 },
      { name: 'Science Olympiad', fee: 150 },
      { name: 'English Olympiad', fee: 120 },
    ],
  },
  {
    type: 'COMPETITION', category: 'Arts Festival', title: 'Annual Arts Festival',
    description: 'Register for arts-festival items and pay per item.',
    fee: 0, audience: 'STUDENT', closesAt: daysFromNow(25),
    items: [
      { name: 'Solo Singing', fee: 100 },
      { name: 'Group Dance', fee: 150 },
      { name: 'Painting', fee: 80 },
      { name: 'Elocution', fee: 80 },
    ],
  },
  {
    type: 'COMPETITION', category: 'Coloring', title: 'Colouring Competition (Primary)',
    description: 'A fun colouring competition for primary classes.',
    fee: 50, audience: 'STUDENT', closesAt: daysFromNow(15),
  },
  {
    type: 'TUITION', category: '1-to-1 Tuition', title: 'One-to-One Tuition',
    description: 'Personalised individual tuition. A teacher is assigned after registration.',
    fee: 500, audience: 'STUDENT', requiresTeacherMatch: true,
  },
  {
    type: 'TRAINING', category: 'Teacher Training', title: 'Teachers Training Program',
    description: 'Professional development for teachers — pedagogy, classroom management and EdTech.',
    fee: 0, audience: 'TEACHER',
  },
  {
    type: 'TRAINING', category: 'Leadership Training', title: 'School Leadership Training Program',
    description: 'A dedicated training program for Principals and school leaders.',
    fee: 300, audience: 'PRINCIPAL',
  },
];

async function main() {
  console.log('Seeding AIPSA-global demo programs…');
  for (const p of PROGRAMS) {
    const { items, ...data } = p;

    // Idempotent upsert by (global + title). findFirst since there's no unique key.
    const existing = await prisma.program.findFirst({ where: { tenantId: null, title: p.title } });

    if (existing) {
      await prisma.program.update({ where: { id: existing.id }, data: { ...data, tenantId: null } });
      // Refresh items: clear and recreate so the demo set stays exact.
      if (items) {
        await prisma.programItem.deleteMany({ where: { programId: existing.id } });
        await prisma.programItem.createMany({ data: items.map((i) => ({ programId: existing.id, name: i.name, fee: i.fee ?? null })) });
      }
      console.log(`  ~ updated: ${p.title}`);
    } else {
      await prisma.program.create({
        data: {
          ...data, tenantId: null,
          items: items ? { create: items.map((i) => ({ name: i.name, fee: i.fee ?? null })) } : undefined,
        },
      });
      console.log(`  + created: ${p.title}`);
    }
  }
  const total = await prisma.program.count({ where: { tenantId: null } });
  console.log(`Done. ${total} global programs now live.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
