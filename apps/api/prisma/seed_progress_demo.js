/**
 * AIPSA — Holistic Progress Card demo seed
 * Populates Term 1 + Term 2 (published) for St. Mary's Academy → Class 7:
 *   marks, CCA areas + grades, conduct, achievements, remarks, faculty snapshot.
 *
 * Run:  node prisma/seed_progress_demo.js   (from apps/api)
 * Idempotent: safe to re-run.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { calculateGrade } = require('../src/services/exam.service');

const prisma = new PrismaClient();

const YEAR = '2026-27';
const TERMS = ['TERM_1', 'TERM_2'];
const CCA_DEFS = ['Music', 'Art & Craft', 'Sports & Games', 'Yoga & Wellness'];
const CONDUCT_TRAITS = ['discipline', 'punctuality', 'neatness', 'teamwork'];

// deterministic pseudo-random so re-runs are stable
function pick(arr, seed) { return arr[seed % arr.length]; }
const CCA_GRADES = ['A', 'A', 'B', 'A', 'B', 'C'];

const ACHIEVEMENTS = {
  TERM_1: [
    'Won 1st place in the inter-house Science quiz.',
    'Represented the school choir at the Annual Day.',
    'Best fielder award — junior cricket league.',
    'Selected for the regional Mathematics Olympiad.',
    '2nd prize in the on-the-spot painting competition.',
  ],
  TERM_2: [
    'District-level 100m sprint finalist.',
    'Led the class project on water conservation.',
    'Certificate of merit in handwriting competition.',
    'Volunteered for the school cleanliness drive.',
    'Part of the winning team in the debate championship.',
  ],
};
const REMARKS = {
  TERM_1: [
    'A diligent and curious learner. Keep up the consistent effort.',
    'Shows good progress; should participate more in class discussions.',
    'Excellent attitude and discipline. A pleasure to teach.',
    'Capable student — focus on completing work on time.',
    'Bright and enthusiastic. Encourage more reading at home.',
  ],
  TERM_2: [
    'Marked improvement this term. Well done!',
    'Strong all-round performance, especially in co-curriculars.',
    'Continues to grow in confidence. Keep practising.',
    'Good academic recovery; maintain this momentum.',
    'A responsible and helpful member of the class.',
  ],
};

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'st-marys-academy-demo' } });
  if (!tenant) throw new Error('Demo tenant not found — run demo_seed.js first.');
  const tenantId = tenant.id;

  const cls = await prisma.class.findFirst({ where: { tenantId, name: 'Class 7' } });
  if (!cls) throw new Error('Class 7 not found.');

  const subjects = await prisma.subject.findMany({ where: { tenantId, classId: cls.id }, include: { teacher: true } });
  const students = await prisma.student.findMany({ where: { tenantId, classId: cls.id, status: 'ACTIVE' }, orderBy: { firstName: 'asc' } });
  const teachers = await prisma.user.findMany({ where: { tenantId, role: 'TEACHER' } });

  console.log(`Seeding progress for ${cls.name}: ${students.length} students, ${subjects.length} subjects.`);

  // 1. Class teacher (incharge) — needed for the faculty block + publisher
  let inchargeId = cls.inchargeTeacherId;
  if (!inchargeId) {
    inchargeId = subjects[0]?.teacherId || teachers[0]?.id;
    await prisma.class.update({ where: { id: cls.id }, data: { inchargeTeacherId: inchargeId } });
    console.log('  Set class teacher.');
  }

  // 2. Term exams (find-or-create, COMPLETED)
  const termExam = {};
  for (let i = 0; i < TERMS.length; i++) {
    const term = TERMS[i];
    let exam = await prisma.exam.findFirst({ where: { tenantId, classId: cls.id, academicYear: YEAR, term } });
    const name = term === 'TERM_1' ? 'Term 1 Examination' : 'Term 2 Examination';
    const startDate = term === 'TERM_1' ? new Date('2026-09-20') : new Date('2027-02-20');
    if (exam) {
      exam = await prisma.exam.update({ where: { id: exam.id }, data: { name, status: 'COMPLETED', maxMarks: 100, passingMarks: 33, startDate } });
    } else {
      exam = await prisma.exam.create({ data: { tenantId, name, classId: cls.id, academicYear: YEAR, term, status: 'COMPLETED', maxMarks: 100, passingMarks: 33, startDate } });
    }
    termExam[term] = exam;
  }

  // 3. CCA areas (assign rotating teachers)
  const ccaAreas = [];
  for (let i = 0; i < CCA_DEFS.length; i++) {
    const name = CCA_DEFS[i];
    const teacherId = teachers[i % teachers.length]?.id || null;
    const area = await prisma.ccaArea.upsert({
      where: { tenantId_classId_name: { tenantId, classId: cls.id, name } },
      create: { tenantId, classId: cls.id, name, teacherId, sortOrder: i },
      update: { teacherId, sortOrder: i },
    });
    ccaAreas.push(area);
  }

  // faculty snapshot frozen at publish
  const facultySnapshot = {
    classTeacher: (() => { const t = teachers.find(t => t.id === inchargeId); return t ? `${t.firstName} ${t.lastName}` : null; })(),
    subjects: subjects.map(s => ({ subject: s.name, teacher: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : null })),
    frozenAt: new Date().toISOString(),
  };

  // 4. Per student: marks, CCA grades, progress term (published)
  for (let si = 0; si < students.length; si++) {
    const s = students[si];
    const ability = 58 + (si * 7) % 35; // 58..92 spread

    for (let ti = 0; ti < TERMS.length; ti++) {
      const term = TERMS[ti];
      const exam = termExam[term];
      const bump = ti * 4; // term 2 slightly higher to show progress

      // marks per subject
      for (let sj = 0; sj < subjects.length; sj++) {
        const subj = subjects[sj];
        let marks = ability + bump + ((si + sj + ti) * 5) % 12 - 4;
        marks = Math.max(20, Math.min(99, marks));
        const grade = calculateGrade(marks, 100);
        await prisma.examResult.upsert({
          where: { examId_studentId_subjectId: { examId: exam.id, studentId: s.id, subjectId: subj.id } },
          create: { tenantId, examId: exam.id, studentId: s.id, subjectId: subj.id, marksObtained: marks, grade, isAbsent: false },
          update: { marksObtained: marks, grade, isAbsent: false },
        });
      }

      // CCA grades
      for (let ai = 0; ai < ccaAreas.length; ai++) {
        const grade = pick(CCA_GRADES, si + ai + ti);
        await prisma.ccaGrade.upsert({
          where: { ccaAreaId_studentId_term: { ccaAreaId: ccaAreas[ai].id, studentId: s.id, term } },
          create: { tenantId, ccaAreaId: ccaAreas[ai].id, studentId: s.id, term, grade },
          update: { grade },
        });
      }

      // conduct + achievements + remark, published
      const conduct = {};
      CONDUCT_TRAITS.forEach((tr, idx) => { conduct[tr] = pick(['A', 'A', 'B'], si + idx + ti); });
      await prisma.progressTerm.upsert({
        where: { studentId_term_academicYear: { studentId: s.id, term, academicYear: YEAR } },
        create: {
          tenantId, studentId: s.id, term, academicYear: YEAR,
          conduct, achievements: pick(ACHIEVEMENTS[term], si), remark: pick(REMARKS[term], si),
          status: 'PUBLISHED', publishedAt: new Date(), publishedById: inchargeId, facultySnapshot,
        },
        update: {
          conduct, achievements: pick(ACHIEVEMENTS[term], si), remark: pick(REMARKS[term], si),
          status: 'PUBLISHED', publishedAt: new Date(), publishedById: inchargeId, facultySnapshot,
        },
      });
    }
    console.log(`  ✓ ${s.firstName} ${s.lastName}`);
  }

  console.log('\n✅ Holistic progress cards seeded & published for Class 7 (Term 1 + Term 2).');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
