// Seeds a small sample Home-Schooling catalog so the B2C app has content to show.
// Idempotent-ish: skips if any published course already exists.
// Run AFTER the add_homeschooling migration:  node prisma/seed-homeschool.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COURSES = [
  {
    title: 'Mathematics — Grade 5', subject: 'Mathematics', gradeLevel: 'Grade 5',
    description: 'Numbers, fractions, geometry and data handling for Grade 5.',
    modules: [
      { title: 'Numbers & Place Value', lessons: [
        { title: 'Reading large numbers', isFreePreview: true, durationMin: 12, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { title: 'Rounding & estimation', durationMin: 10 },
      ] },
      { title: 'Fractions', lessons: [
        { title: 'Understanding fractions', durationMin: 14 },
        { title: 'Adding fractions', durationMin: 16 },
      ] },
    ],
  },
  {
    title: 'Science — Grade 5', subject: 'Science', gradeLevel: 'Grade 5',
    description: 'Living things, matter, and our environment.',
    modules: [
      { title: 'Living World', lessons: [
        { title: 'Plants around us', isFreePreview: true, durationMin: 11 },
        { title: 'Animal habitats', durationMin: 13 },
      ] },
    ],
  },
  {
    title: 'English — Grade 8', subject: 'English', gradeLevel: 'Grade 8',
    description: 'Reading comprehension, grammar and composition.',
    modules: [
      { title: 'Grammar Foundations', lessons: [
        { title: 'Tenses overview', isFreePreview: true, durationMin: 15 },
        { title: 'Active & passive voice', durationMin: 18 },
      ] },
    ],
  },
];

async function main() {
  const existing = await prisma.hsCourse.count({ where: { isPublished: true } });
  if (existing > 0) {
    console.log(`[seed-homeschool] ${existing} published course(s) already exist — skipping.`);
    return;
  }

  let sortOrder = 0;
  for (const c of COURSES) {
    const course = await prisma.hsCourse.create({
      data: {
        title: c.title, subject: c.subject, gradeLevel: c.gradeLevel,
        description: c.description, isPublished: true, sortOrder: sortOrder++,
      },
    });
    let mSeq = 0;
    for (const m of c.modules) {
      const mod = await prisma.hsModule.create({
        data: { courseId: course.id, title: m.title, sequence: mSeq++ },
      });
      let lSeq = 0;
      for (const l of m.lessons) {
        await prisma.hsLesson.create({
          data: {
            moduleId: mod.id, title: l.title, sequence: lSeq++,
            durationMin: l.durationMin ?? null,
            videoUrl: l.videoUrl ?? null,
            isFreePreview: !!l.isFreePreview,
            content: `Sample lesson content for "${l.title}".`,
          },
        });
      }
    }
    console.log(`[seed-homeschool] created course: ${c.title}`);
  }
  console.log('[seed-homeschool] done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
