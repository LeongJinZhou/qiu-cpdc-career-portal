/**
 * Guide content for the QIU Career Hub help centre, the first-login tour and
 * docs/USER-GUIDE.md.
 *
 * Kept as plain data — not JSX — so CPDC staff can correct a sentence without
 * touching a React component, and so the same words can be rendered in the
 * portal, in the tour and in the printed manual.
 *
 * Writing rules for anything added here:
 *   - Assume the reader has never used the platform and is not technical.
 *   - Title every task the way a person would ask for it out loud.
 *   - Every step starts with a verb and is a single action.
 *   - Say what happens after the action, and who can see the result.
 *   - Gloss every abbreviation the first time it appears.
 *   - Never write "simply", "just" or "obviously".
 *   - Never invent QIU contact details, names, phone numbers or opening hours.
 *     Use the CONTACT_PLACEHOLDER below instead.
 *
 * Roles referenced here are the eleven account roles in lib/modules.js, plus
 * the string 'EXTERNAL_SUPERVISOR' for the workplace supervisor who has no
 * account and acts only through an emailed approval link.
 */

/** Written wherever a real CPDC contact point is needed but not yet known. */
export const CONTACT_PLACEHOLDER = '[CPDC contact — to be filled in by CPDC]';

/** Human-readable role names, for guide headings and role filters. */
export const ROLE_LABELS = {
  STUDENT: 'Student',
  ALUMNI: 'Alumni Mentor',
  HEAD_OF_PROGRAMME: 'Head of Programme',
  FACULTY_COORDINATOR: 'Faculty Coordinator',
  ACADEMIC_SUPERVISOR: 'Academic Supervisor',
  PLACEMENT_OFFICER: 'Placement Officer',
  CPDC_ADMIN: 'CPDC Officer',
  CAREER_COUNSELOR: 'Career Counselor',
  UNIVERSITY_REGISTRAR: 'Registrar',
  SUPER_ADMIN: 'Super-Admin',
  EMPLOYER: 'Employer',
  EXTERNAL_SUPERVISOR: 'Workplace Supervisor (no account)',
};

/**
 * Task categories, in the order a newcomer meets them. Named after what the
 * reader is trying to do, not after the module that happens to implement it.
 */
export const GUIDE_CATEGORIES = [
  { id: 'start', label: 'First steps' },
  { id: 'profile', label: 'Your CV and your project' },
  { id: 'placement', label: 'Placement hours and sign-off' },
  { id: 'learning', label: 'Workshops, courses and certificates' },
  { id: 'jobs', label: 'Jobs and employers' },
  { id: 'people', label: 'People, mentors and messages' },
  { id: 'review', label: 'Checking and approving student work' },
  { id: 'run', label: 'Running the platform' },
  { id: 'account', label: 'Your account and privacy' },
];

const ALL_STUDENT_FACING = ['STUDENT'];
const ALL_STAFF = [
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'ACADEMIC_SUPERVISOR',
  'PLACEMENT_OFFICER',
  'CPDC_ADMIN',
  'CAREER_COUNSELOR',
  'UNIVERSITY_REGISTRAR',
  'SUPER_ADMIN',
];

/**
 * The task guides.
 *
 * Fields:
 *   id       — stable slug, also the anchor used by deep links.
 *   category — one of GUIDE_CATEGORIES.
 *   title    — the question a person would actually type or ask.
 *   who      — role ids this guide is written for.
 *   summary  — one plain sentence answering "what is this for?".
 *   steps    — numbered actions, each starting with a verb.
 *   result   — what happens next, and who can see it.
 *   href     — the screen the task happens on, or null if there isn't one.
 *   hrefLabel— button text for that link.
 *   keywords — extra words people search for that aren't in the text above.
 */
export const GUIDES = [
  // ---------------------------------------------------------------- start ---
  {
    id: 'what-is-this',
    category: 'start',
    title: 'What is QIU Career Hub, and what is it for?',
    who: [...ALL_STUDENT_FACING, 'ALUMNI', 'EMPLOYER', ...ALL_STAFF],
    summary:
      'It is the university website where your career progress is recorded: the workshops you attend, the placement hours you work, your final-year project, and the CV that is built from all of it.',
    steps: [
      'Sign in with your QIU account.',
      'Look at the menu down the left of the screen (on a phone, along the bottom). Each entry is one area of your career record.',
      'Open the area you were asked to use. If nobody has told you where to start, open Dashboard.',
      'Come back to Help at any time — it is the last item in the menu.',
    ],
    result:
      'Nothing you read here changes your record. You only change your record when you fill in a form and press a save or submit button.',
    href: '/help',
    hrefLabel: 'You are here',
    keywords: ['overview', 'introduction', 'purpose', 'cpdc', 'what is'],
  },
  {
    id: 'sign-in',
    category: 'start',
    title: 'How do I sign in?',
    who: [...ALL_STUDENT_FACING, 'ALUMNI', 'EMPLOYER', ...ALL_STAFF],
    summary: 'You use the same email address the university (or CPDC) registered for you.',
    steps: [
      'Open the sign-in page.',
      'Press Continue with Google.',
      'Choose the Google account whose email address the university or CPDC registered for you.',
      'Read the permission prompt and continue. The platform uses Google to prove who you are; it does not create a separate QIU password.',
      `If Google says your account is not allowed, contact ${CONTACT_PLACEHOLDER} — do not create a second account, because your record is attached to the first one.`,
    ],
    result:
      'You land on the screen that matches your role. A student lands on the Dashboard; most staff land on the Admin area; an employer lands on the Employers area.',
    href: '/login',
    hrefLabel: 'Go to sign-in',
    keywords: ['login', 'log in', 'google', 'sso', 'cannot sign in', 'locked out'],
  },
  {
    id: 'find-my-way',
    category: 'start',
    title: 'I am lost. How do I find a screen?',
    who: [...ALL_STUDENT_FACING, 'ALUMNI', 'EMPLOYER', ...ALL_STAFF],
    summary: 'Everything is reachable from the menu, and the menu only shows what your role is allowed to open.',
    steps: [
      'Look at the menu on the left of the screen. On a phone, look at the bar across the bottom, then tap the menu button for the full list.',
      'Read the labels: they are named after the thing you want, for example Logbook for placement hours or My CV for your CV.',
      'If a screen you were told about is not in your menu, your role does not have access to it. That is deliberate, not a fault.',
      'Search this Help page for the task instead — the guide tells you who is allowed to do it.',
    ],
    result:
      'If you open a web address your role cannot use, the platform sends you back to your own home screen rather than showing an error.',
    href: '/help',
    hrefLabel: 'Search the guides',
    keywords: ['menu', 'navigation', 'missing', 'cannot see', 'sidebar', 'lost'],
  },
  {
    id: 'set-up-profile',
    category: 'start',
    title: 'How do I set up my profile for the first time?',
    who: ['STUDENT'],
    summary:
      'Your faculty, your programme and your career targets tell the platform which roadmap, workshops and jobs to show you. Set them once.',
    steps: [
      'Open Settings from the menu.',
      'Check your faculty and programme are correct. Everything else is filtered by these two, so a wrong faculty means wrong recommendations.',
      'Add one or two career targets — the kind of job you want after you graduate. Plain words are fine, for example "data analyst" or "hotel operations".',
      'Add the industries you would consider working in.',
      'Add any links you want employers to see, for example a portfolio or a professional profile.',
      'Press the save button at the bottom of the section.',
    ],
    result:
      'Your Dashboard, Career Path and workshop suggestions rebuild around your answers straight away. Only you and authorised QIU staff can see this; employers see only what you choose to publish.',
    href: '/settings',
    hrefLabel: 'Open Settings',
    keywords: ['onboarding', 'first time', 'career target', 'faculty', 'programme', 'setup'],
  },
  {
    id: 'next-best-action',
    category: 'start',
    title: 'What should I do next? (the Dashboard)',
    who: ['STUDENT'],
    summary:
      'The Dashboard shows one recommended action at a time, so you never have to work out your own to-do list.',
    steps: [
      'Open Dashboard from the menu.',
      'Read the card at the top labelled Next best action.',
      'Press the button on that card to go straight to the task.',
      'Finish the task, then return to the Dashboard — a new recommendation appears.',
    ],
    result:
      'The recommendation is worked out from what you have and have not done yet. Completing tasks also adds XP (points you earn for career activities), which appear on your profile.',
    href: '/dashboard',
    hrefLabel: 'Open Dashboard',
    keywords: ['dashboard', 'what next', 'recommendation', 'home', 'xp', 'points'],
  },
  {
    id: 'career-path',
    category: 'start',
    title: 'How do I see what I should do in each year of my degree?',
    who: ['STUDENT'],
    summary:
      'Career Path lays out your degree year by year, with the concrete things to do in each one.',
    steps: [
      'Open Career Path from the menu.',
      'Find the year you are in now.',
      'Read the list of actions for that year. Items marked as required are the ones you should not skip.',
      'Press any action to open the screen where you do it.',
      'Look at the next year to see what is coming, so nothing is a surprise.',
    ],
    result:
      'Your completion figure updates as you finish items. Your faculty staff can see this progress as part of supporting you.',
    href: '/career-path',
    hrefLabel: 'Open Career Path',
    keywords: ['roadmap', 'year 1', 'year 2', 'year 3', 'milestone', 'plan', 'journey'],
  },

  // -------------------------------------------------------------- profile ---
  {
    id: 'build-cv',
    category: 'profile',
    title: 'How do I get a CV without writing one from scratch?',
    who: ['STUDENT'],
    summary:
      'My CV builds itself from things already recorded on the platform — workshops you attended, hours you logged, certificates that were verified, and your final-year project.',
    steps: [
      'Open My CV from the menu.',
      'Read the draft. The sections are filled in from your verified activity, so the page is not blank.',
      'Open Settings to add your phone, links, summary, work experience, volunteering and achievements.',
      'Edit the summary paragraph at the top in your own words — this is the part that sounds like you.',
      'Check every entry is something you actually did. Report anything that looks wrong rather than deleting it, because the record behind it may need correcting too.',
      'Press the download or export button to save it as a PDF.',
    ],
    result:
      'The PDF has selectable text, which matters because employers run CVs through ATS software (the software employers use to scan CVs before a human reads them) and that software cannot read a picture of text.',
    href: '/cv',
    hrefLabel: 'Open My CV',
    keywords: ['resume', 'cv', 'pdf', 'ats', 'download', 'export', 'auto-cv'],
  },
  {
    id: 'cv-missing-items',
    category: 'profile',
    title: 'Something I did is missing from my CV. Why?',
    who: ['STUDENT'],
    summary:
      'Only verified activity reaches your CV. If an item is missing, one of the steps that verifies it has not finished yet.',
    steps: [
      'Check the workshop: attendance only counts if you checked in on the day. If you attended but did not check in, tell the workshop organiser.',
      'Check the placement hours: hours only count once your workplace supervisor has approved the entry in Logbook.',
      'Check the certificate: an online course only counts after CPDC staff verify the evidence you submitted.',
      'Check your final-year project: it appears once you have submitted it and a coordinator has approved it.',
      `If all of the above are done and the item is still missing after a day, contact ${CONTACT_PLACEHOLDER} and say which item and which date.`,
    ],
    result:
      'Once the missing step completes, the item appears on your CV automatically. You do not need to re-enter it.',
    href: '/cv',
    hrefLabel: 'Open My CV',
    keywords: ['missing', 'not showing', 'cv empty', 'blank', 'why', 'verified'],
  },
  {
    id: 'submit-fyp',
    category: 'profile',
    title: 'How do I publish my final-year project?',
    who: ['STUDENT'],
    summary:
      'FYP stands for Final Year Project. Publishing it puts your work where employers and staff can see it, and adds it to your CV.',
    steps: [
      'Open FYP from the menu.',
      'Choose how to enter it: upload your project poster as an image, or answer the guided questions if you do not have a poster.',
      'Write the title and a short description. Name the actual tools and skills you used — employers search on those words.',
      'Press submit.',
      'Wait for your coordinator to review it. You can keep working on other things in the meantime.',
    ],
    result:
      'Your project goes to your faculty coordinator first. Nobody outside QIU sees it until it is approved. Once approved, it appears on your CV and — if you opted in — in the Talent Feed that employers browse.',
    href: '/fyp',
    hrefLabel: 'Open FYP',
    keywords: ['final year project', 'fyp', 'poster', 'showcase', 'publish', 'project'],
  },
  {
    id: 'talent-feed-optin',
    category: 'profile',
    title: 'Who can see my project, and how do I control that?',
    who: ['STUDENT'],
    summary:
      'Your project is private until you opt in and a coordinator approves it. Nothing is published behind your back.',
    steps: [
      'Open Settings from the menu.',
      'Find the visibility section.',
      'Turn on the option to appear in the Talent Feed if you want employers to find you. Leave it off if you do not.',
      'Save the section.',
      'Open Talent Feed to see what an employer would see.',
    ],
    result:
      'Turning the option off removes you from employer searches. Staff at your faculty can still see your record, because they need it to support and assess you.',
    href: '/settings',
    hrefLabel: 'Open Settings',
    keywords: ['privacy', 'visible', 'opt in', 'opt out', 'talent feed', 'who can see'],
  },
  {
    id: 'ai-coach',
    category: 'profile',
    title: 'How do I practise for an interview?',
    who: ['STUDENT', 'CAREER_COUNSELOR'],
    summary:
      'Interview Practice runs a timed question and shows you which skills a target job expects that you do not yet have evidence for.',
    steps: [
      'Open Interview Practice from the menu.',
      'Choose the job role you are aiming at.',
      'Read the skill comparison: it shows what that role usually expects next to what you have already earned.',
      'Press the button to start a timed practice question.',
      'Answer out loud, then stop the timer to read the feedback.',
      'Repeat with a different question. Practising three times beats reading the advice once.',
    ],
    result:
      'Practice sessions are for you. They are not shared with employers, and they are not a graded assessment.',
    href: '/ai-suite',
    hrefLabel: 'Open Interview Practice',
    keywords: ['interview', 'practice', 'mock', 'ai', 'skill gap', 'coach'],
  },
  {
    id: 'diagnostics',
    category: 'profile',
    title: 'How do I find out which skills I am missing?',
    who: ['STUDENT', 'CAREER_COUNSELOR'],
    summary:
      'The skills diagnostic is a short set of questions. Its only purpose is to point you at the right workshops.',
    steps: [
      'Open Diagnostics from the menu.',
      'Pick the diagnostic for your faculty.',
      'Answer honestly. Guessing high hides the gaps and wastes your own time.',
      'Finish the test and read your results.',
      'Press through to the suggested workshops from the results screen.',
    ],
    result:
      'Your results turn into a short list of workshops that close exactly those gaps, and you earn XP for completing the test. You can retake it later to show improvement.',
    href: '/diagnostics',
    hrefLabel: 'Open Diagnostics',
    keywords: ['test', 'quiz', 'assessment', 'skills', 'gap', 'diagnostic'],
  },
  {
    id: 'take-assessment',
    category: 'learning',
    title: 'How do I take a test my lecturer or CPDC uploaded?',
    who: ['STUDENT'],
    summary: 'Published assessments are shown only when they match your faculty or programme. Your answers and score are saved to your record.',
    steps: [
      'Open Assessments & Tests from the menu.',
      'Choose a published test that was prepared for your faculty or programme.',
      'Read the instructions and answer every question. You cannot submit an incomplete attempt.',
      'Press Submit assessment when you are ready.',
      'Read your result. Staff can see that you attempted the test, but you cannot change the answer key.',
    ],
    result: 'Your score and pass status are recorded with the assessment title and submission time. The correct answers are never sent to the student browser.',
    href: '/assessments',
    hrefLabel: 'Open Assessments & Tests',
    keywords: ['assessment', 'test', 'exam', 'quiz', 'lecturer', 'answer', 'score'],
  },
  {
    id: 'upload-assessment',
    category: 'review',
    title: 'How do I turn a PDF, Word file or text file into a student assessment?',
    who: ['HEAD_OF_PROGRAMME', 'FACULTY_COORDINATOR', 'ACADEMIC_SUPERVISOR', 'CPDC_ADMIN', 'SUPER_ADMIN'],
    summary: 'Upload a question paper as a draft, check every parsed question and answer key, then publish it to the correct scope.',
    steps: [
      'Open Assessments & Tests from the menu.',
      'Prepare the source with one numbered question at a time, options on separate A., B., C. or D. lines, and an explicit Answer: line.',
      'Choose the PDF, Word document or UTF-8 text file and press Create draft from file.',
      'Read the draft title, question count and the first questions. The platform refuses to guess a missing answer key.',
      'Check the faculty or programme scope, then press Publish for students only after the content is correct.',
    ],
    result: 'The original file is not stored. The normalized questions, source name, source type, source hash and every publish action are recorded. Image-only scanned PDFs need OCR before import because they contain no selectable text.',
    href: '/assessments',
    hrefLabel: 'Open the assessment workspace',
    keywords: ['upload', 'pdf', 'word', 'txt', 'lecturer', 'create test', 'question paper', 'answer key'],
  },

  // ------------------------------------------------------------ placement ---
  {
    id: 'log-hours',
    category: 'placement',
    title: 'How do I add my placement or internship hours?',
    who: ['STUDENT'],
    summary:
      'The Logbook is the official record of hours you worked on placement. Add entries as you go, not all at once at the end.',
    steps: [
      'Open Logbook from the menu.',
      'Fill in the date, the number of hours, and a short description of what you actually did.',
      'Type your workplace supervisor\'s name.',
      'Type your workplace supervisor\'s email address, and check every character — this is where the approval request is sent.',
      'Press submit.',
    ],
    result:
      'Your entry is saved and marked as waiting for approval, and an email goes to your supervisor. The hours do not count toward your record or your CV until your supervisor approves them.',
    href: '/logbook',
    hrefLabel: 'Open Logbook',
    keywords: ['logbook', 'hours', 'internship', 'placement', 'fieldwork', 'timesheet'],
  },
  {
    id: 'supervisor-signoff',
    category: 'placement',
    title: 'My supervisor has not approved my hours. What do I do?',
    who: ['STUDENT'],
    summary:
      'Your supervisor approves through a one-time link emailed to them. They do not need an account, a password, or any training.',
    steps: [
      'Open Logbook and check the status shown on the entry.',
      'Ask your supervisor to look in their inbox, and then in their spam or junk folder, for an email from QIU about approving a logbook entry.',
      'Check the email address you typed on the entry is exactly right. A single wrong letter means the email went nowhere.',
      'Tell your supervisor the link works once and expires, so they should open it on a device they can finish on.',
      `If the link has expired or the address was wrong, contact ${CONTACT_PLACEHOLDER} to have a new request sent.`,
    ],
    result:
      'When your supervisor approves, the entry changes to approved, the hours count toward your record, and the placement appears on your CV.',
    href: '/logbook',
    hrefLabel: 'Open Logbook',
    keywords: ['approval', 'sign off', 'magic link', 'expired', 'supervisor', 'pending'],
  },
  {
    id: 'external-supervisor-approve',
    category: 'placement',
    title: 'I am a workplace supervisor. How do I approve a student\'s hours?',
    who: ['EXTERNAL_SUPERVISOR'],
    summary:
      'You do not need a QIU account. You approve through the single link the student\'s submission sent to your email.',
    steps: [
      'Open the email from QIU about approving a logbook entry. Check your spam or junk folder if you cannot see it.',
      'Press the link in the email. It opens a page showing the student\'s name, the date, the hours claimed and what they say they did.',
      'Read the entry and check it matches what the student actually worked.',
      'Press Approve if it is correct.',
      'Do not press Approve if anything is wrong. Reply to the student instead and ask them to correct and resubmit the entry.',
      'Close the page when the confirmation appears.',
    ],
    result:
      'The link works once and then expires, which is what keeps the record trustworthy. Your approval is recorded against that one entry only — it gives you no ongoing access to QIU systems and no access to any other student\'s information.',
    href: null,
    hrefLabel: null,
    keywords: ['external', 'employer supervisor', 'preceptor', 'approve', 'link', 'no account'],
  },
  {
    id: 'review-logbook',
    category: 'review',
    title: 'How do I review the placement hours my students have logged?',
    who: ['ACADEMIC_SUPERVISOR', 'PLACEMENT_OFFICER', 'FACULTY_COORDINATOR', 'HEAD_OF_PROGRAMME', 'CPDC_ADMIN', 'UNIVERSITY_REGISTRAR', 'SUPER_ADMIN'],
    summary:
      'The Logbook screen shows the entries inside your scope, with the ones still waiting on a workplace supervisor marked as pending.',
    steps: [
      'Open Logbook from the menu.',
      'Look at the list of entries. You see only students within your own scope — your mentees, your programme or your faculty, depending on your role.',
      'Sort or scan for entries still marked as pending, and note how long they have been waiting.',
      'Contact the student where a workplace supervisor has not responded, so the entry can be re-sent before the deadline.',
      'Use the totals to check a student is on track for the hours their programme requires.',
    ],
    result:
      'Approved hours are counted automatically and appear on the student\'s CV. Nothing you do here replaces the workplace supervisor\'s approval — that has to come from the person who saw the work.',
    href: '/logbook',
    hrefLabel: 'Open Logbook',
    keywords: ['review hours', 'pending', 'placement', 'oversight', 'staff', 'scope'],
  },

  // ------------------------------------------------------------- learning ---
  {
    id: 'book-workshop',
    category: 'learning',
    title: 'How do I book a workshop?',
    who: ['STUDENT', 'ALUMNI'],
    summary: 'Workshops are the short in-person and online sessions CPDC runs.',
    steps: [
      'Open Workshops from the menu.',
      'Read the list. Sessions matched to your faculty and to the gaps your diagnostic found appear first.',
      'Press a session to read what it covers, who is running it and where it is.',
      'Press the register button.',
      'Put the date in your own calendar — the platform records your place, it does not remind your phone for you.',
    ],
    result:
      'Your place is held. Seats are limited, so if a session is full the register button is not available. Registering alone does not count as attending — you also have to check in on the day.',
    href: '/workshops',
    hrefLabel: 'Open Workshops',
    keywords: ['workshop', 'event', 'register', 'rsvp', 'book', 'seminar', 'session'],
  },
  {
    id: 'check-in',
    category: 'learning',
    title: 'How do I check in at a workshop?',
    who: ['STUDENT', 'ALUMNI'],
    summary:
      'Checking in is what records that you were actually there. Without it, the session does not count.',
    steps: [
      'Arrive at the session and find the QR code the organiser displays. (A QR code is the square black-and-white pattern you point a phone camera at.)',
      'Open Workshops on your phone.',
      'Press the check-in button and point your camera at the code.',
      'Wait for the confirmation message on your screen.',
      'Tell the organiser straight away if the scan does not work, while you are still in the room.',
    ],
    result:
      'Your attendance is recorded immediately, you earn XP, and the session appears on your CV. It cannot be added afterwards by scanning from home.',
    href: '/workshops',
    hrefLabel: 'Open Workshops',
    keywords: ['qr', 'scan', 'attendance', 'check in', 'checkin', 'present'],
  },
  {
    id: 'online-courses',
    category: 'learning',
    title: 'How do I find online courses worth doing?',
    who: ['STUDENT', 'ALUMNI'],
    summary:
      'The Learning area lists courses from partner providers, chosen to match your programme and your career targets.',
    steps: [
      'Open Learning from the menu.',
      'Read the learning paths first — a path is an ordered set of courses that build on each other.',
      'Pick the path or single course that matches the gap you are trying to close, rather than collecting unrelated certificates.',
      'Press through to the provider and do the course there. The course itself happens on the provider\'s website, not on this platform.',
      'Come back here when you have your certificate, and submit it for verification.',
    ],
    result:
      'Nothing is added to your record while you are studying. It is added after you submit the certificate and CPDC verify it.',
    href: '/learning',
    hrefLabel: 'Open Learning',
    keywords: ['coursera', 'edx', 'online course', 'learning path', 'mooc', 'study'],
  },
  {
    id: 'submit-certificate',
    category: 'learning',
    title: 'How do I get a course certificate added to my record?',
    who: ['STUDENT', 'ALUMNI'],
    summary:
      'A certificate only counts once a person at CPDC has checked the evidence. That check is what makes it worth something to an employer.',
    steps: [
      'Open Learning from the menu.',
      'Find the course you completed and press the option to submit your certificate.',
      'Choose how to prove it: paste the link the provider gave you, or upload the certificate file.',
      'Check the link actually opens for someone who is not signed in to your account. A private link cannot be verified.',
      'Press submit for verification.',
    ],
    result:
      'Your submission joins the CPDC verification queue. You will see it change to verified when it is accepted, or come back with a note asking for better evidence. Verified certificates appear on your CV and on your profile.',
    href: '/learning',
    hrefLabel: 'Open Learning',
    keywords: ['certificate', 'evidence', 'verify', 'proof', 'upload', 'badge'],
  },
  {
    id: 'verify-certificates',
    category: 'review',
    title: 'How do I verify the certificates students have submitted?',
    who: ['CPDC_ADMIN', 'CAREER_COUNSELOR', 'HEAD_OF_PROGRAMME', 'FACULTY_COORDINATOR', 'SUPER_ADMIN'],
    summary:
      'The verification queue holds every certificate a student has submitted as evidence, oldest first.',
    steps: [
      'Open Learning from the menu and go to the certificate verification queue.',
      'Open the evidence link or file for the first submission.',
      'Check three things: the student\'s name on the certificate, the course title, and the issuing provider.',
      'Accept the submission if all three match.',
      'Return it for more evidence if anything is unclear, and write what is missing. The student sees the note you write, so make it specific.',
    ],
    result:
      'Accepting adds the certificate to the student\'s verified record, their CV and their profile. Returning it leaves the record unchanged and asks the student to resubmit.',
    href: '/learning',
    hrefLabel: 'Open the queue',
    keywords: ['queue', 'verification', 'approve certificate', 'evidence', 'reject'],
  },
  {
    id: 'publish-workshop',
    category: 'run',
    title: 'How do I publish a workshop for students to book?',
    who: ['CPDC_ADMIN', 'CAREER_COUNSELOR', 'PLACEMENT_OFFICER', 'FACULTY_COORDINATOR', 'HEAD_OF_PROGRAMME', 'SUPER_ADMIN'],
    summary: 'Publishing a workshop makes it visible and bookable to the students it applies to.',
    steps: [
      'Open Workshops from the menu and find the option to publish a workshop.',
      'Write a title that says what a student will be able to do afterwards, not the internal project name.',
      'Write a short description of what the session covers.',
      'Enter the speaker or facilitator, the date and time, the venue or online link, and the number of seats.',
      'Check the date and time twice before you publish. Students book against what you enter here.',
      'Press publish.',
    ],
    result:
      'The session appears immediately for eligible students and they can start booking. On the day, display the check-in QR code so attendance is recorded.',
    href: '/workshops',
    hrefLabel: 'Open Workshops',
    keywords: ['create event', 'publish', 'schedule', 'seats', 'venue', 'organiser'],
  },

  // ----------------------------------------------------------------- jobs ---
  {
    id: 'find-jobs',
    category: 'jobs',
    title: 'How do I find and apply for a job or internship?',
    who: ['STUDENT', 'ALUMNI'],
    summary:
      'The Employers area lists roles posted by employers who are specifically looking at QIU students.',
    steps: [
      'Open Employers from the menu.',
      'Filter the list by the type of role you want, for example internship or graduate.',
      'Open a role and read what it asks for.',
      'Check your CV is up to date before you apply, because your CV is what gets sent.',
      'Press apply.',
    ],
    result:
      'Your application goes to that employer with your CV and, if you have published one, your final-year project. You can see the status of what you have applied for on the same screen.',
    href: '/employers',
    hrefLabel: 'Open Employers',
    keywords: ['job', 'vacancy', 'internship', 'apply', 'application', 'graduate role'],
  },
  {
    id: 'post-vacancy',
    category: 'jobs',
    title: 'How do I post a vacancy? (employers)',
    who: ['EMPLOYER'],
    summary: 'Posting a vacancy puts your role in front of QIU students and recent graduates.',
    steps: [
      'Open Employers from the menu.',
      'Press the option to post a vacancy.',
      'Choose the type of role: internship, graduate or part-time.',
      'Write the title, what the person will do, and what you need them to already know.',
      'Press post.',
      'Come back to the same screen to see who has applied.',
    ],
    result:
      'The vacancy is visible to eligible students straight away and stays there until you remove it. Applicants appear on the vacancy with their CV.',
    href: '/employers',
    hrefLabel: 'Open Employers',
    keywords: ['post job', 'vacancy', 'hiring', 'recruit', 'advertise', 'applicants'],
  },
  {
    id: 'browse-talent',
    category: 'jobs',
    title: 'How do I find students to hire? (employers)',
    who: ['EMPLOYER', 'ALUMNI'],
    summary:
      'The Talent Feed shows student projects that the student chose to publish and a QIU coordinator approved.',
    steps: [
      'Open Talent Feed from the menu.',
      'Filter by faculty or by the skills you need.',
      'Open a project to read what the student built and which tools they used.',
      'Press the option to invite the student to interview.',
      'Write what the next step is and roughly when. A vague invitation gets a vague response.',
    ],
    result:
      'Your invitation goes through CPDC rather than straight to the student, so the university can support the student through the process. Every student in this feed has opted in — nobody appears here without choosing to.',
    href: '/talent',
    hrefLabel: 'Open Talent Feed',
    keywords: ['talent', 'candidates', 'search students', 'invite', 'interview', 'hire'],
  },
  {
    id: 'employer-host-workshop',
    category: 'jobs',
    title: 'How do I offer to run a session for students? (employers)',
    who: ['EMPLOYER', 'ALUMNI'],
    summary:
      'Employers and alumni can offer to host a workshop. CPDC schedules it rather than you publishing it directly.',
    steps: [
      'Open Workshops from the menu.',
      'Press the option to request hosting a session.',
      'Write what students will be able to do after attending.',
      'Say roughly when you are available and whether it is in person or online.',
      'Press send.',
    ],
    result:
      'Your request goes to CPDC. They will confirm the details and publish the session, so it does not appear to students until they do.',
    href: '/workshops',
    hrefLabel: 'Open Workshops',
    keywords: ['host', 'guest speaker', 'employer session', 'offer', 'talk'],
  },

  // --------------------------------------------------------------- people ---
  {
    id: 'find-mentor',
    category: 'people',
    title: 'How do I find an alumni mentor?',
    who: ['STUDENT'],
    summary:
      'Alumni are QIU graduates who volunteered to advise current students. Most are glad to be asked.',
    steps: [
      'Open Network from the menu.',
      'Filter by industry, role or faculty to find graduates doing the kind of work you want.',
      'Open a profile and read their background before you write anything.',
      'Press to send a connection request, and write a short note saying who you are and what you want to ask. A blank request cannot be sent.',
      'Wait for them to accept. If they do not reply within a week, ask someone else rather than sending a second message.',
    ],
    result:
      'The mentor sees your note and your public profile. Once they accept, you can book one of their available mentoring slots.',
    href: '/network',
    hrefLabel: 'Open Network',
    keywords: ['alumni', 'mentor', 'networking', 'connect', 'advice', 'coffee chat'],
  },
  {
    id: 'book-mentor-slot',
    category: 'people',
    title: 'How do I book time with a mentor?',
    who: ['STUDENT'],
    summary: 'Mentors publish the times they are free. You choose one and say what you want to talk about.',
    steps: [
      'Open Network and go to the mentor\'s profile.',
      'Press to book a mentoring slot.',
      'Choose a time from the list of slots they have made available.',
      'Write the one topic you want advice on. One clear question is worth more than a general request for help.',
      'Press to confirm the booking.',
    ],
    result:
      'The mentor is notified with your topic. Turn up on time — a missed slot is a slot another student could have used.',
    href: '/network',
    hrefLabel: 'Open Network',
    keywords: ['booking', 'slot', 'meeting', 'mentorship', 'appointment'],
  },
  {
    id: 'alumni-mentoring',
    category: 'people',
    title: 'How do I mentor students? (alumni)',
    who: ['ALUMNI'],
    summary:
      'As a verified graduate you can offer advice, publish times you are free, and see the projects students have published.',
    steps: [
      'Open Network from the menu.',
      'Check your own profile shows your current industry and role, so students can tell whether you are the right person to ask.',
      'Set the times you are willing to be booked for.',
      'Read incoming connection requests and accept the ones you can genuinely help with.',
      'Open Talent Feed to see what current students are building.',
    ],
    result:
      'Students can only book the times you publish. You are never obliged to accept a request, and declining does not notify the student of a reason.',
    href: '/network',
    hrefLabel: 'Open Network',
    keywords: ['alumni', 'give back', 'mentor', 'availability', 'requests'],
  },

  // --------------------------------------------------------------- review ---
  {
    id: 'approve-fyp',
    category: 'review',
    title: 'How do I approve a student\'s final-year project?',
    who: ['FACULTY_COORDINATOR', 'HEAD_OF_PROGRAMME', 'CPDC_ADMIN', 'SUPER_ADMIN'],
    summary:
      'A project stays private until you approve it. Your approval is what allows it to reach employers.',
    steps: [
      'Open FYP or Admin from the menu, depending on your role, and find the submissions waiting for review.',
      'Open a submission and read the title, description and poster.',
      'Check it is the student\'s own work and that nothing confidential from a partner organisation is included.',
      'Check the skills and tools listed are accurate, because employers search on those words.',
      'Approve it, or return it with a note saying what needs changing.',
    ],
    result:
      'Approving publishes the project to the student\'s CV, and to the Talent Feed if the student opted in. Returning it leaves it private and tells the student what to fix.',
    href: '/admin',
    hrefLabel: 'Open Admin',
    keywords: ['fyp approval', 'project review', 'coordinator', 'publish', 'return'],
  },
  {
    id: 'student-oversight',
    category: 'review',
    title: 'How do I see which students need help?',
    who: ['HEAD_OF_PROGRAMME', 'FACULTY_COORDINATOR', 'ACADEMIC_SUPERVISOR', 'PLACEMENT_OFFICER', 'CPDC_ADMIN', 'SUPER_ADMIN'],
    summary:
      'The Admin control centre lists the students in your scope who are furthest behind, with the suggested next step for each.',
    steps: [
      'Open Admin from the menu.',
      'Read the list of students needing employability support. It is already limited to the students you are responsible for.',
      'Use the faculty filter if your scope covers more than one.',
      'Open a student to see their readiness figure and the recommended next action.',
      'Contact the student, or hand the case to the right colleague, and record what you did.',
    ],
    result:
      'What you can see is decided by your role: an Academic Supervisor sees assigned mentees, a Faculty Coordinator sees their faculty, and CPDC roles see the university. Opening a record is logged.',
    href: '/admin',
    hrefLabel: 'Open Admin',
    keywords: ['at risk', 'oversight', 'analytics', 'readiness', 'intervention', 'support'],
  },
  {
    id: 'registrar-clearance',
    category: 'review',
    title: 'How do I check a student\'s record for clearance? (Registrar)',
    who: ['UNIVERSITY_REGISTRAR'],
    summary:
      'The Registrar view exists to confirm what a student has actually completed and verified, for clearance and transcript purposes.',
    steps: [
      'Open Admin from the menu.',
      'Find the student whose record you are clearing.',
      'Open Logbook to check the approved placement hours against what their programme requires. Only approved hours count.',
      'Open My CV for that student to see the verified achievements on record.',
      'Record your decision in the university\'s own clearance process. This platform is the evidence, not the register of the decision.',
    ],
    result:
      'Every record you open is written to the audit log. You have a read-only view of academic evidence — you do not change student submissions from here.',
    href: '/admin',
    hrefLabel: 'Open Admin',
    keywords: ['registrar', 'clearance', 'transcript', 'graduation', 'verify hours', 'audit'],
  },

  // ------------------------------------------------------------------ run ---
  {
    id: 'manage-roles',
    category: 'run',
    title: 'How do I change what someone is allowed to see?',
    who: ['SUPER_ADMIN'],
    summary:
      'A person\'s role decides which parts of the platform they can open. Changing a role changes their access immediately.',
    steps: [
      'Open Admin from the menu and go to the identity section.',
      'Find the person by name or email address.',
      'Read what their current role allows before you change it.',
      'Choose the new role, and choose the narrowest role that still lets them do their job.',
      'Save the change and tell the person, because their menu will look different the next time they sign in.',
    ],
    result:
      'The change takes effect at once. It is recorded in the audit log with your name against it.',
    href: '/admin',
    hrefLabel: 'Open Admin',
    keywords: ['roles', 'permissions', 'access', 'identity', 'assign', 'admin'],
  },
  {
    id: 'feature-toggles',
    category: 'run',
    title: 'How do I turn a whole area on or off for everyone?',
    who: ['SUPER_ADMIN'],
    summary:
      'Each area of the platform can be hidden university-wide, so a faculty can pilot something before everyone gets it.',
    steps: [
      'Open Settings from the menu.',
      'Find the section listing the platform areas.',
      'Turn an area off to hide it from every menu and block its web address.',
      'Tell the staff who use that area before you turn it off, not afterwards.',
      'Turn it back on to restore it. Nothing is deleted while an area is switched off.',
    ],
    result:
      'Students and staff stop seeing the area on their next page load. Data that was already recorded stays exactly where it is.',
    href: '/settings',
    hrefLabel: 'Open Settings',
    keywords: ['feature toggle', 'enable', 'disable', 'hide module', 'pilot', 'rollout'],
  },
  {
    id: 'employer-verification',
    category: 'run',
    title: 'How do I approve a new employer partner?',
    who: ['CPDC_ADMIN', 'SUPER_ADMIN'],
    summary:
      'Only verified employers reach students. Verification is what stops the Talent Feed becoming a mailing list.',
    steps: [
      'Open Admin from the menu and find the employer records.',
      'Check the organisation is real and that the contact works there.',
      'Approve the employer if the checks pass.',
      'Leave it unapproved and note why if anything does not add up.',
    ],
    result:
      'An approved employer can post vacancies and browse the Talent Feed. An unapproved one can do neither.',
    href: '/admin',
    hrefLabel: 'Open Admin',
    keywords: ['employer', 'verify', 'partner', 'company', 'approve', 'vetting'],
  },

  // -------------------------------------------------------------- account ---
  {
    id: 'update-details',
    category: 'account',
    title: 'How do I change my details?',
    who: [...ALL_STUDENT_FACING, 'ALUMNI', 'EMPLOYER', ...ALL_STAFF],
    summary: 'Settings holds everything about you that the platform shows to other people.',
    steps: [
      'Open Settings from the menu.',
      'Change the fields you need to change.',
      'Press save at the bottom of that section. Changes are not kept until you save.',
      'Reload the page if you want to confirm the change stuck.',
    ],
    result:
      'Saved changes apply everywhere immediately, including anywhere your profile is already visible to others.',
    href: '/settings',
    hrefLabel: 'Open Settings',
    keywords: ['settings', 'profile', 'edit', 'change details', 'name', 'photo'],
  },
  {
    id: 'privacy',
    category: 'account',
    title: 'What does the platform know about me, and who sees it?',
    who: ['STUDENT', 'ALUMNI'],
    summary:
      'The platform holds your academic record, your career activity and what you have chosen to publish. Different people see different parts.',
    steps: [
      'Open Settings and read the visibility section to see what is public.',
      'Understand the three layers: what only you see, what QIU staff responsible for you see, and what employers see.',
      'Remember that staff in your faculty can see your progress because supporting and assessing you requires it. You cannot switch that off.',
      'Remember that employers see only what you opted in to publish, and only after a coordinator approved it.',
      'Open the privacy page for the full written statement.',
    ],
    result:
      'Turning off employer visibility takes effect at once. Records that staff need for assessment remain, as they would on paper.',
    href: '/privacy',
    hrefLabel: 'Read the privacy statement',
    keywords: ['privacy', 'data', 'gdpr', 'who sees', 'personal information', 'visibility'],
  },
  {
    id: 'replay-tour',
    category: 'account',
    title: 'How do I see the welcome tour again?',
    who: [...ALL_STUDENT_FACING, 'ALUMNI', 'EMPLOYER', ...ALL_STAFF],
    summary: 'The short tour you saw the first time you signed in can be replayed whenever you want.',
    steps: [
      'Open Help from the menu.',
      'Press the button at the top labelled Show me around again.',
      'Step through it with Next, or press Skip to leave at any point.',
    ],
    result: 'Replaying the tour changes nothing about your record. It is only a walkthrough.',
    href: '/help',
    hrefLabel: 'You are here',
    keywords: ['tour', 'walkthrough', 'onboarding', 'again', 'replay', 'intro'],
  },
];

/**
 * Per-role "start here" content, used by the help centre and the first-login
 * tour. Every one of the eleven account roles has an entry, plus the
 * account-less workplace supervisor.
 *
 * Fields:
 *   whoYouAre  — one sentence describing the role in plain words.
 *   firstSteps — what to do in the first five minutes, in order.
 *   keyScreens — the handful of menu items that matter most, and why.
 *   scopeNote  — what this role can and cannot see, said plainly.
 */
export const ROLE_GUIDES = {
  STUDENT: {
    whoYouAre:
      'You are studying at QIU. This platform records what you do for your career alongside your degree, and turns it into a CV you can send to employers.',
    firstSteps: [
      'Open Settings and check your faculty and programme are right.',
      'Add one or two career targets, so the platform knows what to recommend.',
      'Open Diagnostics and take the short skills test for your faculty.',
      'Open Workshops and register for the first session your results suggest.',
      'Open My CV to see the draft that is already being built for you.',
    ],
    keyScreens: [
      { href: '/dashboard', label: 'Dashboard', why: 'Shows the single next thing to do.' },
      { href: '/career-path', label: 'Career Path', why: 'What to do in each year of your degree.' },
      { href: '/logbook', label: 'Logbook', why: 'Where you add placement hours for supervisor approval.' },
      { href: '/cv', label: 'My CV', why: 'Your CV, built from verified activity, exportable as a PDF.' },
      { href: '/employers', label: 'Employers', why: 'Jobs and internships from employers hiring QIU students.' },
    ],
    scopeNote:
      'You see your own record only. Staff at your faculty can see your progress because they support and assess you. Employers see only what you choose to publish and a coordinator approves.',
  },
  ALUMNI: {
    whoYouAre:
      'You graduated from QIU. You are here to advise current students, keep learning, and stay connected to the university.',
    firstSteps: [
      'Open Settings and add your current industry and job role, so students can tell whether you are the right person to ask.',
      'Open Network and publish the times you are willing to be booked for.',
      'Read the connection requests waiting for you.',
      'Open Talent Feed to see what current students are building.',
    ],
    keyScreens: [
      { href: '/network', label: 'Network', why: 'Mentoring requests and your availability.' },
      { href: '/talent', label: 'Talent Feed', why: 'Student projects that were published for outside viewers.' },
      { href: '/workshops', label: 'Workshops', why: 'Sessions you can attend or offer to host.' },
      { href: '/learning', label: 'Learning', why: 'Courses you can take and have verified.' },
    ],
    scopeNote:
      'You see published student work and the students who contact you. You do not see academic records, grades or placement hours.',
  },
  HEAD_OF_PROGRAMME: {
    whoYouAre:
      'You lead a programme. You are accountable for whether the students on it are ready for work when they graduate.',
    firstSteps: [
      'Open Admin and read the list of students needing employability support in your programme.',
      'Open Logbook and check how many placement entries are still waiting on a workplace supervisor.',
      'Open FYP and clear any final-year projects waiting for approval.',
      'Open Workshops to see what is scheduled for your students this term.',
    ],
    keyScreens: [
      { href: '/admin', label: 'Admin', why: 'Programme-level view of who is falling behind.' },
      { href: '/career-path', label: 'Career Path', why: 'The year-by-year path your students are following.' },
      { href: '/logbook', label: 'Logbook', why: 'Placement hours across your programme.' },
      { href: '/talent', label: 'Talent Feed', why: 'What your programme is showing employers.' },
    ],
    scopeNote:
      'You see students on your programme. You do not see other programmes, and every record you open is logged.',
  },
  FACULTY_COORDINATOR: {
    whoYouAre:
      'You are the academic lead for a faculty. You approve student work and keep your faculty\'s students moving.',
    firstSteps: [
      'Open Admin and check the queue of items waiting for your decision.',
      'Open FYP and review the final-year projects submitted by your faculty.',
      'Open Learning and clear the certificate verification queue.',
      'Open Logbook and chase the placement entries that have been pending longest.',
    ],
    keyScreens: [
      { href: '/admin', label: 'Admin', why: 'Your approval queue and faculty overview.' },
      { href: '/logbook', label: 'Logbook', why: 'Placement hours across your faculty.' },
      { href: '/workshops', label: 'Workshops', why: 'Sessions for your faculty, and publishing new ones.' },
      { href: '/talent', label: 'Talent Feed', why: 'What you have approved for employers to see.' },
    ],
    scopeNote:
      'Your view is limited to the faculty you are set to. Approving a final-year project is what makes it visible outside QIU, so check it before you approve.',
  },
  ACADEMIC_SUPERVISOR: {
    whoYouAre:
      'You supervise a specific group of students through their internship or fieldwork. Your view is deliberately small.',
    firstSteps: [
      'Open Admin and read the list of students assigned to you.',
      'Open Logbook and look at each student\'s placement entries.',
      'Note which entries have been waiting longest on a workplace supervisor, and tell those students to follow up.',
      'Check each student\'s total approved hours against what their programme requires.',
    ],
    keyScreens: [
      { href: '/admin', label: 'Admin', why: 'The students assigned to you.' },
      { href: '/logbook', label: 'Logbook', why: 'Their placement hours and approval status.' },
      { href: '/workshops', label: 'Workshops', why: 'Sessions you can point your students towards.' },
    ],
    scopeNote:
      'You see only your assigned students. Approval of placement hours comes from the workplace supervisor who saw the work, not from you.',
  },
  PLACEMENT_OFFICER: {
    whoYouAre:
      'You arrange industrial training placements and make sure the hours students work are properly recorded and approved.',
    firstSteps: [
      'Open Logbook and find every entry still waiting for a workplace supervisor.',
      'Check the ones that have waited longest, and find out whether the supervisor\'s email address was wrong.',
      'Open Employers to see which organisations are currently offering placements.',
      'Open Admin to see which students have no placement activity at all yet.',
    ],
    keyScreens: [
      { href: '/logbook', label: 'Logbook', why: 'Every placement entry in your faculty and its approval status.' },
      { href: '/employers', label: 'Employers', why: 'Partner organisations and the roles they are offering.' },
      { href: '/admin', label: 'Admin', why: 'Students with no placement progress.' },
      { href: '/workshops', label: 'Workshops', why: 'Pre-placement briefings and employer sessions.' },
    ],
    scopeNote:
      'You see placement activity for your faculty. A workplace supervisor never gets an account — they approve through a single expiring link, so a wrong email address is the usual reason an approval never arrives.',
  },
  CPDC_ADMIN: {
    whoYouAre:
      'You are career services staff. You run the workshops, verify the evidence, approve employers, and keep the whole thing moving.',
    firstSteps: [
      'Open Admin and read the operational queue of what needs attention today.',
      'Open Learning and clear the certificate verification queue.',
      'Open Workshops and check this week\'s sessions have a date, a venue and enough seats.',
      'Open Employers and approve or reject any organisation waiting for verification.',
    ],
    keyScreens: [
      { href: '/admin', label: 'Admin', why: 'The university-wide operational queue and analytics.' },
      { href: '/workshops', label: 'Workshops', why: 'Publishing sessions and running check-in.' },
      { href: '/learning', label: 'Learning', why: 'Verifying student certificates.' },
      { href: '/employers', label: 'Employers', why: 'Employer verification and vacancies.' },
      { href: '/logbook', label: 'Logbook', why: 'Placement approvals across the university.' },
    ],
    scopeNote:
      'You see students across the university. That access is logged, and it exists so you can support students — not to browse.',
  },
  CAREER_COUNSELOR: {
    whoYouAre:
      'You do the one-to-one work: CV reviews, mock interviews and helping students work out what they are aiming at.',
    firstSteps: [
      'Open Admin to see which students have been flagged as needing support.',
      'Open My CV to look at a student\'s CV before a review session, so you arrive prepared.',
      'Open Diagnostics to see what a student\'s skills test actually said.',
      'Open Workshops and check the sessions you can refer a student to this month.',
    ],
    keyScreens: [
      { href: '/admin', label: 'Admin', why: 'Students flagged as needing career support.' },
      { href: '/cv', label: 'CV review', why: 'The CV a student would send to an employer.' },
    { href: '/ai-suite', label: 'Interview Practice', why: 'The timed interview practice tool you can set students.' },
      { href: '/diagnostics', label: 'Diagnostics', why: 'The skills tests and what the results mean.' },
    ],
    scopeNote:
      'You can see student career records across the university, and every record you open is logged. Coaching notes belong in your own case records, not in the student\'s public profile.',
  },
  UNIVERSITY_REGISTRAR: {
    whoYouAre:
      'You handle academic clearance and transcripts. You use this platform as evidence of what a student completed, not as a place to change it.',
    firstSteps: [
      'Open Admin and find the student you are clearing.',
      'Open Logbook and check their approved placement hours. Pending hours do not count.',
      'Open My CV for that student to see the verified achievements on record.',
      'Record your decision in the university\'s own clearance process.',
    ],
    keyScreens: [
      { href: '/admin', label: 'Admin', why: 'Finding a student record.' },
      { href: '/logbook', label: 'Logbook', why: 'Approved placement hours, the figure clearance depends on.' },
      { href: '/cv', label: 'CV', why: 'The verified achievement record.' },
    ],
    scopeNote:
      'Your view is read-only academic evidence across the university. Every record you open is written to the audit log.',
  },
  SUPER_ADMIN: {
    whoYouAre:
      'You govern the platform itself: who has which role, which areas are switched on, and whether the audit trail is intact.',
    firstSteps: [
      'Open Admin and review the identity list for anyone holding more access than their job needs.',
      'Read the recent audit activity for anything unexpected.',
      'Open Settings and confirm the areas that should be switched on are on.',
      'Check that every faculty has at least one coordinator who can approve student work.',
    ],
    keyScreens: [
      { href: '/admin', label: 'Admin', why: 'Roles, identity and the audit log.' },
      { href: '/settings', label: 'Settings', why: 'Switching whole areas on or off.' },
    ],
    scopeNote:
      'You can see everything, which is exactly why your actions are logged. Give people the narrowest role that lets them do their job.',
  },
  EMPLOYER: {
    whoYouAre:
      'You represent an organisation that hires QIU students and graduates. You post roles and find candidates.',
    firstSteps: [
      'Open Settings and check your organisation name and contact details are right.',
      'Open Employers and post your first vacancy.',
      'Open Talent Feed and filter for the skills you need.',
      'Invite a student to interview through the platform, so CPDC can support them through it.',
    ],
    keyScreens: [
      { href: '/employers', label: 'Employers', why: 'Posting vacancies and seeing who applied.' },
      { href: '/talent', label: 'Talent Feed', why: 'Student projects, published with the student\'s consent.' },
      { href: '/workshops', label: 'Workshops', why: 'Offering to run a session for students.' },
    ],
    scopeNote:
      'You see only what students opted in to publish and a QIU coordinator approved. You cannot see grades, contact details or any student who has not opted in.',
  },
  EXTERNAL_SUPERVISOR: {
    whoYouAre:
      'You supervise a QIU student at your workplace. You have no account here and you do not need one.',
    firstSteps: [
      'Wait for the email from QIU that arrives when your student submits their hours.',
      'Open the link in that email.',
      'Read the entry: the date, the hours and what the student says they did.',
      'Press Approve if it is accurate, or reply to the student if it is not.',
    ],
    keyScreens: [],
    scopeNote:
      'The link works once and then expires. It shows you one entry from one student and gives you no other access to QIU systems.',
  },
};

/**
 * Words the platform uses that a newcomer would not know. Every one of these
 * should also be glossed the first time it appears in the interface.
 */
export const GLOSSARY = [
  { term: 'ATS', plain: 'The software employers use to scan CVs before a person reads them. It cannot read a picture of text, which is why your CV is exported as real, selectable text.' },
  { term: 'Badge', plain: 'A small marker on your profile showing you completed something specific, such as a diagnostic or a verified course.' },
  { term: 'CPDC', plain: 'The QIU Career and Professional Development Centre — the university team that runs this platform, the workshops and the employer partnerships.' },
  { term: 'Career Path', plain: 'A year-by-year list of the career things to do during your degree, tailored to your faculty.' },
  { term: 'Check-in', plain: 'Scanning the code at a workshop to record that you were actually there. Booking a place is not the same as attending.' },
  { term: 'Diagnostic', plain: 'A short skills test whose only job is to point you at the right workshops.' },
  { term: 'FYP', plain: 'Your Final Year Project — the major piece of work you produce in your last year.' },
  { term: 'Logbook', plain: 'The official record of the hours you worked on placement or internship, approved by your workplace supervisor.' },
  { term: 'Magic link', plain: 'A one-time web link sent by email that lets someone do one specific thing without creating an account. It stops working after it is used.' },
  { term: 'Module', plain: 'One area of this platform, such as Logbook or Workshops. It does not mean a taught module on your degree.' },
  { term: 'QR code', plain: 'The square black-and-white pattern you point a phone camera at. Used to check in at workshops.' },
  { term: 'Role', plain: 'What kind of account you have. Your role decides which parts of the platform you can open.' },
  { term: 'Scope', plain: 'How much a staff member is allowed to see — their own mentees, their programme, their faculty, or the whole university.' },
  { term: 'Talent Feed', plain: 'The list of student projects that employers can browse. Students appear only if they opted in and a coordinator approved the project.' },
  { term: 'Verified', plain: 'Checked by a person at QIU. Only verified activity reaches your CV, which is what makes the CV worth something.' },
  { term: 'XP', plain: 'Points you earn for career activities such as attending a workshop or completing a diagnostic. They track your effort over time.' },
];

/**
 * The problems people actually hit. Each one says what to do, not only what is
 * wrong.
 */
export const TROUBLESHOOTING = [
  {
    id: 'cannot-sign-in',
    problem: 'I cannot sign in.',
    who: [...ALL_STUDENT_FACING, 'ALUMNI', 'EMPLOYER', ...ALL_STAFF],
    steps: [
      'Check that you selected the Google account the university registered for you.',
      'Check you are using the university-registered address, not a different personal Google account.',
      'Sign out of the wrong Google account in another tab, then press Continue with Google again.',
      `Contact ${CONTACT_PLACEHOLDER} if it still fails. Do not create a second account — your record is attached to the first one.`,
    ],
  },
  {
    id: 'assessment-import-failed',
    problem: 'My assessment file could not be imported.',
    who: ['HEAD_OF_PROGRAMME', 'FACULTY_COORDINATOR', 'ACADEMIC_SUPERVISOR', 'CPDC_ADMIN', 'SUPER_ADMIN'],
    steps: [
      'Check that the file is PDF, Word (.doc or .docx), or UTF-8 text and under 8 MB.',
      'Check that each question is numbered and has options on separate A., B., C. or D. lines.',
      'Add an explicit Answer: A line for every question. The platform never guesses an answer key.',
      'If the PDF is a photograph or scan with no selectable text, run OCR first and upload the text-searchable copy.',
      'Try the import again, then read the draft before publishing it.',
    ],
  },
  {
    id: 'menu-item-missing',
    problem: 'A menu item someone told me about is not there.',
    who: [...ALL_STUDENT_FACING, 'ALUMNI', 'EMPLOYER', ...ALL_STAFF],
    steps: [
      'Check your role at the top of this page. Each role sees a different menu on purpose.',
      'Ask the person who told you about it which role they have.',
      `Contact ${CONTACT_PLACEHOLDER} if you believe your role is wrong for your job.`,
    ],
  },
  {
    id: 'supervisor-no-email',
    problem: 'My workplace supervisor never got the approval email.',
    who: ['STUDENT', 'PLACEMENT_OFFICER', 'ACADEMIC_SUPERVISOR'],
    steps: [
      'Ask them to check their spam or junk folder.',
      'Open Logbook and read back the email address on the entry, character by character.',
      `Ask ${CONTACT_PLACEHOLDER} to send a fresh request if the address was wrong or the link has expired.`,
    ],
  },
  {
    id: 'attendance-missing',
    problem: 'I attended a workshop but it is not on my record.',
    who: ['STUDENT', 'ALUMNI'],
    steps: [
      'Check whether you scanned the check-in code on the day. Booking a place does not record attendance.',
      'Tell the person who ran the session, as they hold the attendance list.',
      'Scan on the day next time, before you leave the room.',
    ],
  },
  {
    id: 'certificate-returned',
    problem: 'My certificate was returned for more evidence.',
    who: ['STUDENT', 'ALUMNI'],
    steps: [
      'Read the note on the returned submission — it says what was missing.',
      'Check the certificate shows your full name, the course title and the provider.',
      'Check the link opens for someone who is not signed in to your account.',
      'Submit it again with the better evidence.',
    ],
  },
  {
    id: 'cv-empty',
    problem: 'My CV looks empty.',
    who: ['STUDENT'],
    steps: [
      'Remember that only verified activity appears. A new account has nothing to show yet.',
      'Take the diagnostic, attend one workshop and check in, and the CV starts filling itself.',
      'Add your own summary paragraph in the meantime so the page is not blank when you export it.',
    ],
  },
  {
    id: 'page-blank',
    problem: 'A page is blank or stuck loading.',
    who: [...ALL_STUDENT_FACING, 'ALUMNI', 'EMPLOYER', ...ALL_STAFF],
    steps: [
      'Reload the page once.',
      'Check your internet connection.',
      'Sign out and sign back in.',
      `Report it to ${CONTACT_PLACEHOLDER} with the name of the page and the time it happened, if it keeps failing.`,
    ],
  },
  {
    id: 'wrong-faculty',
    problem: 'Everything is showing the wrong faculty or programme.',
    who: ['STUDENT'],
    steps: [
      'Open Settings and check the faculty and programme fields.',
      'Correct them and save.',
      `Contact ${CONTACT_PLACEHOLDER} if the correct option is not offered — your record may need changing centrally.`,
    ],
  },
  {
    id: 'remove-from-employers',
    problem: 'I want employers to stop seeing my profile.',
    who: ['STUDENT', 'ALUMNI'],
    steps: [
      'Open Settings and go to the visibility section.',
      'Turn off the option that lists you in the Talent Feed, and save.',
      'Understand that QIU staff responsible for you can still see your record, because they need it to support and assess you.',
    ],
  },
];

/**
 * The first-login tour, per role. Every role gets a welcome step and three or
 * four steps naming things that role actually has. `href` deep-links the step
 * to the screen it describes.
 */
export const TOUR_STEPS = {
  STUDENT: [
    { id: 'welcome', title: 'Welcome to QIU Career Hub', summary: 'This is where your career record lives while you study.', detail: 'Everything you do for your career — workshops, placement hours, your final-year project — is recorded here, and a CV is built from it. You do not have to remember any of it yourself.' },
    { id: 'dashboard', title: 'Start with one thing', summary: 'The Dashboard always shows a single next best action.', detail: 'You never have to work out your own to-do list. Open the Dashboard, do the one thing it suggests, and come back for the next one.', href: '/dashboard' },
    { id: 'workshops', title: 'Attend and check in', summary: 'Book a workshop, then scan the code on the day.', detail: 'Booking holds your seat. Scanning the code in the room is what records that you attended, and attendance is what reaches your CV.', href: '/workshops' },
    { id: 'logbook', title: 'Log your placement hours', summary: 'Add hours as you work them, and your supervisor approves by email.', detail: 'Your workplace supervisor needs no account. They get a one-time link and press Approve. Approved hours count towards your programme and appear on your CV.', href: '/logbook' },
    { id: 'cv', title: 'Your CV builds itself', summary: 'Verified activity becomes an employer-ready PDF.', detail: 'Open My CV whenever you like. Write your own summary paragraph, and let the rest fill in as you earn it. Open Help from the menu for step-by-step guides.', href: '/cv' },
  ],
  ALUMNI: [
    { id: 'welcome', title: 'Welcome back to QIU', summary: 'You are here as a graduate who can help students who are where you were.', detail: 'You choose how much you do. Publish some free times, answer the requests you can genuinely help with, and ignore the rest.' },
    { id: 'network', title: 'Set your availability', summary: 'Students can only book times you have published.', detail: 'Open Network, add the slots you are willing to be booked for, and add your current role so students can tell whether to ask you.', href: '/network' },
    { id: 'talent', title: 'See what students are building', summary: 'The Talent Feed shows projects students chose to publish.', detail: 'Every project here was published by the student and approved by a coordinator. It is a good way to find someone worth mentoring.', href: '/talent' },
    { id: 'workshops', title: 'Offer a session', summary: 'You can volunteer to run a workshop for current students.', detail: 'Open Workshops and send a request. CPDC will confirm the details and schedule it.', href: '/workshops' },
  ],
  EMPLOYER: [
    { id: 'welcome', title: 'Welcome to the QIU employer area', summary: 'Post roles and find QIU students who chose to be found.', detail: 'Every student you can see here opted in to be visible to employers, and a QIU coordinator approved what is shown. Nobody appears without consenting.' },
    { id: 'vacancy', title: 'Post a vacancy', summary: 'Your role goes in front of eligible students straight away.', detail: 'Open Employers, choose the type of role, describe the work, and post. Applicants appear on the same screen with their CV.', href: '/employers' },
    { id: 'talent', title: 'Find candidates', summary: 'The Talent Feed lets you search by faculty and by skill.', detail: 'Open a project to see what the student actually built and which tools they used, then invite them to interview.', href: '/talent' },
    { id: 'process', title: 'Invitations go through CPDC', summary: 'The university supports the student through your process.', detail: 'Your invitation reaches the student via CPDC rather than a direct message, so nobody is approached without support.', href: '/talent' },
  ],
  HEAD_OF_PROGRAMME: [
    { id: 'welcome', title: 'Welcome to your programme workspace', summary: 'Your view covers the students on your programme.', detail: 'This is where you see who is falling behind on career readiness, and clear the approvals that are blocking students.' },
    { id: 'admin', title: 'See who needs help', summary: 'Admin lists your students in order of who needs support most.', detail: 'Each student shows a readiness figure and a suggested next step. Opening a record is written to the audit log.', href: '/admin' },
    { id: 'logbook', title: 'Watch the placement approvals', summary: 'Entries waiting on a workplace supervisor are the usual bottleneck.', detail: 'A wrong supervisor email address is the most common cause of a stalled entry. Chase the oldest pending entries first.', href: '/logbook' },
    { id: 'fyp', title: 'Approve final-year projects', summary: 'A project stays private until it is approved.', detail: 'Your approval is what allows a project to reach employers, so check the content and the listed skills before approving.', href: '/fyp' },
  ],
  FACULTY_COORDINATOR: [
    { id: 'welcome', title: 'Welcome to your faculty workspace', summary: 'Your view is limited to the faculty you are set to.', detail: 'That limit is deliberate: you see what you need to support and assess your own students, and nothing else.' },
    { id: 'admin', title: 'Your approval queue', summary: 'Admin shows everything waiting for your decision.', detail: 'Clearing this queue is the single most useful thing you can do here — students are blocked until you decide.', href: '/admin' },
    { id: 'learning', title: 'Verify certificates', summary: 'Students submit evidence of online courses for checking.', detail: 'Check the name, the course title and the provider. If you return a submission, write what is missing — the student reads your note.', href: '/learning' },
    { id: 'logbook', title: 'Placement hours', summary: 'See every entry in your faculty and how long it has waited.', detail: 'Only hours approved by the workplace supervisor count towards a student\'s requirement.', href: '/logbook' },
  ],
  ACADEMIC_SUPERVISOR: [
    { id: 'welcome', title: 'Welcome — your view is your mentees', summary: 'You see the students assigned to you, and nobody else.', detail: 'The platform keeps your view small on purpose, so you are not sifting through students who are not yours.' },
    { id: 'admin', title: 'Your assigned students', summary: 'Admin lists your mentees and where each one is stuck.', detail: 'Use it before a supervision meeting so you arrive knowing what to ask about.', href: '/admin' },
    { id: 'logbook', title: 'Their placement hours', summary: 'Check totals and chase entries waiting on a workplace supervisor.', detail: 'Approval comes from the supervisor at the workplace who saw the work, not from you. Your job is to notice when it has not arrived.', href: '/logbook' },
    { id: 'workshops', title: 'Point them at sessions', summary: 'Workshops shows what is coming up that you can recommend.', detail: 'A specific recommendation from a supervisor does more than a general reminder to attend things.', href: '/workshops' },
  ],
  PLACEMENT_OFFICER: [
    { id: 'welcome', title: 'Welcome to placements', summary: 'You keep placement hours flowing from work done to hours approved.', detail: 'Most problems here are one of two things: a student who has not logged anything, or a supervisor email address with a typo in it.' },
    { id: 'logbook', title: 'The pending list', summary: 'Logbook shows every entry still waiting for approval.', detail: 'Work the oldest first. If an entry has waited weeks, check the supervisor email address before chasing the supervisor.', href: '/logbook' },
    { id: 'employers', title: 'Partner organisations', summary: 'See which organisations are offering placements right now.', detail: 'Use it to match students who have nothing lined up to employers who are actively offering.', href: '/employers' },
    { id: 'admin', title: 'Students with no placement yet', summary: 'Admin flags the students who have logged nothing at all.', detail: 'These are the ones who miss the requirement entirely. They need a conversation, not a reminder email.', href: '/admin' },
  ],
  CPDC_ADMIN: [
    { id: 'welcome', title: 'Welcome to the CPDC control centre', summary: 'Approvals, workshops, employers and student support in one place.', detail: 'Your access covers the whole university. It is logged, and it is there so you can support students.' },
    { id: 'admin', title: 'Today\'s queue', summary: 'Admin opens on what needs attention now.', detail: 'Work the operational queue first — everything in it is blocking somebody.', href: '/admin' },
    { id: 'workshops', title: 'Publish and run sessions', summary: 'Create a workshop, then display the check-in code on the day.', detail: 'Check the date, time, venue and seat count before publishing: students book against exactly what you enter.', href: '/workshops' },
    { id: 'learning', title: 'Verify certificates', summary: 'The verification queue is what makes student records credible.', detail: 'Check the name, course title and provider on each submission before accepting it.', href: '/learning' },
    { id: 'employers', title: 'Approve employers', summary: 'Only verified organisations reach students.', detail: 'An unverified employer cannot post vacancies or browse the Talent Feed.', href: '/employers' },
  ],
  CAREER_COUNSELOR: [
    { id: 'welcome', title: 'Welcome to career counselling', summary: 'The one-to-one work: CVs, interviews and direction.', detail: 'Everything here is preparation for a conversation with a student, not a replacement for it.' },
    { id: 'admin', title: 'Who needs a session', summary: 'Admin flags students who need career support.', detail: 'Open a student before you meet them so you already know what they have and have not done.', href: '/admin' },
    { id: 'cv', title: 'Review a CV', summary: 'See the CV a student would actually send.', detail: 'It is built from verified activity, so a thin CV usually means a thin record rather than bad writing.', href: '/cv' },
    { id: 'ai-suite', title: 'Set interview practice', summary: 'Interview Practice runs timed questions with a rules-based self-review.', detail: 'Students can practise between sessions with you, which makes your time with them more useful.', href: '/ai-suite' },
  ],
  UNIVERSITY_REGISTRAR: [
    { id: 'welcome', title: 'Welcome, Registrar', summary: 'This platform is evidence for clearance, not the clearance register itself.', detail: 'Your view is read-only. You confirm what a student completed here, and record the decision in the university\'s own process.' },
    { id: 'admin', title: 'Find a student', summary: 'Admin is where you look a student record up.', detail: 'Every record you open is written to the audit log, which is what makes this usable as evidence.', href: '/admin' },
    { id: 'logbook', title: 'Check approved hours', summary: 'Only approved placement hours count towards a requirement.', detail: 'Pending entries are hours the workplace supervisor has not confirmed. Do not count them.', href: '/logbook' },
    { id: 'cv', title: 'The verified record', summary: 'A student\'s CV lists only checked achievements.', detail: 'Workshops attended, certificates verified and projects approved all reached the CV through a human check.', href: '/cv' },
  ],
  SUPER_ADMIN: [
    { id: 'welcome', title: 'Welcome to platform governance', summary: 'Roles, switches and the audit trail.', detail: 'You can see everything, which is why everything you do is logged. Give people the narrowest role that lets them work.' },
    { id: 'admin', title: 'Roles and identity', summary: 'Admin is where you change who can see what.', detail: 'A role change takes effect at once, so tell the person — their menu will look different next time they sign in.', href: '/admin' },
    { id: 'settings', title: 'Switch areas on and off', summary: 'Any area can be hidden university-wide.', detail: 'Switching an area off hides it from every menu and blocks its address. Nothing is deleted while it is off.', href: '/settings' },
    { id: 'audit', title: 'Read the audit log', summary: 'Every record opened and every decision made is recorded.', detail: 'Check it regularly. An audit trail nobody reads is not a control.', href: '/admin' },
  ],
};

/** Guides visible to a role, in category order. */
export function guidesForRole(role) {
  if (!role) return GUIDES;
  return GUIDES.filter((guide) => guide.who.includes(role));
}

/** Troubleshooting entries relevant to a role. */
export function troubleshootingForRole(role) {
  if (!role) return TROUBLESHOOTING;
  return TROUBLESHOOTING.filter((item) => item.who.includes(role));
}

/** The tour a role should see, falling back to the student tour. */
export function tourStepsForRole(role) {
  return TOUR_STEPS[role] ?? TOUR_STEPS.STUDENT;
}

/** Free-text match across everything a person might type. */
export function matchesQuery(guide, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    guide.title,
    guide.summary,
    guide.result ?? '',
    ...(guide.steps ?? []),
    ...(guide.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}
