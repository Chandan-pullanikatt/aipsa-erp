# EduBridge — Live Product Workflow Demo Script

**Presenter:** Chandan  ·  **Environment:** Deployed (production) server  ·  **Duration:** ~15 min live + Q&A

> The golden thread: **Admit a student → mark attendance → parent is notified → collect a fee → assign homework → student/parent see it.** One student, followed through the whole product.

---

## ⚠️ PRE-FLIGHT — do this 10 minutes BEFORE you present (non-negotiable)

1. **Warm up the server.** The API + DB auto-suspend when idle — the *first* request after a pause can take 30–60s (looks like a freeze on stage). Open the deployed site, log in, click around every screen you'll use **~10 min before** so everything is hot.
2. **Have these logins ready in a notes file** (you enter them live, but don't hunt for them):
   - **School Admin** → lands on `/school`
   - **Teacher** → lands on `/teacher`
   - **Parent** (of the student you'll use) → lands on `/parent`
3. **Two devices side by side:**
   - **Laptop** (projected) = you, logged in as School Admin → Teacher.
   - **Phone** = the **mobile app**, logged in as the **Parent**, app in the **background** (push only shows in the tray when backgrounded). This is your notification "wow."
4. **Confirm a class + section exist** in the demo school (admission needs one). If not, create one first — off-stage.
5. Close extra tabs, silence other notifications, zoom browser to ~125% for readability.

**Say nothing about SMS/WhatsApp** — those channels aren't live yet. The live notification you show is **in-app bell + push on the phone + email**.

---

## 🎬 THE LIVE FLOW (what you click + what you say)

### 1 — Frame the story (30 sec, no clicking)
> "I'll take one brand-new student and walk her through everything a real school does — admission, attendance, fees, homework — live, on our real system. Watch the parent's phone on the right."

### 2 — Admit the student  *(logged in as School Admin)*
- Go to **`/school/students`** → **Add / New Student** (`/school/students/new`).
- Fill **First name, Last name, DOB, Gender**, pick **Class** and **Section**.
- Tick **Add guardian**, enter the **parent's name + phone + email** (use the parent account you control).
- Click **Admit** → lands on the student profile.
> "That's admission + parent linkage done in under a minute — no spreadsheets."

### 3 — Mark attendance & TRIGGER THE NOTIFICATION  *(switch to Teacher, or stay as admin on `/school/attendance`)*
- Go to attendance, pick the **Class / Section**, today's date.
- **Mark your student ABSENT.**  ⬅️ *critical — the parent alert only fires on ABSENT, not present.*
- Click **Save / Mark**.
- **Turn to the phone** → push notification arrives: *attendance alert*. Also show the in-app 🔔 bell.
> "The moment I saved, the parent already knows — in-app, on their phone, and by email. No one made a call."

### 4 — Collect a fee  *(as School Admin → `/school/fees` → "Collect Fee" tab)*
- **Search the student**, select them → their fee account loads.
- Enter **amount + method (Cash/UPI)** → **Record Payment**.
- A **receipt with a receipt number** appears instantly.
> "Payment recorded, receipt generated automatically — and the parent gets a payment confirmation too."  *(FEE_RECEIVED notifies the guardian.)*

### 5 — Assign homework  *(as Teacher → `/teacher/homework`)*
- Pick the **class + subject**, add a title + description, **Assign**.
> "The teacher assigns work; it lands with every student in the class."

### 6 — Show the receiving end  *(the payoff)*
- On the **phone / parent login (`/parent`)**: show the attendance alert, the fee receipt, and homework all visible to the parent/student.
> "Same event, one system — admin, teacher, parent, student all in sync in real time. That's the full loop."

### 7 — Close (30 sec)
> "Everything you saw was live on our production server, real data flowing through the real product. Here's what's next…" → your roadmap → **your ask to the team.**

---

## 🧯 LIVE LANDMINES (and the save)
| If this happens | Do this |
|---|---|
| Screen hangs on first click | It's a cold start — keep talking, it'll load. (This is why you warm up beforehand.) |
| Phone push doesn't arrive | Fall back to the in-app 🔔 bell on the laptop — same event, always works. |
| A form errors | Move on to the next step; don't debug live. Come back if time allows. |
| Anyone asks about SMS/WhatsApp | "Those channels are built and pending provider approval — in-app, push and email are live today." |

---

## 📹 BACKUP VIDEO — record this yourself (~10 min, do it the night before)

**Why:** if the network or server misbehaves on stage, you play the video and narrate over it. Zero risk.

**Tool:** Windows **Game Bar** — press `Win + G` → Capture → Record (or the round record button). Or **OBS** if you want higher quality. Record the **browser window**, 1080p.

**Shot list (record in one take, following the flow above):**
1. Login as School Admin (show the dashboard).
2. Admit the student (steps in §2) — full, unhurried.
3. Mark the student **absent** (§3) — then cut to a phone screen recording / hold the phone in frame showing the push.
4. Collect the fee + show the receipt (§4).
5. Assign homework as teacher (§5).
6. Parent view showing all three (§6).

**Tips:** move the mouse slowly and deliberately; pause ~2s on each result screen; don't narrate while recording (you'll narrate live over it). Keep the final file on your **laptop desktop**, not the cloud, so it plays without internet. Name it `edubridge-demo-backup.mp4`.

---

*Verified against current code: admission `POST /sis/students` + guardian; attendance alert fires on ABSENT only ([attendance.service.js:22](../apps/api/src/services/attendance.service.js#L22)); fee payment notifies guardian ([fee.service.js:246](../apps/api/src/services/fee.service.js#L246)); role redirects in [lib/auth.ts:36](../apps/web/lib/auth.ts#L36).*
