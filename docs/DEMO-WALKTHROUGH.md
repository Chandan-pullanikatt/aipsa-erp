# EduBridge — Management Training Walkthrough (with copy-paste demo data)

**Goal:** Teach management how to use the app end-to-end, from registering a school through every portal.
**How to use this:** Follow the steps top-to-bottom — the ORDER matters (each step depends on the one above). Type the demo data from the boxes as you go.

> **Why the order matters:** You can't admit a student before a class exists. You can't link a subject to a teacher before the teacher exists. Follow the sequence and nothing will error live.

---

## PHASE 0 — Onboarding

### Step 1 · Register the school  *(public page `/register`)*
```
School Name:      Green Valley Public School
City:             Pune
State:            Maharashtra
Phone:            9822001100
Admin First Name: Rajesh
Admin Last Name:  Sharma
Admin Email:      principal@greenvalley.edu.in
Admin Password:   Demo@1234
```
> You choose the password here — **write it down**, that's your school-admin login. After submit it goes to the login page. The school starts as **PENDING**.

### Step 2 · Approve the school  *(login as AIPSA Super Admin → `/aipsa/schools`)*
- Log in as the AIPSA super-admin, find **Green Valley Public School**, click **Approve / Activate**.
> Explain to management: this is AIPSA's oversight — no school goes live without approval. Then log out.

### Step 3 · Log in as School Admin  → lands on `/school`
```
Email:    principal@greenvalley.edu.in
Password: Demo@1234
```

### Step 4 · Complete the School Profile  *(`/school/profile`)*
```
Academic Year:  2026-2027
Address:        124 MG Road, Camp
Board:          CBSE
Upload a logo (optional)
```

---

## PHASE 1 — Academic Structure  *(build the skeleton first)*

### Step 5 · Create Classes  *(`/school/students` → Classes, or `/school/students/classes`)*
Add these one by one:
```
Grade 6
Grade 7
Grade 8
```

### Step 6 · Add Sections to each class
```
For Grade 6:  Section A,  Section B
For Grade 7:  Section A
For Grade 8:  Section A
```

### Step 7 · Create Subjects  *(`/school/exams` → Subjects tab, or `/school/staff`)*
Create for **Grade 6** (repeat pattern for others if you want):
```
English          (code ENG)
Mathematics      (code MAT)
Science          (code SCI)
Social Studies   (code SST)
Hindi            (code HIN)
Computer Science (code CS)
```
> Leave the teacher blank for now — you'll assign teachers in Step 9.

---

## PHASE 2 — People

### Step 8 · Create Teachers & Staff  *(`/school/hr` — Staff)*
Add each; **the screen shows a temporary password after saving — note each one down.**
```
Teacher 1:  Priya Nair    | priya.nair@greenvalley.edu.in    | Role: Teacher | Phone 9800011111
Teacher 2:  Amit Verma    | amit.verma@greenvalley.edu.in    | Role: Teacher | Phone 9800022222
Teacher 3:  Sunita Rao    | sunita.rao@greenvalley.edu.in    | Role: Teacher | Phone 9800033333
Accountant: Deepak Joshi  | deepak.joshi@greenvalley.edu.in  | Role: Staff   | Phone 9800044444
Librarian:  Meena Iyer    | meena.iyer@greenvalley.edu.in    | Role: Staff   | Phone 9800055555
```
> Optional first: create Departments (Teaching, Administration) if the HR page asks for one.

### Step 9 · Assign teachers to subjects  *(`/school/staff` or Subjects tab)*
```
English  → Priya Nair
Mathematics → Amit Verma
Science  → Sunita Rao
```
> Also set a **Class Teacher** for Grade 6-A: **Priya Nair**.

### Step 10 · Admit Students  *(`/school/students/new`)* — add 4–5
```
Student 1
  Name: Aarav Sharma | DOB 2014-05-12 | Male   | Class Grade 6 / Sec A
  Guardian: Rajesh Sharma (Father) | 9811100001 | parent.aarav@example.com
Student 2
  Name: Isha Patel   | DOB 2014-08-03 | Female | Class Grade 6 / Sec A
  Guardian: Nikhil Patel (Father)   | 9811100002 | parent.isha@example.com
Student 3
  Name: Kabir Singh  | DOB 2014-02-20 | Male   | Class Grade 6 / Sec A
  Guardian: Harpreet Singh (Father) | 9811100003 | parent.kabir@example.com
Student 4
  Name: Ananya Reddy | DOB 2014-11-09 | Female | Class Grade 6 / Sec B
  Guardian: Suresh Reddy (Father)   | 9811100004 | parent.ananya@example.com
```
> Tip: use `@example.com` guardian emails so no real inbox gets a live email during the meeting.

---

## PHASE 3 — Daily Operations

### Step 11 · Take Attendance  *(`/school/attendance`)*
- Pick **Grade 6 / Section A**, today's date.
- Mark **Aarav = Present, Isha = Present, Kabir = ABSENT**.
> Point out: marking a student **absent** automatically alerts that parent (in-app + email; push if they have the mobile app). Absent is what triggers the alert — present does not.

### Step 12 · Set up Fees, then collect one  *(`/school/fees`)*
**Structure tab → create categories + amounts:**
```
Tuition Fee    | Monthly   | ₹2,500  | Grade 6
Transport Fee  | Monthly   | ₹800    | (Transport users)
Admission Fee  | One-Time  | ₹5,000  | Grade 6
Exam Fee       | One-Time  | ₹600    | Grade 6
```
**Collect tab → record a payment:**
```
Search: Aarav → select
Category: Tuition Fee | Amount: 2500 | Method: UPI
```
> A receipt with a receipt number generates instantly, and the parent gets a payment confirmation.

### Step 13 · Create an Exam, then enter Marks  *(`/school/exams`)*
**Create exam:**
```
Name: First Unit Test | Class: Grade 6 | Term: Term 1
Start: 2026-07-20 | End: 2026-07-25 | Max Marks: 100 | Passing: 35
```
**Enter marks** (Exam → pick subject Mathematics):
```
Aarav 88 | Isha 76 | Kabir 64 | Ananya 91
```

### Step 14 · Assign Homework  *(`/teacher/homework` — log in as a teacher, or show from teacher portal)*
```
Class: Grade 6-A | Subject: Mathematics
Title: Fractions Worksheet
Description: Complete exercises 3.1 and 3.2, pages 45–46.
Due: 2026-07-10
```

### Step 15 · Add a Lesson / Study Material  *(`/school/curriculum` or `/teacher/lms`)*
```
Title: Introduction to Fractions
Subject: Mathematics | Class: Grade 6
Description: Video + notes on numerator/denominator basics.
(attach a PDF or paste a YouTube link)
```

### Step 16 · Build the Timetable  *(`/school/timetable`)*
- Set working days (Mon–Fri) + periods, then use **auto-generate** to fill the grid. Show one class's timetable.

### Step 17 · Send an Announcement  *(`/school/communication`)*
```
Title: Parent-Teacher Meeting
Message: PTM for Grade 6 on Saturday, 12th July at 10 AM. All parents please attend.
Audience: Parents (and Teachers)
```
> This notifies the selected roles — good place to show the notification system.

### Step 18 · Create an Event  *(`/school/events`)*
```
Title: Annual Sports Day
Date: 2026-08-15
Description: Inter-house sports competition on the main ground.
```

---

## PHASE 4 — Extended Modules (show breadth, quick tour)

### Step 19 · Library  *(`/school/library`)*
```
Book: The Jungle Book | Author: Rudyard Kipling | ISBN 9780141325293 | Copies: 3
```
### Step 20 · Transport  *(`/school/transport`)*
```
Route: Camp – Kharadi | Bus No: MH12-AB-1234 | Driver: Ramesh (9812300000)
Stops: Camp, Koregaon Park, Kharadi
```
### Step 21 · Hostel  *(`/school/hostel`)*
```
Block: A Wing | Room: 101 | Capacity: 4
```
### Step 22 · Store / Inventory  *(`/school/store`)*
```
Item: School Diary | Price ₹120 | Stock: 200
```
### Step 23 · CCA (Co-Curricular)  *(`/school/cca`)*
```
Activity: Chess Club | In-charge: Amit Verma
```

---

## PHASE 5 — Show the Other Portals (the payoff)

Log in as each role to show management the "receiving end." Use the temp passwords from Step 8 (teachers) and the parent/student logins.

- **Teacher portal** (`/teacher`): homework, enter marks, take attendance, student progress, LMS.
- **Parent portal** (`/parent`): the attendance alert, fee receipt, homework, announcements — all landed automatically.
- **Student portal** (`/student`): lessons/LMS, homework, timetable.
- **Super Admin / AIPSA** (`/aipsa`): all schools, approvals, home-schooling — AIPSA's bird's-eye view.

---

## Pre-meeting checklist (10 min before)
- [ ] **Warm up the server** — open the site + click around; the first request after idle can take 30–60s.
- [ ] Have this doc open on a second screen / printed.
- [ ] Keep the school-admin password (Step 1) and teacher temp-passwords (Step 8) in a notes file as you create them.
- [ ] Zoom browser to ~125%; close unrelated tabs.
- [ ] If showing push on a phone, have the mobile app logged in as a parent, backgrounded.

## Suggested order to *teach* (if 45–60 min)
Onboarding → Structure (classes/sections/subjects) → People (teachers/students) → a normal day (attendance → fees → exam/marks → homework → announcement) → tour the extra modules briefly → walk the teacher/parent/student portals to close the loop.

---

*Endpoints verified in code: register `POST /auth/register`; classes `POST /sis/classes` + sections; subjects `POST /exams/subjects`; staff `POST /hr/staff` (returns temp password); students `POST /sis/students` + guardians; attendance absent→guardian alert; fee payment→guardian alert; exams `POST /exams/exams` then marks.*
