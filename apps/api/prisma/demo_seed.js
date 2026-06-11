/**
 * AIPSA Digital School — Demo Seed Script
 * School: St. Mary's Academy
 *
 * Run:  node prisma/demo_seed.js    (from apps/api directory)
 *
 * Creates a fully-populated demo school with realistic data for all 12 modules.
 * Idempotent: skips if St. Mary's Academy tenant already exists.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function hash(plaintext) {
  return bcrypt.hash(plaintext, 10);
}

// Last 10 school weekdays before 2026-05-22 (today)
const ATTENDANCE_DATES = [
  new Date('2026-05-21T00:00:00.000Z'),
  new Date('2026-05-20T00:00:00.000Z'),
  new Date('2026-05-19T00:00:00.000Z'),
  new Date('2026-05-16T00:00:00.000Z'),
  new Date('2026-05-15T00:00:00.000Z'),
  new Date('2026-05-14T00:00:00.000Z'),
  new Date('2026-05-13T00:00:00.000Z'),
  new Date('2026-05-12T00:00:00.000Z'),
  new Date('2026-05-09T00:00:00.000Z'),
  new Date('2026-05-08T00:00:00.000Z'),
];

async function main() {
  console.log("\n🌱  Starting St. Mary's Academy demo seed...\n");

  // ── Idempotency Guard ────────────────────────────────────────────────────────
  const existing = await prisma.tenant.findFirst({
    where: { slug: 'st-marys-academy-demo' },
  });
  if (existing) {
    console.log("✅  Demo data already exists (tenant: st-marys-academy-demo). Skipping.");
    return;
  }

  // ── 1. Tenant & School Profile ───────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      name: "St. Mary's Academy",
      slug: 'st-marys-academy-demo',
      status: 'ACTIVE',
      joinCode: 'STMA-DEMO',
      profile: {
        create: {
          schoolName: "St. Mary's Academy",
          address: '42, Convent Road, Bandra West',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          phone: '+91-22-2640-1234',
          email: 'info@stmarys.edu',
          website: 'www.stmarysacademy.edu.in',
          board: 'CBSE',
          establishedYear: 1975,
        },
      },
    },
  });
  console.log('✅  Tenant created:', tenant.id);

  // ── 2. Super Admin (upsert — already auto-seeded by server) ──────────────────
  await prisma.user.upsert({
    where: { email: 'admin@aipsa.org' },
    update: {},
    create: {
      email: 'admin@aipsa.org',
      password: await hash('AipsaAdmin@2024'),
      role: 'SUPER_ADMIN',
      firstName: 'AIPSA',
      lastName: 'Admin',
      tenantId: null,
      isActive: true,
    },
  });

  // ── 3. School Admin ──────────────────────────────────────────────────────────
  const schoolAdmin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@stmarys.edu',
      password: await hash('Admin@1234'),
      role: 'SCHOOL_ADMIN',
      firstName: 'Sister',
      lastName: 'Margaret',
      phone: '+91-98765-43210',
      isActive: true,
    },
  });

  // ── 4. Teachers ──────────────────────────────────────────────────────────────
  const teacher1 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'sarah.thomas@stmarys.edu',
      password: await hash('Teacher@1234'),
      role: 'TEACHER',
      firstName: 'Sarah',
      lastName: 'Thomas',
      phone: '+91-98765-11111',
      isActive: true,
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'raj.kumar@stmarys.edu',
      password: await hash('Teacher@1234'),
      role: 'TEACHER',
      firstName: 'Raj',
      lastName: 'Kumar',
      phone: '+91-98765-22222',
      isActive: true,
    },
  });

  const teacher3 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'priya.nair@stmarys.edu',
      password: await hash('Teacher@1234'),
      role: 'TEACHER',
      firstName: 'Priya',
      lastName: 'Nair',
      phone: '+91-98765-33333',
      isActive: true,
    },
  });

  // ── 5. Parents ───────────────────────────────────────────────────────────────
  const parent1 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'davidmathew@gmail.com',
      password: await hash('Parent@1234'),
      role: 'PARENT',
      firstName: 'David',
      lastName: 'Mathew',
      phone: '+91-98765-44444',
      isActive: true,
    },
  });

  const parent2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'sunitasharma@gmail.com',
      password: await hash('Parent@1234'),
      role: 'PARENT',
      firstName: 'Sunita',
      lastName: 'Sharma',
      phone: '+91-98765-55555',
      isActive: true,
    },
  });

  console.log('✅  Users created (admin + 3 teachers + 2 parents)');

  // ── 6. Classes ───────────────────────────────────────────────────────────────
  const class6 = await prisma.class.create({ data: { tenantId: tenant.id, name: 'Class 6', joinCode: 'CL6A-DEMO' } });
  const class7 = await prisma.class.create({ data: { tenantId: tenant.id, name: 'Class 7', joinCode: 'CL7A-DEMO' } });
  const class8 = await prisma.class.create({ data: { tenantId: tenant.id, name: 'Class 8', joinCode: 'CL8A-DEMO' } });

  // ── 7. Sections ──────────────────────────────────────────────────────────────
  const sec6A  = await prisma.section.create({ data: { tenantId: tenant.id, classId: class6.id, name: 'A' } });
  const sec7A  = await prisma.section.create({ data: { tenantId: tenant.id, classId: class7.id, name: 'A' } });
  const sec7B  = await prisma.section.create({ data: { tenantId: tenant.id, classId: class7.id, name: 'B' } });
  const sec8A  = await prisma.section.create({ data: { tenantId: tenant.id, classId: class8.id, name: 'A' } });

  console.log('✅  Classes & sections created (Class 6A, 7A, 7B, 8A)');

  // ── 8. Subjects ──────────────────────────────────────────────────────────────
  // Class 6
  const s6Math = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class6.id, name: 'Mathematics',     code: 'MATH-6', teacherId: teacher1.id } });
  const s6Eng  = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class6.id, name: 'English Language', code: 'ENG-6',  teacherId: teacher2.id } });
  const s6Sci  = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class6.id, name: 'Science',          code: 'SCI-6',  teacherId: teacher3.id } });
  const s6SS   = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class6.id, name: 'Social Studies',   code: 'SS-6',   teacherId: teacher2.id } });

  // Class 7
  const s7Math = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class7.id, name: 'Mathematics',       code: 'MATH-7', teacherId: teacher1.id } });
  const s7Eng  = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class7.id, name: 'English Language',   code: 'ENG-7',  teacherId: teacher2.id } });
  const s7Sci  = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class7.id, name: 'Science',            code: 'SCI-7',  teacherId: teacher3.id } });
  const s7SS   = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class7.id, name: 'Social Studies',     code: 'SS-7',   teacherId: teacher2.id } });
  const s7CS   = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class7.id, name: 'Computer Science',   code: 'CS-7',   teacherId: teacher3.id } });

  // Class 8
  const s8Math = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class8.id, name: 'Mathematics',     code: 'MATH-8', teacherId: teacher1.id } });
  const s8Eng  = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class8.id, name: 'English Language', code: 'ENG-8',  teacherId: teacher2.id } });
  const s8Sci  = await prisma.subject.create({ data: { tenantId: tenant.id, classId: class8.id, name: 'Science',          code: 'SCI-8',  teacherId: teacher3.id } });

  console.log('✅  Subjects created');

  // ── 9. Students ──────────────────────────────────────────────────────────────
  // Portal PINs are hashed; plaintext PINs are shown in the summary at the end.
  const st1 = await prisma.student.create({ data: { tenantId: tenant.id, admissionNumber: 'ADM-2026-0001', firstName: 'Arjun',   lastName: 'Nair',     dateOfBirth: new Date('2013-06-15'), gender: 'MALE',   bloodGroup: 'B+', classId: class6.id, sectionId: sec6A.id, admissionDate: new Date('2026-04-01'), portalPin: await hash('100001') } });
  const st2 = await prisma.student.create({ data: { tenantId: tenant.id, admissionNumber: 'ADM-2026-0002', firstName: 'Meera',   lastName: 'Patel',    dateOfBirth: new Date('2013-03-22'), gender: 'FEMALE', bloodGroup: 'A+', classId: class6.id, sectionId: sec6A.id, admissionDate: new Date('2026-04-01'), portalPin: await hash('100002') } });
  const st3 = await prisma.student.create({ data: { tenantId: tenant.id, admissionNumber: 'ADM-2026-0003', firstName: 'Karan',   lastName: 'Singh',    dateOfBirth: new Date('2013-09-10'), gender: 'MALE',   bloodGroup: 'O+', classId: class6.id, sectionId: sec6A.id, admissionDate: new Date('2026-04-01'), portalPin: await hash('100003') } });
  // Class 7A — Rohan linked to parent1
  const st4 = await prisma.student.create({ data: { tenantId: tenant.id, admissionNumber: 'ADM-2026-0004', firstName: 'Rohan',   lastName: 'Mathew',   dateOfBirth: new Date('2012-11-05'), gender: 'MALE',   bloodGroup: 'AB+', classId: class7.id, sectionId: sec7A.id, admissionDate: new Date('2026-04-01'), portalPin: await hash('100004'), userId: parent1.id } });
  const st5 = await prisma.student.create({ data: { tenantId: tenant.id, admissionNumber: 'ADM-2026-0005', firstName: 'Ananya',  lastName: 'Krishnan', dateOfBirth: new Date('2012-07-18'), gender: 'FEMALE', bloodGroup: 'A-',  classId: class7.id, sectionId: sec7A.id, admissionDate: new Date('2026-04-01'), portalPin: await hash('100005') } });
  const st6 = await prisma.student.create({ data: { tenantId: tenant.id, admissionNumber: 'ADM-2026-0006', firstName: 'Vikram',  lastName: 'Reddy',    dateOfBirth: new Date('2012-02-28'), gender: 'MALE',   bloodGroup: 'B-',  classId: class7.id, sectionId: sec7A.id, admissionDate: new Date('2026-04-01'), portalPin: await hash('100006') } });
  // Class 7B — Pooja linked to parent2
  const st7 = await prisma.student.create({ data: { tenantId: tenant.id, admissionNumber: 'ADM-2026-0007', firstName: 'Pooja',   lastName: 'Sharma',   dateOfBirth: new Date('2012-08-12'), gender: 'FEMALE', bloodGroup: 'O-',  classId: class7.id, sectionId: sec7B.id, admissionDate: new Date('2026-04-01'), portalPin: await hash('100007'), userId: parent2.id } });
  const st8 = await prisma.student.create({ data: { tenantId: tenant.id, admissionNumber: 'ADM-2026-0008', firstName: 'Aditya',  lastName: 'Verma',    dateOfBirth: new Date('2012-05-30'), gender: 'MALE',   bloodGroup: 'A+',  classId: class7.id, sectionId: sec7B.id, admissionDate: new Date('2026-04-01'), portalPin: await hash('100008') } });
  // Class 8A
  const st9  = await prisma.student.create({ data: { tenantId: tenant.id, admissionNumber: 'ADM-2026-0009', firstName: 'Sneha',   lastName: 'Menon',    dateOfBirth: new Date('2011-12-20'), gender: 'FEMALE', bloodGroup: 'B+',  classId: class8.id, sectionId: sec8A.id, admissionDate: new Date('2026-04-01'), portalPin: await hash('100009') } });
  const st10 = await prisma.student.create({ data: { tenantId: tenant.id, admissionNumber: 'ADM-2026-0010', firstName: 'Rahul',   lastName: 'Iyer',     dateOfBirth: new Date('2011-04-08'), gender: 'MALE',   bloodGroup: 'O+',  classId: class8.id, sectionId: sec8A.id, admissionDate: new Date('2026-04-01'), portalPin: await hash('100010') } });

  console.log('✅  10 students created');

  // ── 10. Guardians ────────────────────────────────────────────────────────────
  await prisma.guardian.createMany({
    data: [
      { tenantId: tenant.id, studentId: st1.id,  firstName: 'Thomas',  lastName: 'Nair',     relation: 'FATHER', phone: '+91-98765-10001', email: 'thomas.nair@gmail.com',    isPrimary: true },
      { tenantId: tenant.id, studentId: st2.id,  firstName: 'Suresh',  lastName: 'Patel',    relation: 'FATHER', phone: '+91-98765-10002', email: 'suresh.patel@gmail.com',   isPrimary: true },
      { tenantId: tenant.id, studentId: st3.id,  firstName: 'Rekha',   lastName: 'Singh',    relation: 'MOTHER', phone: '+91-98765-10003', email: 'rekha.singh@gmail.com',    isPrimary: true },
      { tenantId: tenant.id, studentId: st4.id,  firstName: 'David',   lastName: 'Mathew',   relation: 'FATHER', phone: '+91-98765-44444', email: 'david.mathew@gmail.com',   isPrimary: true, userId: parent1.id },
      { tenantId: tenant.id, studentId: st5.id,  firstName: 'Latha',   lastName: 'Krishnan', relation: 'MOTHER', phone: '+91-98765-10005', email: 'latha.k@gmail.com',        isPrimary: true },
      { tenantId: tenant.id, studentId: st6.id,  firstName: 'Raju',    lastName: 'Reddy',    relation: 'FATHER', phone: '+91-98765-10006', email: 'raju.reddy@gmail.com',     isPrimary: true },
      { tenantId: tenant.id, studentId: st7.id,  firstName: 'Sunita',  lastName: 'Sharma',   relation: 'MOTHER', phone: '+91-98765-55555', email: 'sunita.sharma@gmail.com',  isPrimary: true, userId: parent2.id },
      { tenantId: tenant.id, studentId: st8.id,  firstName: 'Suresh',  lastName: 'Verma',    relation: 'FATHER', phone: '+91-98765-10008', email: 'suresh.verma@gmail.com',   isPrimary: true },
      { tenantId: tenant.id, studentId: st9.id,  firstName: 'Anil',    lastName: 'Menon',    relation: 'FATHER', phone: '+91-98765-10009', email: 'anil.menon@gmail.com',     isPrimary: true },
      { tenantId: tenant.id, studentId: st10.id, firstName: 'Kavitha', lastName: 'Iyer',     relation: 'MOTHER', phone: '+91-98765-10010', email: 'kavitha.iyer@gmail.com',   isPrimary: true },
    ],
  });

  console.log('✅  Guardians created');

  // ── 11. Attendance (last 10 school weekdays) ─────────────────────────────────
  const students = [st1, st2, st3, st4, st5, st6, st7, st8, st9, st10];
  const studentMeta = {
    [st1.id]:  { classId: class6.id, sectionId: sec6A.id },
    [st2.id]:  { classId: class6.id, sectionId: sec6A.id },
    [st3.id]:  { classId: class6.id, sectionId: sec6A.id },
    [st4.id]:  { classId: class7.id, sectionId: sec7A.id },
    [st5.id]:  { classId: class7.id, sectionId: sec7A.id },
    [st6.id]:  { classId: class7.id, sectionId: sec7A.id },
    [st7.id]:  { classId: class7.id, sectionId: sec7B.id },
    [st8.id]:  { classId: class7.id, sectionId: sec7B.id },
    [st9.id]:  { classId: class8.id, sectionId: sec8A.id },
    [st10.id]: { classId: class8.id, sectionId: sec8A.id },
  };

  // Realistic attendance: mostly PRESENT, a few ABSENT/LATE per student
  const patterns = {
    [st1.id]:  ['PRESENT','PRESENT','PRESENT','PRESENT','LATE',   'PRESENT','PRESENT','PRESENT','PRESENT','PRESENT'],
    [st2.id]:  ['PRESENT','ABSENT', 'PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT'],
    [st3.id]:  ['PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','ABSENT', 'PRESENT','PRESENT','PRESENT','PRESENT'],
    [st4.id]:  ['PRESENT','PRESENT','PRESENT','LATE',   'PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT'],
    [st5.id]:  ['PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','ABSENT', 'PRESENT','PRESENT'],
    [st6.id]:  ['ABSENT', 'ABSENT', 'PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT'],
    [st7.id]:  ['PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','LATE',   'PRESENT','PRESENT','PRESENT'],
    [st8.id]:  ['PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','ABSENT'],
    [st9.id]:  ['PRESENT','PRESENT','ABSENT', 'PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT'],
    [st10.id]: ['PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','PRESENT','LATE',   'PRESENT'],
  };

  const attendanceRows = [];
  for (const st of students) {
    const { classId, sectionId } = studentMeta[st.id];
    for (let i = 0; i < ATTENDANCE_DATES.length; i++) {
      const status = patterns[st.id][i];
      attendanceRows.push({
        tenantId:   tenant.id,
        date:       ATTENDANCE_DATES[i],
        studentId:  st.id,
        classId,
        sectionId,
        status,
        markedById: schoolAdmin.id,
        note: status === 'LATE' ? 'Arrived 15 minutes late' : status === 'ABSENT' ? 'Absent without prior notice' : null,
      });
    }
  }
  await prisma.attendance.createMany({ data: attendanceRows });

  console.log('✅  Attendance records created (10 days × 10 students)');

  // ── 12. Fee Categories & Structures ──────────────────────────────────────────
  const fcTuition = await prisma.feeCategory.create({ data: { tenantId: tenant.id, name: 'Tuition Fee',    description: 'Monthly tuition charges' } });
  const fcLibrary = await prisma.feeCategory.create({ data: { tenantId: tenant.id, name: 'Library Fee',    description: 'Annual library membership' } });
  const fcSports  = await prisma.feeCategory.create({ data: { tenantId: tenant.id, name: 'Sports Fee',     description: 'Annual sports & activities' } });
  const fcDev     = await prisma.feeCategory.create({ data: { tenantId: tenant.id, name: 'Development Fee',description: 'Infrastructure charges' } });

  const AY = '2026-27';

  await prisma.feeStructure.createMany({
    data: [
      { tenantId: tenant.id, feeCategoryId: fcTuition.id, classId: class6.id, amount: 3000, frequency: 'MONTHLY',  academicYear: AY },
      { tenantId: tenant.id, feeCategoryId: fcTuition.id, classId: class7.id, amount: 3500, frequency: 'MONTHLY',  academicYear: AY },
      { tenantId: tenant.id, feeCategoryId: fcTuition.id, classId: class8.id, amount: 4000, frequency: 'MONTHLY',  academicYear: AY },
      { tenantId: tenant.id, feeCategoryId: fcLibrary.id, classId: null,      amount: 1200, frequency: 'ANNUALLY', academicYear: AY },
      { tenantId: tenant.id, feeCategoryId: fcSports.id,  classId: null,      amount: 1500, frequency: 'ANNUALLY', academicYear: AY },
      { tenantId: tenant.id, feeCategoryId: fcDev.id,     classId: null,      amount: 2500, frequency: 'ANNUALLY', academicYear: AY },
    ],
  });

  // ── 13. Fee Payments ─────────────────────────────────────────────────────────
  await prisma.feePayment.createMany({
    data: [
      { tenantId: tenant.id, studentId: st4.id,  feeCategoryId: fcTuition.id, academicYear: AY, amount: 3500, month: 'April 2026', paidAt: new Date('2026-04-10'), method: 'UPI',           referenceNumber: 'UPI20260410-A1', receiptNumber: 'RCP-2026-00001', collectedById: schoolAdmin.id, note: 'April tuition fee' },
      { tenantId: tenant.id, studentId: st4.id,  feeCategoryId: fcLibrary.id, academicYear: AY, amount: 1200,                      paidAt: new Date('2026-04-10'), method: 'UPI',           referenceNumber: 'UPI20260410-A2', receiptNumber: 'RCP-2026-00002', collectedById: schoolAdmin.id, note: 'Annual library fee' },
      { tenantId: tenant.id, studentId: st7.id,  feeCategoryId: fcTuition.id, academicYear: AY, amount: 3500, month: 'April 2026', paidAt: new Date('2026-04-15'), method: 'CASH',                                             receiptNumber: 'RCP-2026-00003', collectedById: schoolAdmin.id, note: 'April tuition fee' },
      { tenantId: tenant.id, studentId: st1.id,  feeCategoryId: fcTuition.id, academicYear: AY, amount: 3000, month: 'May 2026',   paidAt: new Date('2026-05-05'), method: 'BANK_TRANSFER', referenceNumber: 'NEFT20260505-B1',receiptNumber: 'RCP-2026-00004', collectedById: schoolAdmin.id, note: 'May tuition fee' },
      { tenantId: tenant.id, studentId: st4.id,  feeCategoryId: fcTuition.id, academicYear: AY, amount: 3500, month: 'May 2026',   paidAt: new Date('2026-05-10'), method: 'UPI',           referenceNumber: 'UPI20260510-C1', receiptNumber: 'RCP-2026-00005', collectedById: schoolAdmin.id, note: 'May tuition fee' },
      { tenantId: tenant.id, studentId: st9.id,  feeCategoryId: fcDev.id,     academicYear: AY, amount: 2500,                      paidAt: new Date('2026-05-18'), method: 'CHEQUE',        referenceNumber: 'CHQ-104521',     receiptNumber: 'RCP-2026-00006', collectedById: schoolAdmin.id, note: 'Annual development fee' },
      // Rohan Mathew — clear all annual fees so his portal has full access (used as the "cleared dues" demo account)
      { tenantId: tenant.id, studentId: st4.id,  feeCategoryId: fcSports.id,  academicYear: AY, amount: 1500,                      paidAt: new Date('2026-04-12'), method: 'UPI',           referenceNumber: 'UPI20260412-A3', receiptNumber: 'RCP-2026-00007', collectedById: schoolAdmin.id, note: 'Annual sports fee' },
      { tenantId: tenant.id, studentId: st4.id,  feeCategoryId: fcDev.id,     academicYear: AY, amount: 2500,                      paidAt: new Date('2026-04-12'), method: 'UPI',           referenceNumber: 'UPI20260412-A4', receiptNumber: 'RCP-2026-00008', collectedById: schoolAdmin.id, note: 'Annual development fee' },
    ],
  });

  console.log('✅  Fee categories, structures & 6 payments created');

  // ── 14. Announcements ────────────────────────────────────────────────────────
  await prisma.announcement.createMany({
    data: [
      {
        tenantId: tenant.id,
        title: 'Annual Sports Day — Save the Date! 🏆',
        body: "We are delighted to announce that St. Mary's Academy's Annual Sports Day will be held on Saturday, 14th June 2026 at our school grounds. All students are expected to participate. Parents are cordially invited to attend and cheer for their wards. Detailed event schedule will be shared next week.",
        type: 'EVENT',
        targetRoles: ['STUDENT', 'PARENT', 'TEACHER'],
        isPinned: true,
        publishedAt: new Date('2026-05-20'),
        createdById: schoolAdmin.id,
      },
      {
        tenantId: tenant.id,
        title: 'Parent-Teacher Meeting — Classes 7 & 8',
        body: 'Parent-Teacher Meetings for Class 7 and Class 8 are scheduled on Saturday, 31st May 2026 from 9:00 AM to 1:00 PM. Parents are requested to collect their children\'s Unit Test 1 progress report. Prior time-slot booking via the school office is mandatory.',
        type: 'CIRCULAR',
        targetRoles: ['PARENT', 'TEACHER'],
        isPinned: false,
        publishedAt: new Date('2026-05-18'),
        createdById: schoolAdmin.id,
      },
      {
        tenantId: tenant.id,
        title: 'Library Book Return — Final Notice ⚠️',
        body: 'All students are reminded to return library books borrowed during Term 1. Last date for return: 28th May 2026. Late returns attract a fine of ₹10/day per book. Students with pending books will not be issued new books for Term 2.',
        type: 'ALERT',
        targetRoles: ['STUDENT', 'PARENT'],
        isPinned: false,
        publishedAt: new Date('2026-05-15'),
        createdById: schoolAdmin.id,
      },
      {
        tenantId: tenant.id,
        title: 'Mid-Term Examination Schedule Released',
        body: 'Mid-Term Examinations for all classes will commence from 9th June 2026. The detailed timetable is now available on the school portal. Students are advised to revise all chapters covered from April to May 2026. All the best!',
        type: 'ANNOUNCEMENT',
        targetRoles: ['STUDENT', 'PARENT', 'TEACHER'],
        isPinned: false,
        publishedAt: new Date('2026-05-12'),
        createdById: schoolAdmin.id,
      },
    ],
  });

  console.log('✅  Announcements created (1 pinned event + 3 others)');

  // ── 15. Exams ────────────────────────────────────────────────────────────────
  const exam7UT1 = await prisma.exam.create({ data: { tenantId: tenant.id, name: 'Unit Test 1', classId: class7.id, academicYear: AY, startDate: new Date('2026-05-05'), endDate: new Date('2026-05-07'), maxMarks: 25, passingMarks: 40, status: 'COMPLETED' } });
  const exam7Mid = await prisma.exam.create({ data: { tenantId: tenant.id, name: 'Mid-Term Examination', classId: class7.id, academicYear: AY, startDate: new Date('2026-06-09'), endDate: new Date('2026-06-14'), maxMarks: 100, passingMarks: 35, status: 'SCHEDULED' } });
  const exam8UT1 = await prisma.exam.create({ data: { tenantId: tenant.id, name: 'Unit Test 1', classId: class8.id, academicYear: AY, startDate: new Date('2026-05-06'), endDate: new Date('2026-05-08'), maxMarks: 25, passingMarks: 40, status: 'COMPLETED' } });

  // ── 16. Exam Results — Unit Test 1 ──────────────────────────────────────────
  await prisma.examResult.createMany({
    data: [
      // Class 7A — Rohan Mathew
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st4.id, subjectId: s7Math.id, marksObtained: 22, grade: 'A+', isAbsent: false },
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st4.id, subjectId: s7Eng.id,  marksObtained: 21, grade: 'A',  isAbsent: false },
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st4.id, subjectId: s7Sci.id,  marksObtained: 20, grade: 'A',  isAbsent: false },
      // Class 7A — Ananya Krishnan (top scorer)
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st5.id, subjectId: s7Math.id, marksObtained: 24, grade: 'A+', isAbsent: false },
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st5.id, subjectId: s7Eng.id,  marksObtained: 23, grade: 'A+', isAbsent: false },
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st5.id, subjectId: s7Sci.id,  marksObtained: 22, grade: 'A+', isAbsent: false },
      // Class 7A — Vikram Reddy (needs improvement)
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st6.id, subjectId: s7Math.id, marksObtained: 15, grade: 'C',  isAbsent: false },
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st6.id, subjectId: s7Eng.id,  marksObtained: 18, grade: 'B',  isAbsent: false },
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st6.id, subjectId: s7Sci.id,  marksObtained: 16, grade: 'C+', isAbsent: false },
      // Class 7B — Pooja Sharma
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st7.id, subjectId: s7Math.id, marksObtained: 20, grade: 'A',  isAbsent: false },
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st7.id, subjectId: s7Eng.id,  marksObtained: 22, grade: 'A+', isAbsent: false },
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st7.id, subjectId: s7Sci.id,  marksObtained: 19, grade: 'A',  isAbsent: false },
      // Class 7B — Aditya Verma (absent in Science)
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st8.id, subjectId: s7Math.id, marksObtained: 17,   grade: 'B',  isAbsent: false },
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st8.id, subjectId: s7Eng.id,  marksObtained: 16,   grade: 'B',  isAbsent: false },
      { tenantId: tenant.id, examId: exam7UT1.id, studentId: st8.id, subjectId: s7Sci.id,  marksObtained: null, grade: null, isAbsent: true,  remarks: 'Absent during exam' },
      // Class 8A — Unit Test 1
      { tenantId: tenant.id, examId: exam8UT1.id, studentId: st9.id,  subjectId: s8Math.id, marksObtained: 23, grade: 'A+', isAbsent: false },
      { tenantId: tenant.id, examId: exam8UT1.id, studentId: st9.id,  subjectId: s8Eng.id,  marksObtained: 21, grade: 'A',  isAbsent: false },
      { tenantId: tenant.id, examId: exam8UT1.id, studentId: st9.id,  subjectId: s8Sci.id,  marksObtained: 22, grade: 'A+', isAbsent: false },
      { tenantId: tenant.id, examId: exam8UT1.id, studentId: st10.id, subjectId: s8Math.id, marksObtained: 19, grade: 'A',  isAbsent: false },
      { tenantId: tenant.id, examId: exam8UT1.id, studentId: st10.id, subjectId: s8Eng.id,  marksObtained: 18, grade: 'B+', isAbsent: false },
      { tenantId: tenant.id, examId: exam8UT1.id, studentId: st10.id, subjectId: s8Sci.id,  marksObtained: 20, grade: 'A',  isAbsent: false },
    ],
  });

  console.log('✅  Exams & results created (Unit Test 1 completed, Mid-Term scheduled)');

  // ── 17. Timetable — Class 7A, Full Week ─────────────────────────────────────
  const ttRows = [
    // Monday
    { day: 'MONDAY',    p: 1, s: '08:00', e: '08:45', subj: s7Math, teacher: teacher1 },
    { day: 'MONDAY',    p: 2, s: '08:45', e: '09:30', subj: s7Eng,  teacher: teacher2 },
    { day: 'MONDAY',    p: 3, s: '09:30', e: '10:15', subj: s7Sci,  teacher: teacher3 },
    { day: 'MONDAY',    p: 4, s: '10:15', e: '10:30', isBreak: true, label: 'Short Break' },
    { day: 'MONDAY',    p: 5, s: '10:30', e: '11:15', subj: s7SS,   teacher: teacher2 },
    { day: 'MONDAY',    p: 6, s: '11:15', e: '12:00', subj: s7CS,   teacher: teacher3 },
    // Tuesday
    { day: 'TUESDAY',   p: 1, s: '08:00', e: '08:45', subj: s7Eng,  teacher: teacher2 },
    { day: 'TUESDAY',   p: 2, s: '08:45', e: '09:30', subj: s7Math, teacher: teacher1 },
    { day: 'TUESDAY',   p: 3, s: '09:30', e: '10:15', subj: s7SS,   teacher: teacher2 },
    { day: 'TUESDAY',   p: 4, s: '10:15', e: '10:30', isBreak: true, label: 'Short Break' },
    { day: 'TUESDAY',   p: 5, s: '10:30', e: '11:15', subj: s7Sci,  teacher: teacher3 },
    { day: 'TUESDAY',   p: 6, s: '11:15', e: '12:00', subj: s7Math, teacher: teacher1 },
    // Wednesday
    { day: 'WEDNESDAY', p: 1, s: '08:00', e: '08:45', subj: s7Sci,  teacher: teacher3 },
    { day: 'WEDNESDAY', p: 2, s: '08:45', e: '09:30', subj: s7CS,   teacher: teacher3 },
    { day: 'WEDNESDAY', p: 3, s: '09:30', e: '10:15', subj: s7Math, teacher: teacher1 },
    { day: 'WEDNESDAY', p: 4, s: '10:15', e: '10:30', isBreak: true, label: 'Short Break' },
    { day: 'WEDNESDAY', p: 5, s: '10:30', e: '11:15', subj: s7Eng,  teacher: teacher2 },
    { day: 'WEDNESDAY', p: 6, s: '11:15', e: '12:00', subj: s7SS,   teacher: teacher2 },
    // Thursday
    { day: 'THURSDAY',  p: 1, s: '08:00', e: '08:45', subj: s7Math, teacher: teacher1 },
    { day: 'THURSDAY',  p: 2, s: '08:45', e: '09:30', subj: s7Sci,  teacher: teacher3 },
    { day: 'THURSDAY',  p: 3, s: '09:30', e: '10:15', subj: s7Eng,  teacher: teacher2 },
    { day: 'THURSDAY',  p: 4, s: '10:15', e: '10:30', isBreak: true, label: 'Short Break' },
    { day: 'THURSDAY',  p: 5, s: '10:30', e: '11:15', subj: s7CS,   teacher: teacher3 },
    { day: 'THURSDAY',  p: 6, s: '11:15', e: '12:00', subj: s7SS,   teacher: teacher2 },
    // Friday
    { day: 'FRIDAY',    p: 1, s: '08:00', e: '08:45', subj: s7Sci,  teacher: teacher3 },
    { day: 'FRIDAY',    p: 2, s: '08:45', e: '09:30', subj: s7Eng,  teacher: teacher2 },
    { day: 'FRIDAY',    p: 3, s: '09:30', e: '10:15', subj: s7Math, teacher: teacher1 },
    { day: 'FRIDAY',    p: 4, s: '10:15', e: '10:30', isBreak: true, label: 'Short Break' },
    { day: 'FRIDAY',    p: 5, s: '10:30', e: '11:15', subj: s7SS,   teacher: teacher2 },
    { day: 'FRIDAY',    p: 6, s: '11:15', e: '12:00', subj: s7CS,   teacher: teacher3 },
  ];

  await prisma.period.createMany({
    data: ttRows.map(r => ({
      tenantId:     tenant.id,
      classId:      class7.id,
      academicYear: AY,
      dayOfWeek:    r.day,
      periodNumber: r.p,
      startTime:    r.s,
      endTime:      r.e,
      subjectId:    r.subj?.id ?? null,
      teacherId:    r.teacher?.id ?? null,
      isBreak:      r.isBreak ?? false,
      breakLabel:   r.label ?? null,
    })),
  });

  console.log('✅  Timetable created (Class 7A, Mon–Fri, 6 periods/day)');

  // ── 18. Homework ─────────────────────────────────────────────────────────────
  await prisma.homework.createMany({
    data: [
      { tenantId: tenant.id, teacherId: teacher1.id, classId: class7.id, subjectId: s7Math.id, title: 'Chapter 5 Exercise — Algebraic Expressions',    description: 'Complete Ex. 5.1–5.4 in your Maths textbook. Show full working for every problem.', dueDate: new Date('2026-05-23'), createdAt: new Date('2026-05-21') },
      { tenantId: tenant.id, teacherId: teacher2.id, classId: class7.id, subjectId: s7Eng.id,  title: 'Essay Writing — My Role Model',                  description: 'Write a 300-word essay on "My Role Model". Use proper essay structure (introduction, body, conclusion).', dueDate: new Date('2026-05-26'), createdAt: new Date('2026-05-20') },
      { tenantId: tenant.id, teacherId: teacher3.id, classId: class7.id, subjectId: s7Sci.id,  title: 'Draw & Label — Plant Cell vs Animal Cell',        description: 'Draw well-labelled diagrams of both a plant cell and an animal cell. Highlight at least 8 organelles in each.', dueDate: new Date('2026-05-28'), createdAt: new Date('2026-05-19') },
      { tenantId: tenant.id, teacherId: teacher1.id, classId: class8.id, subjectId: s8Math.id, title: 'Chapter 3 Practice — Linear Equations',           description: 'Complete problems 1–20 from Ex. 3.3. Problems marked (*) are mandatory.', dueDate: new Date('2026-05-25'), createdAt: new Date('2026-05-21') },
    ],
  });

  console.log('✅  Homework created (3 for Class 7, 1 for Class 8)');

  // ── 19. LMS Materials ────────────────────────────────────────────────────────
  // Mathematics Class 7
  await prisma.lmsMaterial.create({ data: { tenantId: tenant.id, subjectId: s7Math.id, title: 'Chapter 1: Integers — Introduction & Number Line', description: 'Positive/negative integers, absolute value, operations on integers.', sequence: 10, educationalLinks: [{ title: 'Khan Academy — Integers', url: 'https://www.khanacademy.org/math/cc-sixth-grade-math/cc-6th-factors-and-multiples' }] } });
  await prisma.lmsMaterial.create({ data: { tenantId: tenant.id, subjectId: s7Math.id, title: 'Chapter 2: Fractions & Decimals', description: 'Multiplication and division of fractions, conversion between fractions and decimals.', sequence: 20, educationalLinks: [{ title: 'NCERT Chapter PDF', url: 'https://ncert.nic.in/textbook/pdf/gemh102.pdf' }] } });
  await prisma.lmsMaterial.create({ data: { tenantId: tenant.id, subjectId: s7Math.id, title: 'Chapter 5: Lines & Angles', description: 'Pairs of angles, transversals, parallel lines, triangle properties.', sequence: 50, educationalLinks: [{ title: 'Khan Academy — Angles', url: 'https://www.khanacademy.org/math/basic-geo/basic-geo-angle' }, { title: 'NCERT Solutions', url: 'https://www.ncert.nic.in' }] } });

  // Science Class 7
  await prisma.lmsMaterial.create({ data: { tenantId: tenant.id, subjectId: s7Sci.id, title: 'Chapter 1: Nutrition in Plants', description: 'Photosynthesis, modes of nutrition in plants, role of chlorophyll.', sequence: 10, educationalLinks: [{ title: 'NCERT Science Ch. 1', url: 'https://ncert.nic.in/textbook/pdf/gesc101.pdf' }] } });
  await prisma.lmsMaterial.create({ data: { tenantId: tenant.id, subjectId: s7Sci.id, title: 'Chapter 2: Nutrition in Animals', description: 'Digestion in humans and animals, different types of teeth, the digestive system.', sequence: 20, educationalLinks: [{ title: 'Digestive System Video', url: 'https://www.youtube.com/watch?v=Og5gWly1RDI' }] } });

  // English Class 7
  await prisma.lmsMaterial.create({ data: { tenantId: tenant.id, subjectId: s7Eng.id, title: 'Unit 1: The Tiny Teacher — Comprehension & Grammar', description: 'Reading comprehension. Grammar focus: Nouns, Pronouns, Subject-Verb agreement.', sequence: 10, educationalLinks: [{ title: 'Honeycomb NCERT Chapter', url: 'https://ncert.nic.in/textbook/pdf/gehu101.pdf' }] } });
  await prisma.lmsMaterial.create({ data: { tenantId: tenant.id, subjectId: s7Eng.id, title: 'Unit 2: Writing Skills — Formal Letters', description: 'Format and structure of formal letters. Practice: write a letter to the principal requesting leave.', sequence: 20 } });

  console.log('✅  LMS materials created (Maths ×3, Science ×2, English ×2)');

  // ── 20. Notifications ────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { tenantId: tenant.id, userId: parent1.id, title: 'Attendance Alert',              body: 'Rohan Mathew was marked LATE on 19 May 2026.',                                             type: 'ATTENDANCE', isRead: false, createdAt: new Date('2026-05-19') },
      { tenantId: tenant.id, userId: parent1.id, title: 'Unit Test 1 Results Published', body: 'Unit Test 1 results for Rohan Mathew are available. Check the Exam Results section.',       type: 'EXAM',       isRead: true,  readAt: new Date('2026-05-10'), createdAt: new Date('2026-05-09') },
      { tenantId: tenant.id, userId: parent2.id, title: 'Fee Payment Reminder',          body: 'May 2026 tuition fee for Pooja Sharma is due. Please pay before 31 May 2026.',              type: 'FEE',        isRead: false, createdAt: new Date('2026-05-15') },
    ],
  });

  console.log('✅  Notifications created');

  // ── 21. Transport (bus routes, stops & student assignment) ───────────────────
  const route1 = await prisma.busRoute.create({
    data: {
      tenantId: tenant.id, name: 'Route 1 — City Centre', routeNumber: 'R1', busNumber: 'KL-07-AX-1234',
      driverName: 'Ramesh Pillai', driverPhone: '+91-98470-22001', capacity: 40,
      notes: 'Covers the central and east residential zones.',
      lastLat: 9.9312, lastLng: 76.2673, lastLocationAt: new Date('2026-05-20T08:05:00'),
    },
  });
  const route2 = await prisma.busRoute.create({
    data: {
      tenantId: tenant.id, name: 'Route 2 — North Suburb', routeNumber: 'R2', busNumber: 'KL-07-AX-5678',
      driverName: 'Joseph Kurian', driverPhone: '+91-98470-22002', capacity: 35,
      notes: 'Covers the northern suburbs and the highway stops.',
      lastLat: 10.0159, lastLng: 76.3419, lastLocationAt: new Date('2026-05-20T07:55:00'),
    },
  });
  await prisma.routeStop.createMany({
    data: [
      { tenantId: tenant.id, routeId: route1.id, name: 'MG Road Junction',   sequence: 1, pickupTime: '07:30', dropTime: '15:45', lat: 9.9816, lng: 76.2999 },
      { tenantId: tenant.id, routeId: route1.id, name: 'Marine Drive',        sequence: 2, pickupTime: '07:45', dropTime: '15:30', lat: 9.9780, lng: 76.2760 },
      { tenantId: tenant.id, routeId: route1.id, name: 'St. Mary\'s Academy', sequence: 3, pickupTime: '08:15', dropTime: '15:10', lat: 9.9312, lng: 76.2673 },
      { tenantId: tenant.id, routeId: route2.id, name: 'Edappally Toll',      sequence: 1, pickupTime: '07:20', dropTime: '15:50', lat: 10.0250, lng: 76.3080 },
      { tenantId: tenant.id, routeId: route2.id, name: 'Palarivattom',        sequence: 2, pickupTime: '07:40', dropTime: '15:35', lat: 10.0064, lng: 76.3060 },
      { tenantId: tenant.id, routeId: route2.id, name: 'St. Mary\'s Academy', sequence: 3, pickupTime: '08:15', dropTime: '15:10', lat: 9.9312, lng: 76.2673 },
    ],
  });
  await prisma.student.update({ where: { id: st1.id },  data: { needsBus: true, busRouteId: route1.id, boardingPoint: 'MG Road Junction' } });
  await prisma.student.update({ where: { id: st4.id },  data: { needsBus: true, busRouteId: route1.id, boardingPoint: 'Marine Drive' } });
  await prisma.student.update({ where: { id: st7.id },  data: { needsBus: true, busRouteId: route2.id, boardingPoint: 'Edappally Toll' } });
  await prisma.student.update({ where: { id: st9.id },  data: { needsBus: true, busRouteId: route2.id, boardingPoint: 'Palarivattom' } });
  console.log('✅  Transport created (2 routes, 6 stops, 4 students assigned)');

  // ── 22. Hostel (building, rooms, allotments, mess, gate-pass, complaint) ──────
  const hostel = await prisma.hostel.create({
    data: {
      tenantId: tenant.id, name: 'Boys Hostel — Block A', type: 'BOYS',
      wardenName: 'Mr. George Thomas', wardenPhone: '+91-98470-33001',
      address: 'Campus North Wing, St. Mary\'s Academy', notes: 'Capacity 60 students across 3 floors.',
    },
  });
  const room101 = await prisma.hostelRoom.create({ data: { tenantId: tenant.id, hostelId: hostel.id, roomNumber: '101', floor: 'Ground', capacity: 3 } });
  const room102 = await prisma.hostelRoom.create({ data: { tenantId: tenant.id, hostelId: hostel.id, roomNumber: '102', floor: 'Ground', capacity: 3 } });
  const room201 = await prisma.hostelRoom.create({ data: { tenantId: tenant.id, hostelId: hostel.id, roomNumber: '201', floor: 'First',  capacity: 2 } });
  await prisma.hostelAllotment.create({ data: { tenantId: tenant.id, hostelId: hostel.id, roomId: room101.id, studentId: st1.id,  bedLabel: 'Bed A' } });
  await prisma.hostelAllotment.create({ data: { tenantId: tenant.id, hostelId: hostel.id, roomId: room101.id, studentId: st4.id,  bedLabel: 'Bed B' } });
  await prisma.hostelAllotment.create({ data: { tenantId: tenant.id, hostelId: hostel.id, roomId: room201.id, studentId: st9.id,  bedLabel: 'Bed A' } });
  await prisma.messMenu.createMany({
    data: [
      { tenantId: tenant.id, hostelId: hostel.id, dayOfWeek: 1, meal: 'BREAKFAST', items: 'Idli, Sambar, Coconut Chutney, Banana', time: '07:30' },
      { tenantId: tenant.id, hostelId: hostel.id, dayOfWeek: 1, meal: 'LUNCH',     items: 'Rice, Dal, Mixed Vegetable Curry, Curd, Pickle', time: '12:45' },
      { tenantId: tenant.id, hostelId: hostel.id, dayOfWeek: 1, meal: 'DINNER',    items: 'Chapati, Paneer Butter Masala, Rice, Salad', time: '19:30' },
      { tenantId: tenant.id, hostelId: hostel.id, dayOfWeek: 2, meal: 'BREAKFAST', items: 'Dosa, Tomato Chutney, Sambar', time: '07:30' },
      { tenantId: tenant.id, hostelId: hostel.id, dayOfWeek: 2, meal: 'LUNCH',     items: 'Veg Biryani, Raita, Boiled Egg, Papad', time: '12:45' },
      { tenantId: tenant.id, hostelId: hostel.id, dayOfWeek: 2, meal: 'DINNER',    items: 'Rice, Rasam, Cabbage Thoran, Curd', time: '19:30' },
    ],
  });
  await prisma.gatePass.create({
    data: {
      tenantId: tenant.id, studentId: st1.id, reason: 'Weekend home visit', destination: 'Kochi',
      fromDate: new Date('2026-05-23T16:00:00'), toDate: new Date('2026-05-25T18:00:00'),
      status: 'APPROVED', reviewedById: schoolAdmin.id, reviewedAt: new Date('2026-05-22T10:00:00'),
    },
  });
  await prisma.gatePass.create({
    data: {
      tenantId: tenant.id, studentId: st9.id, reason: 'Doctor appointment', destination: 'City Hospital',
      fromDate: new Date('2026-05-26T09:00:00'), toDate: new Date('2026-05-26T13:00:00'), status: 'PENDING',
    },
  });
  await prisma.hostelComplaint.create({
    data: {
      tenantId: tenant.id, studentId: st4.id, category: 'Maintenance', title: 'Ceiling fan not working in Room 101',
      description: 'The fan has been making noise and stopped working since yesterday.', status: 'IN_PROGRESS',
    },
  });
  console.log('✅  Hostel created (1 block, 3 rooms, 3 allotments, mess menu, gate-passes, complaint)');

  // ── 23. Library (books + an active issue) ────────────────────────────────────
  const book1 = await prisma.libraryBook.create({ data: { tenantId: tenant.id, title: 'The Jungle Book',                author: 'Rudyard Kipling', isbn: '9780141325293', category: 'Fiction',     readingLevel: 'Class 6-8', totalCopies: 4, availableCopies: 3 } });
  const book2 = await prisma.libraryBook.create({ data: { tenantId: tenant.id, title: 'A Brief History of Time',        author: 'Stephen Hawking', isbn: '9780553380163', category: 'Science',     readingLevel: 'Class 8+',  totalCopies: 2, availableCopies: 2 } });
  await prisma.libraryBook.create({ data: { tenantId: tenant.id, title: 'Wings of Fire',                  author: 'A.P.J. Abdul Kalam', isbn: '9788173711466', category: 'Biography',   readingLevel: 'Class 7+',  totalCopies: 3, availableCopies: 3 } });
  await prisma.libraryBook.create({ data: { tenantId: tenant.id, title: 'Matilda',                         author: 'Roald Dahl',      isbn: '9780142410370', category: 'Fiction',     readingLevel: 'Class 5-7', totalCopies: 5, availableCopies: 5 } });
  await prisma.libraryBook.create({ data: { tenantId: tenant.id, title: 'NCERT Atlas of India',            author: 'NCERT',           isbn: '9788174504760', category: 'Reference',   readingLevel: 'All',       totalCopies: 6, availableCopies: 6 } });
  await prisma.bookIssue.create({
    data: {
      tenantId: tenant.id, bookId: book1.id, studentId: st4.id, issuedById: schoolAdmin.id,
      issuedAt: new Date('2026-05-12'), dueDate: new Date('2026-05-26'),
    },
  });
  console.log('✅  Library created (5 books, 1 active issue)');

  // ── 24. Store / Purchases ────────────────────────────────────────────────────
  const itemUniform = await prisma.storeItem.create({ data: { tenantId: tenant.id, name: 'School Uniform Set',     category: 'UNIFORM',   price: 1200, description: 'Shirt, trousers/skirt and tie.' } });
  const itemShoes   = await prisma.storeItem.create({ data: { tenantId: tenant.id, name: 'Black School Shoes',     category: 'UNIFORM',   price: 850,  description: 'Standard black leather shoes.' } });
  const itemBooks   = await prisma.storeItem.create({ data: { tenantId: tenant.id, name: 'Class 7 Textbook Bundle', category: 'BOOKS',     price: 2400, description: 'Full set of NCERT textbooks for Class 7.' } });
  await prisma.storeItem.create({ data: { tenantId: tenant.id, name: 'Stationery Kit',          category: 'MATERIALS', price: 350,  description: 'Notebooks, pens, geometry box.' } });
  await prisma.purchase.create({ data: { tenantId: tenant.id, studentId: st4.id, storeItemId: itemUniform.id, itemName: 'School Uniform Set',      category: 'UNIFORM', quantity: 2, amount: 2400, recordedById: schoolAdmin.id, purchasedAt: new Date('2026-04-05') } });
  await prisma.purchase.create({ data: { tenantId: tenant.id, studentId: st4.id, storeItemId: itemBooks.id,   itemName: 'Class 7 Textbook Bundle', category: 'BOOKS',   quantity: 1, amount: 2400, recordedById: schoolAdmin.id, purchasedAt: new Date('2026-04-05') } });
  await prisma.purchase.create({ data: { tenantId: tenant.id, studentId: st7.id, storeItemId: itemShoes.id,   itemName: 'Black School Shoes',      category: 'UNIFORM', quantity: 1, amount: 850,  recordedById: schoolAdmin.id, purchasedAt: new Date('2026-04-10') } });
  console.log('✅  Store created (4 items, 3 purchases)');

  // ── 25. Events (with photo & video media) ────────────────────────────────────
  const event1 = await prisma.schoolEvent.create({
    data: {
      tenantId: tenant.id, title: 'Annual Sports Day 2026', createdById: schoolAdmin.id,
      description: 'A day of athletics, team games and the inter-house championship.',
      eventDate: new Date('2026-05-10T08:00:00'), location: 'School Grounds',
    },
  });
  const event2 = await prisma.schoolEvent.create({
    data: {
      tenantId: tenant.id, title: 'Science Exhibition', createdById: schoolAdmin.id, classId: class7.id,
      description: 'Class 7 students present working models and experiments.',
      eventDate: new Date('2026-04-28T09:30:00'), location: 'School Auditorium',
    },
  });
  const event3 = await prisma.schoolEvent.create({
    data: {
      tenantId: tenant.id, title: 'Independence Day Celebration', createdById: schoolAdmin.id,
      description: 'Flag hoisting, cultural performances and prize distribution.',
      eventDate: new Date('2026-08-15T07:30:00'), location: 'School Quadrangle',
    },
  });
  await prisma.eventMedia.createMany({
    data: [
      { tenantId: tenant.id, eventId: event1.id, type: 'PHOTO',   url: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200', caption: 'The 100m sprint final' },
      { tenantId: tenant.id, eventId: event1.id, type: 'PHOTO',   url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200', caption: 'House march-past' },
      { tenantId: tenant.id, eventId: event1.id, type: 'YOUTUBE', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', caption: 'Sports Day highlights reel' },
      { tenantId: tenant.id, eventId: event2.id, type: 'PHOTO',   url: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=1200', caption: 'Working volcano model' },
      { tenantId: tenant.id, eventId: event2.id, type: 'PHOTO',   url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=1200', caption: 'Robotics demonstration' },
    ],
  });
  console.log('✅  Events created (3 events, 5 media items)');

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log("║          ST. MARY'S ACADEMY — DEMO SEED COMPLETE 🎉              ║");
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  ROLE            EMAIL                         PASSWORD          ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  AIPSA Super Admin  admin@aipsa.org            AipsaAdmin@2024   ║');
  console.log('║  School Admin       admin@stmarys.edu          Admin@1234        ║');
  console.log('║  Teacher            sarah.thomas@stmarys.edu   Teacher@1234      ║');
  console.log('║  Teacher            raj.kumar@stmarys.edu      Teacher@1234      ║');
  console.log('║  Teacher            priya.nair@stmarys.edu     Teacher@1234      ║');
  console.log('║  Parent             davidmathew@gmail.com      Parent@1234       ║');
  console.log('║  Parent             sunitasharma@gmail.com     Parent@1234       ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  STUDENT PORTAL PINs (for parent link demo)                      ║');
  console.log('║  Rohan Mathew  ADM-2026-0004  PIN: 100004  [linked to David]     ║');
  console.log('║  Pooja Sharma  ADM-2026-0007  PIN: 100007  [linked to Sunita]    ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  Teacher/Parent Join Code (school): STMA-DEMO                    ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  STUDENT CLASS JOIN CODES (use at /student-join)                 ║');
  console.log('║  Class 6 → CL6A-DEMO                                             ║');
  console.log('║  Class 7 → CL7A-DEMO                                             ║');
  console.log('║  Class 8 → CL8A-DEMO                                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
}

main()
  .catch((e) => { console.error('❌  Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
