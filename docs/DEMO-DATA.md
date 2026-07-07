# EduBridge — Complete Feature Training Sheet (with demo data)

**One school, one class, followed through EVERY module.** Data is consistent throughout: **Greenwood High School → Grade 7 → 4 teachers → 6 students.** Teach top-to-bottom; the order respects dependencies.

**Cast (reused everywhere):**
- **School:** Greenwood High School, Bengaluru, Karnataka
- **Admin:** Anitha Menon
- **Teachers:** Rohan Nair (Maths, *class in-charge*), Kavya Reddy (English/Hindi), Arjun Iyer (Science/CS), Fatima Khan (Social Science)
- **Staff:** Deepak Shetty (Accountant), Meera Pillai (Librarian), Suresh Gowda (Office Assistant)
- **Students (Grade 7-A):** Aarav Menon, Diya Sharma, Kabir Rao, Ananya Nair, Ishaan Gupta, Sara Khan

---

# PART A — Onboarding & Setup

## 1 · Register school  *(public `/register`)*
```
School Name: Greenwood High School   City: Bengaluru   State: Karnataka
Phone: 9845012345
Admin: Anitha / Menon | principal@greenwoodhigh.edu.in | Password: Greenwood@2026
```
## 2 · Approve as AIPSA super-admin  *(`/aipsa/schools` → Approve Greenwood → log back in as school admin)*

## 3 · School Profile  *(`/school/profile`)*
```
Academic Year: 2026-27 | Board: CBSE | Address: 42 Residency Road, Bengaluru 560025
Upload a logo (optional)
```

## 4 · Manage Classes → Class + Section  *(`/school/students/classes`)*
```
Class: Grade 7      Sections: A , B
```

## 5 · HR → Departments  *(`/school/hr` → Departments)*
```
Science & Mathematics | Languages | Administration
```

## 6 · HR → Add Teachers (Role = TEACHER)  — copy each temp password shown
```
Rohan  Nair  | rohan.nair@greenwoodhigh.edu.in  | 9845100001 | GHS-T-101 | Science & Mathematics | Senior Teacher | 2022-06-01
Kavya  Reddy | kavya.reddy@greenwoodhigh.edu.in | 9845100002 | GHS-T-102 | Languages             | Teacher        | 2023-06-15
Arjun  Iyer  | arjun.iyer@greenwoodhigh.edu.in  | 9845100003 | GHS-T-103 | Science & Mathematics | Teacher        | 2021-07-01
Fatima Khan  | fatima.khan@greenwoodhigh.edu.in | 9845100004 | GHS-T-104 | Languages             | Teacher        | 2024-06-10
```
## 7 · HR → Add Staff (Role = STAFF)
```
Deepak Shetty | deepak.shetty@greenwoodhigh.edu.in | 9845200001 | GHS-S-201 | Administration | Accountant
Meera  Pillai | meera.pillai@greenwoodhigh.edu.in  | 9845200002 | GHS-S-202 | Administration | Librarian
Suresh Gowda  | suresh.gowda@greenwoodhigh.edu.in  | 9845200003 | GHS-S-203 | Administration | Office Assistant
```
## 8 · Assign teacher to class  *(Manage Classes → Grade 7 → set In-charge)*
```
Grade 7 In-charge: Rohan Nair
```

---

# PART B — Academics

## 9 · Examinations → Subjects (Grade 7) + assign teacher  *(`/school/exams` → Subjects)*
```
English  ENG7 → Kavya Reddy | Mathematics MAT7 → Rohan Nair | Science SCI7 → Arjun Iyer
Social Science SST7 → Fatima Khan | Hindi HIN7 → Kavya Reddy | Computer Science CS7 → Arjun Iyer
```

## 10 · LMS / Curriculum → Lessons (chapters per subject)  *(`/school/curriculum`)*
```
Science → Title: Chapter 1 — Nutrition in Plants | Desc: Photosynthesis & modes of nutrition
         Link: "Photosynthesis" → https://www.khanacademy.org/science/biology
Maths   → Title: Chapter 1 — Integers | Desc: Properties, addition & multiplication of integers
         Link: "NCERT Maths 7" → https://ncert.nic.in/textbook.php
```

## 11 · Students → Admit (Grade 7-A)  *(`/school/students/new`)*  — add all 6
```
Name           | DOB        | Gender | Guardian (relation) | Phone      | Guardian Email
Aarav  Menon   | 2013-04-11 | Male   | Anil Menon (Father) | 9811100001 | parent.aarav@example.com
Diya   Sharma  | 2013-07-22 | Female | Rakesh Sharma (F)   | 9811100002 | parent.diya@example.com
Kabir  Rao     | 2013-01-09 | Male   | Vikram Rao (Father) | 9811100003 | parent.kabir@example.com
Ananya Nair    | 2013-09-30 | Female | Prakash Nair (F)    | 9811100004 | parent.ananya@example.com
Ishaan Gupta   | 2013-03-18 | Male   | Manish Gupta (F)    | 9811100005 | parent.ishaan@example.com
Sara   Khan    | 2013-11-05 | Female | Imran Khan (Father) | 9811100006 | parent.sara@example.com
```
> Use `@example.com` so no real inbox is emailed live.

## 12 · Attendance  *(`/school/attendance` → Grade 7 / A, today)*
```
Aarav Present | Diya Present | Kabir ABSENT | Ananya Present | Ishaan Present | Sara ABSENT
```
> Marking **absent** auto-alerts those parents — good place to show notifications.

## 13 · Examinations → Exams → Marks → Complete  *(`/school/exams`)*
**Create exam:**
```
Name: First Unit Test | Class: Grade 7 | Term: Term 1
Start 2026-07-20 | End 2026-07-25 | Max 100 | Pass 35
```
**Marks Entry (per subject):**
```
          Aarav Diya Kabir Ananya Ishaan Sara
English    82   90   66    78     71    88
Maths      88   84   59    91     69    93
Science    75   80   64    86     73    79
Soc. Sci.  79   88   70    83     66    90
```
**Then Exams tab → "Start Exam" → "Complete Term"** so it appears on the Report Card. ⚠️ Without COMPLETED status the report card stays empty.

## 14 · Report Card  *(Examinations → Report Cards → Grade 7 → Inspect a student)*
Shows the academic "OFFICIAL REPORT CARD" (marks/%/grade). Print via Ctrl+P.

## 15 · Co-Curricular (CCA)  *(`/school/cca`)*
```
Chess Club   → Arjun Iyer
Music        → Kavya Reddy
Athletics    → Rohan Nair
```

## 16 · Timetable  *(`/school/timetable`)*
```
Working days: Mon–Fri | Periods: 6 | then use Auto-Generate → view Grade 7-A grid
```

---

# PART C — Finance

## 17 · Fee Management → Categories  *(`/school/fees` → Fee Structure)*
```
Tuition Fee     (Class-wide)          | Monthly academic tuition
Transport Fee   (Transport/bus users) | Monthly bus service
Admission Fee   (Class-wide)          | One-time admission
Examination Fee (Class-wide)          | Term exam charge
```
## 18 · Fee Structures (Grade 7)
```
Tuition Fee     | Grade 7 | ₹3,500  | Monthly  | Due 2026-07-10
Transport Fee   | Grade 7 | ₹1,200  | Monthly  | Due 2026-07-10
Admission Fee   | Grade 7 | ₹15,000 | One-Time | Due 2026-06-30
Examination Fee | Grade 7 | ₹800    | One-Time | Due 2026-09-15
```
## 19 · Collect a Fee  *(Collect tab)*
```
Search: Aarav → Category: Tuition Fee | Amount 3500 | Method: UPI → generates receipt
```
> Show **Due Report** and **Defaulter Report** tabs too — Kabir/others unpaid appear there.

---

# PART D — Operations Modules

## 20 · Transport  *(`/school/transport`)*
```
Route: Koramangala Route | Route No: R-01 | Bus No: KA-01-AB-4521
Stops: (name / seq / pickup / drop)
  Koramangala 5th Block | 1 | 07:15 | 15:45
  Ejipura Signal        | 2 | 07:25 | 15:35
  School Gate           | 3 | 07:45 | 15:15
Assign student: Diya Sharma (boarding point: Koramangala 5th Block)
```
## 21 · Hostel  *(`/school/hostel`)*
```
Hostel: Tagore Boys Hostel | Type: Boys | Warden: Ramesh Kumar | Phone 9845300001
Room: 101 | Floor: 1 | Capacity: 4     → Allocate: Ishaan Gupta
Mess menu: Monday / Breakfast / Idli, Sambar, Fruit / 08:00
```
## 22 · Store  *(`/school/store`)*
```
Items: School Uniform (UNIFORM) ₹850 | Notebook Set (STATIONERY) ₹320 | School Bag (ACCESSORY) ₹1,100
Sale: Aarav Menon → School Uniform | Qty 1 | ₹850
```
## 23 · Library  *(`/school/library`)*
```
Books:
  The Jungle Book   | Rudyard Kipling | 9780141325293 | Fiction | Grade 5 | Copies 3
  A Brief History of Time | Stephen Hawking | 9780553380163 | Science | Grade 9 | Copies 2
Issue: The Jungle Book → Diya Sharma
```
## 24 · Events  *(`/school/events`)*
```
Title: Annual Sports Day | Date: 2026-08-15 | Location: Main Ground
Description: Inter-house athletics, track & field, and prize distribution.
```
## 25 · Communication → Announcement  *(`/school/communication`)*
```
Title: Parent-Teacher Meeting
Message: PTM for Grade 7 on Saturday, 12th July at 10 AM in the school auditorium. Kindly attend.
Audience: Parents (and Teachers)
```

---

# PART E — TEACHER Portal  *(log in as Rohan Nair — temp password from Step 6)*
Walk these to show the teacher's side:
- **Students** — class roster.
- **Attendance** — teacher marks their class.
- **Marks Entry** — same marks, from the teacher's view.
- **Homework** *(`/teacher/homework`)*:
  ```
  Class Grade 7-A | Subject Mathematics
  Title: Chapter 1 Practice Exercises | Instructions: Solve Q1–Q10, page 14 | Due 2026-07-12
  Attachment (optional): https://drive.google.com/...
  ```
- **CCA Grading** — grade a student in Chess Club (e.g. A).
- **Progress Cards** *(`/teacher/progress`)* — fill and **Publish** the Holistic Progress Card:
  ```
  Student: Aarav Menon | Term: Term 1
  Conduct: Discipline A, Punctuality A, Teamwork B+
  Achievements: Won 2nd prize in inter-house chess.
  Remark: A diligent, curious student. Keep up the consistent effort.
  → click PUBLISH CARD
  ```
- **LMS** — add/organise chapters.
- **Join Requests** — approve students who joined via class code.

# PART F — STUDENT / PARENT Portals  *(the payoff — receiving end)*
Log in as a student and a parent to show everything landed automatically:
- **Parent → Progress Card** *(`/parent/progress`)* → the **Holistic Progress Card** (published in Part E) with Print button.
- **Attendance** alert, **Fees** + receipt, **Results**, **Homework**, **Announcements**, **Transport/Hostel/Library/Purchases/Events** — all visible.
> Message to management: "One action by staff instantly reaches the right parent and student — no phone calls, no paper."

# PART G — SUPER ADMIN (AIPSA) Portal  *(`/aipsa`)*
- **Schools** — every tenant, approvals, status (where you approved Greenwood in Step 2).
- **Home Schooling** — the B2C product line.
- **Profile** — AIPSA account.
> The bird's-eye view: AIPSA oversees all member schools from one console.

---

## Student self-join (mention/demo optional)
Besides admin admission (Step 11), students can **self-join by class code**: Manage Classes → generate a class **join code** → student opens `/student-join`, enters code + details → request lands in the teacher's **Join Requests** → approve → account created. Great for bulk onboarding.

## Pre-meeting checklist
- [ ] Warm up the server 10 min before (first request after idle is slow).
- [ ] Keep the admin password + every teacher temp-password in a notes file as you create them.
- [ ] Do Steps 1–13 in order — later steps depend on earlier ones.
- [ ] Complete the exam (Step 13) BEFORE showing the report card (Step 14).
- [ ] Publish the progress card (Part E) BEFORE showing it in the parent portal (Part F).

*Fields verified against current forms: register, classes/sections/in-charge, HR staff, subjects, LMS chapters, students+guardians, attendance, exams+marks, CCA, timetable, fees, transport, hostel, store, library, events, communication, homework, progress.*
