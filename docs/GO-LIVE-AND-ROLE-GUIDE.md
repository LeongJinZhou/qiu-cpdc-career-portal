# QIU CPDC Platform — Go-Live & Role Guide

Written in plain language for non-technical staff and students. Two parts:

1. **Go live** — the exact steps to turn on real Google sign-in and add users.
2. **What each role does** — a short, step-by-step guide for every kind of user.

---

## Part 1 — Making the platform official (turn on Google login)

Right now the platform runs in **demo mode** so you can click around without
signing in. To make it real, you switch on Google login. You only do this once.

### Step 1 — Fill in the settings file
1. In the `cpdc-platform` folder, copy the file `.env.example` to a new file
   named `.env` (or `.env.local`). This new file is private and never shared.
2. Open it and fill in the blanks. You get the Firebase values from the
   [Firebase console](https://console.firebase.google.com/) → your project →
   **Project settings**:
   - The `NEXT_PUBLIC_FIREBASE_*` values come from **General → Your apps → Web app**.
   - The three `FIREBASE_*` admin values (`FIREBASE_PROJECT_ID`,
     `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) come from
     **Service accounts → Generate new private key** (a downloaded JSON file).
     Paste the private key exactly as-is, keeping the quotes.
3. Set the mode to real login by putting `firebase-google` in **both**:
   ```
   AUTH_MODE="firebase-google"
   NEXT_PUBLIC_AUTH_MODE="firebase-google"
   ```
4. Generate one secret for the session cookie and paste it into `SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### Step 2 — Create the first administrator
A person can only sign in if their QIU email is already on the system first
(this is the security rule — no stranger can create their own account).
Create the very first Super-Admin from the command line:
1. In `.env`, set `BOOTSTRAP_SUPER_ADMIN_EMAIL` and `BOOTSTRAP_SUPER_ADMIN_NAME`
   to your own QIU details.
2. Run:
   ```bash
   npm run db:bootstrap-admin
   ```
3. Remove those two bootstrap lines afterwards.

### Step 3 — Add everyone else
Once you (the Super-Admin) can sign in, add all other users from inside the app:
**Admin → People & access → add a user**. For each person you set their QIU
email, their role, and (for students) their faculty and programme. They can sign
in with Google the moment you save them.

### Step 4 — Restart and sign in
Restart the app. Open it and click **Continue with Google**. Use a QIU Google
account that you added. That's it — the platform is live.

> **Tip:** if a real user gets "this account is not active", it means their email
> hasn't been added yet (Step 3), or their account was set to Suspended/Disabled.

---

## Part 2 — What each role does (step by step)

Everyone signs in the same way — **Continue with Google** — and lands on the
screen built for their role. To sign out, use the **Sign out** button in the
sidebar (bottom-left on a computer, in the menu on a phone).

### 👩‍🎓 Student
Your home is the **Dashboard**. From the sidebar you can:
- **Dashboard** — see your XP, level and what to do next.
- **Career path** — tick off milestones as you complete them (each gives XP).
- **Logbook** — record your internship/fieldwork hours; your supervisor approves them.
- **Workshops** — book a seat, then scan the QR code at the event to check in.
- **Skills test** — take a diagnostic to see your strengths and gaps.
- **My CV** — a resume builds itself from your verified record; you can also add
  your own experience and **upload an existing resume file** (PDF or Word) in
  **Settings → Resume**.
- **Profile / Settings** — edit your phone, bio, career goals, and links. Your
  name, student ID, faculty and programme are set by QIU and can't be changed here.
- **Employers** — turn on "let employers find me" if you want to be discoverable,
  then apply to job postings.

### 👨‍🏫 Lecturer / Head of Programme / Coordinator — create a test in 3 steps
Open **Assessments**:
1. **Upload the question paper.** Choose a PDF, Word, or text file. The system
   reads the questions automatically. Tip: number each question, put options as
   `A.` `B.` `C.` `D.`, and add an `Answer: B` line. (Scanned image-only PDFs
   won't work — export a normal text PDF.)
2. **Check the answers.** Each question shows the options; pick the correct
   answer for every one, then **Save answer keys**.
3. **Publish for students.** Choose which faculty/programme should see it. Once
   published it's locked; to change it, upload a new version.
Students in that faculty/programme then see the test, take it, and their score is
saved automatically. You (and admins) can see their attempt in their student record.

You also review **Approvals** (Final Year Projects, logbooks) from the Admin area.

### 🧑‍💼 CPDC Officer / Admin
Your home is the **Admin** console. Tabs across the top:
- **Overview** — live numbers across all faculties.
- **Student records** — search any student and open their full record.
- **Cohort health** — spot students falling behind and follow up.
- **Approvals** — clear FYP, logbook and employer-event requests.
- **People & access** — add users, set roles, invite staff and students.
- **Audit** — a log of who changed or viewed what.
- **Data explorer** — browse the raw records directly: every assessment attempt,
  job application, workshop, course enrolment, and the full audit log. Search
  and inspect what you need. This is read-only and every view is recorded.

### 🏢 Employer
Your home is the **Employer** area:
- **Find opportunities / Vacancies** — post a job; review applicants and move
  each one along the stages (Applied → Shortlisted → Interview → Offer).
- **Talent search** — browse students who opted in, and send a structured
  interview or coffee-chat request.
- **Public projects** — see coordinator-approved student projects.
- **Host an event** — propose a workshop; CPDC reviews it before students see it.

### 🛡️ Super-Admin
Everything the CPDC Admin sees, plus **People & access** and **Audit** as your
home. Use it to manage accounts and roles and to read any record during an
escalation. Identity changes always leave an audit trail.

### Other staff roles
- **Academic Supervisor** — reads and endorses the logbooks of assigned students.
- **Placement Officer** — tracks who is on placement and their approved hours.
- **Career Counsellor** — reviews a student's CV and skills before a session.
- **University Registrar** — confirms graduation-clearance records; can use the
  Data explorer.
- **Alumni Mentor** — appears in the network for current students to reach.

---

*Questions? The in-app **Help Center** has searchable answers and a button to
replay the guided tour.*
