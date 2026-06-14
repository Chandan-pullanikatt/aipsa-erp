/**
 * Generates per-role onboarding guides for AIPSA ERP as print-ready HTML.
 *
 *   node docs/onboarding/generate-onboarding.js
 *
 * Output: one .html file per role in this folder. Open each in a browser and use
 * Ctrl/Cmd + P → "Save as PDF" to produce the handout. The HTML is the editable
 * source — change BRAND below or the steps, then re-run to regenerate.
 */
const fs = require('fs');
const path = require('path');

const BRAND = {
  product: 'AIPSA School ERP',
  tagline: 'School ERP + Learning Management System',
  color: '#1d4ed8',
  support: 'support@aipsa.org',
};

/** Each guide: title, who it's for, an intro, and ordered sections of steps. */
const GUIDES = {
  admin: {
    role: 'School Administrator',
    intro:
      'As the School Administrator you set up the school and everything inside it. Follow the steps in order — each step depends on the one before it (you cannot add students before classes exist).',
    sections: [
      ['1. Create your school account', [
        'Go to the AIPSA sign-up page and choose "Register a School".',
        'Enter your school name, your name, email and a password. This makes you the School Admin.',
        'Log in. You land on the School Dashboard with the module menu on the left.',
        'Open School → Profile and complete the school details (address, logo, contact).',
      ]],
      ['2. Build the academic structure (do this first)', [
        'Go to School → Students area → Classes. Add each class (e.g. Class 6, 7, 8).',
        'For every class, add its Sections (A, B, …).',
        'Go to Curriculum / Subjects. Add subjects for each class.',
        'You will assign a teacher to each subject in step 4 — leave it for now if no teachers yet.',
      ]],
      ['3. Invite teachers & staff', [
        'Go to School → Staff → Invite. Enter each teacher/staff email and send the invite.',
        'They receive an email link to set their own password (Accept Invite).',
        'Alternatively, share the School Join Code (School → Staff or Join Code) so they can self-join.',
      ]],
      ['4. Assign teachers to subjects', [
        'Return to Subjects and set the teacher for each subject from the dropdown.',
        'This is what makes attendance, marks and LMS appear in each teacher\'s portal.',
      ]],
      ['5. Add students & guardians', [
        'Go to School → Students → Add Student. Pick the class and section.',
        'Add the student\'s Guardian (parent) details — this generates a portal PIN.',
        'Share each student\'s Class Join Code + portal PIN so students and parents can log in.',
      ]],
      ['6. Turn on the day-to-day modules', [
        'Fees: create fee categories → fee structures per class. Record payments and view due/defaulter reports.',
        'Timetable: build periods per class; conflicts are flagged automatically.',
        'Exams: create exams → enter marks per subject → generate report cards.',
        'Communication: post announcements; parents/teachers get notifications.',
      ]],
      ['7. Optional modules', [
        'Transport: add bus routes, stops, and assign students to a route.',
        'Hostel: add a hostel block, rooms, and allot students; set the mess menu.',
        'Library: add books; issue and return them; collect fines.',
        'Events: create events and upload photos/videos for students & parents to see.',
        'Store: add purchasable items and record student purchases.',
      ]],
    ],
  },

  teacher: {
    role: 'Teacher',
    intro:
      'As a Teacher you mark attendance, enter marks, set homework and share learning material for your assigned classes.',
    sections: [
      ['1. Get into your account', [
        'Open the invite email from your school and click the link to set your password (Accept Invite).',
        'No email? Ask your admin for the School Join Code and use "Join a School".',
        'Log in — you land on the Teacher Dashboard.',
      ]],
      ['2. Daily attendance', [
        'Go to Attendance, pick your class/section and the date.',
        'Mark each student Present / Absent / Late and save. Parents are notified of absences.',
      ]],
      ['3. Marks & report cards', [
        'Go to Marks, choose the exam and your subject.',
        'Enter each student\'s marks and save. The admin compiles report cards from these.',
      ]],
      ['4. Homework', [
        'Go to Homework → Add. Choose the class, write the task and due date.',
        'Students submit online; open the homework to view and grade submissions.',
      ]],
      ['5. Learning material (LMS)', [
        'Go to LMS, pick your subject and add material — notes, useful links or video lessons.',
        'Students see it in their LMS and you can track their progress.',
      ]],
      ['6. Other', [
        'Timetable shows your weekly periods.',
        'Join Requests: approve students requesting to join your class (if enabled).',
      ]],
    ],
  },

  parent: {
    role: 'Parent / Guardian',
    intro:
      'As a Parent you follow your child\'s attendance, results, fees and school life from one place.',
    sections: [
      ['1. Link to your child', [
        'Use the School Join Code from the school with "Join a School", or the direct link they sent.',
        'Enter your child\'s admission number and portal PIN (given by the school) to link them.',
        'Set your password and log in to the Parent Dashboard. Multiple children show under one login.',
      ]],
      ['2. What you can see', [
        'Attendance: daily status and absence alerts.',
        'Exam Results: marks and the full report card.',
        'Fees: dues, payment history and reminders.',
        'Remarks & Activities: teacher notes about your child.',
      ]],
      ['3. School life', [
        'Events: photos and videos from school events your child took part in.',
        'Transport: your child\'s bus route, stops and timings.',
        'Hostel: room, mess menu, gate-passes (for boarders).',
        'Library: books currently issued. Purchases: items bought from the school store.',
      ]],
      ['4. Notifications', [
        'The bell icon shows alerts for attendance, results and fee reminders.',
      ]],
    ],
  },

  student: {
    role: 'Student',
    intro:
      'As a Student you reach your lessons, homework, results and school life from your dashboard.',
    sections: [
      ['1. Join your class', [
        'Open the Student Join page (student-join).',
        'Enter the Class Join Code from your teacher and your portal PIN.',
        'Set your password and log in to the Student Dashboard.',
      ]],
      ['2. Learn', [
        'LMS: open your subjects to read notes, follow links and watch video lessons. Your progress is saved.',
        'Homework: see assigned work, submit it online before the due date, and view your grade.',
        'Timetable: your weekly class schedule.',
      ]],
      ['3. Track yourself', [
        'Exam Results: your marks and report card.',
        'Attendance: your present/absent record.',
      ]],
      ['4. School life', [
        'Events: photos and videos from school events.',
        'Library: books you have issued. Transport: your bus route and timings.',
        'Hostel: your room and mess menu (boarders). Purchases: items bought from the store.',
      ]],
    ],
  },

  staff: {
    role: 'Office / Support Staff',
    intro:
      'Non-teaching staff (office, librarian, warden, transport in-charge, accounts) are added by the admin and manage the operational modules. You are invited the same way a teacher is.',
    sections: [
      ['1. Get into your account', [
        'Open the invite email and click the link to set your password (Accept Invite).',
        'No email? Ask the admin for the School Join Code and use "Join a School".',
      ]],
      ['2. Modules you may handle', [
        'Library: add/catalogue books, issue and return them, collect fines.',
        'Hostel / Warden: manage rooms, allotments, mess menu, gate-passes and complaints.',
        'Transport: maintain routes, stops and student assignments.',
        'Store: add items and record student purchases.',
        'Fees / Accounts: record payments, view due and defaulter reports.',
      ]],
      ['3. Note', [
        'You only see the modules your admin gives you access to.',
        'For anything you cannot see or edit, contact your School Administrator.',
      ]],
    ],
  },
};

function renderHTML(key, g) {
  const sections = g.sections.map(([heading, steps]) => `
    <section>
      <h2>${heading}</h2>
      <ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    </section>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${BRAND.product} — ${g.role} Guide</title>
<style>
  :root { --brand: ${BRAND.color}; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; line-height: 1.55; }
  .page { max-width: 800px; margin: 0 auto; padding: 48px 56px; }
  header { border-bottom: 3px solid var(--brand); padding-bottom: 18px; margin-bottom: 28px; }
  header .product { color: var(--brand); font-weight: 700; font-size: 14px; letter-spacing: .5px; text-transform: uppercase; }
  header h1 { margin: 6px 0 2px; font-size: 30px; }
  header .tag { color: #6b7280; font-size: 13px; }
  .intro { background: #f1f5ff; border-left: 4px solid var(--brand); padding: 14px 18px; border-radius: 6px; margin-bottom: 8px; font-size: 14.5px; }
  section { margin-top: 26px; break-inside: avoid; }
  h2 { font-size: 18px; color: var(--brand); margin: 0 0 8px; }
  ol { margin: 0; padding-left: 22px; }
  li { margin: 5px 0; font-size: 14.5px; }
  footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 14px; color: #6b7280; font-size: 12px; display: flex; justify-content: space-between; }
  @media print { .page { padding: 0; max-width: none; } body { font-size: 12px; } @page { margin: 18mm; } }
</style>
</head>
<body>
  <div class="page">
    <header>
      <div class="product">${BRAND.product}</div>
      <h1>${g.role} — Getting Started</h1>
      <div class="tag">${BRAND.tagline}</div>
    </header>
    <p class="intro">${g.intro}</p>
    ${sections}
    <footer>
      <span>${BRAND.product} — ${g.role} onboarding guide</span>
      <span>Need help? ${BRAND.support}</span>
    </footer>
  </div>
</body>
</html>`;
}

// Source folder (editable, kept in repo) + the web app's public folder so the
// login-screen "Guides" links resolve in production (Vercel only deploys apps/web).
const outDirs = [
  __dirname,
  path.join(__dirname, '..', '..', 'apps', 'web', 'public', 'docs'),
];
let count = 0;
for (const dir of outDirs) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [key, g] of Object.entries(GUIDES)) {
    const file = path.join(dir, `onboarding-${key}.html`);
    fs.writeFileSync(file, renderHTML(key, g), 'utf8');
    console.log(`  ✓ ${path.relative(process.cwd(), file)}  (${g.role})`);
    count++;
  }
}
console.log(`\nGenerated ${count} onboarding guides across ${outDirs.length} folders.`);
console.log('Open each in a browser → Ctrl/Cmd+P → Save as PDF.');
