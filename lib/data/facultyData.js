// QIU Career Hub Data Registry — faculty, programme and demo-content fixtures.
//
// QIU is a real university, so everything in here is held to one rule: the
// institutional data (faculties, programme names, codes) should be accurate,
// and every *person, employer and event* is fictional demo content.
//
// Concretely, that means no fixture may name a real company as an alumnus's
// employer, a workshop's host, or a partner. Earlier revisions had invented
// graduates working at Google, Goldman Sachs and Mayo Clinic and bootcamps
// branded "PwC & EY" — which reads as a claimed industry partnership the
// university does not have. Demo organisations are deliberately invented
// (Meridian Cloud, Straits Capital Partners, Northshore Teaching Hospital,
// Bellhaven Deal Advisory). Keep it that way when adding fixtures.
//
// Naming a real firm is fine where it is plainly an *example* rather than a
// claim — e.g. the "e.g. Maybank, Petronas" placeholder on the employer field
// a student fills in themselves.
//
// Real third-party course catalogues (Coursera, edX) are a separate case and
// live in lib/data/courses.js: those titles and providers are genuine.

export const FACULTIES = [
  {
    id: "business",
    name: "Faculty of Business and Management",
    faculty: "Faculty of Business and Management",
    school: "School of Business & Management",
    schools: ["School of Business & Management", "School of Accounting & Finance", "School of Hospitality", "Centre of ACCA"],
    code: "FOB",
    color: "#F59E0B",
    icon: "Briefcase",
    description: "Corporate leadership, financial mastery, global trade, and strategic management.",
    programmes: [
      { name: "Foundation in Business", level: "Foundation" },
      { name: "Diploma in Business Management", level: "Diploma" },
      { name: "Bachelor of Business Administration (Honours)", level: "Bachelor" },
      { name: "Bachelor of Finance (Honours)", level: "Bachelor" },
      { name: "Bachelor of Accountancy (Honours)", level: "Bachelor" },
      { name: "ACCA Foundation in Accountancy (ACCA FIA)", level: "Professional" },
      { name: "ACCA Qualification", level: "Professional" },
      { name: "Master of Business Administration (MBA)", level: "Postgraduate" },
      { name: "Master of Business Administration (ODL)", level: "Postgraduate" },
      { name: "Doctor of Business Administration (DBA)", level: "Postgraduate" },
      { name: "PhD in Business Administration", level: "Postgraduate" }
    ],
    systemAssignment: {
      type: "Corporate & Leadership Tracking",
      features: ["Corporate Internship Logs", "Leadership Badge Verification", "Business Case Competitions", "MNC Mentorship"],
      logFields: [
        { id: "companyName", label: "Company / Organization", type: "text", placeholder: "e.g. Maybank, Petronas, PwC Malaysia" },
        { id: "department", label: "Department / Business Unit", type: "text", placeholder: "e.g. Corporate Finance, Strategy" },
        { id: "hoursLogged", label: "Internship / Case Study Hours", type: "number", placeholder: "e.g. 40" },
        { id: "caseSummary", label: "Business Case / Key Deliverable", type: "textarea", placeholder: "Describe key financial model, market entry analysis, or project managed..." },
        { id: "kpiAchieved", label: "KPI / Impact Metric", type: "text", placeholder: "e.g. Improved ROI calculations by 14%" }
      ]
    }
  },
  {
    id: "education",
    name: "Faculty of Social Sciences",
    faculty: "Faculty of Social Sciences",
    school: "School of Education",
    schools: ["School of Psychology", "School of Education", "School of English", "School of Communication"],
    code: "FESS",
    color: "#3B82F6",
    icon: "GraduationCap",
    description: "Pedagogy, psychology, special education, and early childhood developmental sciences.",
    programmes: [
      { name: "Foundation in Arts", level: "Foundation" },
      { name: "Diploma in Early Childhood Education", level: "Diploma" },
      { name: "Bachelor in Early Childhood Education (Honours)", level: "Bachelor" },
      { name: "Bachelor of Arts (Honours) Teaching of English as a Second Language (TESL)", level: "Bachelor" },
      { name: "Bachelor of Special Needs Education (Honours)", level: "Bachelor" },
      { name: "Bachelor of Psychology (Honours)", level: "Bachelor" },
      { name: "Master of Education (M.Ed.)", level: "Postgraduate" },
      { name: "Master of Arts in TESL (M.A. TESL)", level: "Postgraduate" },
      { name: "Master in Special Needs Education", level: "Postgraduate" },
      { name: "Doctor of Philosophy (PhD) in Education", level: "Postgraduate" }
    ],
    systemAssignment: {
      type: "School Practicum & Fieldwork Log",
      features: ["Teaching Practicum Hours", "School Attachment Logs", "Field Supervisor Evaluations", "Lesson Plan Repository"],
      logFields: [
        { id: "schoolName", label: "Attachment School / Center", type: "text", placeholder: "e.g. St. Michael International School" },
        { id: "classGrade", label: "Class Grade / Learner Group", type: "text", placeholder: "e.g. Year 4 Primary TESL, Special Needs Unit" },
        { id: "teachingHours", label: "Direct Teaching / Observation Hours", type: "number", placeholder: "e.g. 6" },
        { id: "lessonTopic", label: "Lesson Plan / Counseling Objective", type: "text", placeholder: "e.g. Phonics Mastery & Inclusive Group Activity" },
        { id: "reflectionLog", label: "Pedagogical Reflection Log", type: "textarea", placeholder: "Document learner engagement, interventions applied, and supervisor feedback..." }
      ]
    }
  },
  {
    id: "medicine",
    name: "Faculty of Medicine",
    faculty: "Faculty of Medicine",
    school: "School of Medicine",
    code: "FOM",
    color: "#EF4444",
    icon: "Activity",
    description: "Clinical rotation, surgical procedures, patient diagnosis, and medical research.",
    programmes: [
      { name: "Foundation in Science", level: "Foundation" },
      { name: "Bachelor of Medicine and Bachelor of Surgery (MBBS)", level: "Bachelor" },
      { name: "Bachelor of Biomedical Sciences (Honours)", level: "Bachelor" },
      { name: "Master of Medical Science", level: "Postgraduate" },
      { name: "Doctor of Philosophy (PhD) in Medical Science", level: "Postgraduate" }
    ],
    systemAssignment: {
      type: "Hospital Clinical Rotation Logbook",
      features: ["Ward Shift Hours", "Patient Case Logs", "Attending Doctor Sign-offs", "Clinical Competency Checklist"],
      logFields: [
        { id: "hospitalWard", label: "Hospital & Ward Department", type: "text", placeholder: "e.g. Hospital Raja Permaisuri Bainun - Internal Medicine Ward 4B" },
        { id: "attendingDoctor", label: "Attending Consultant / Doctor Name", type: "text", placeholder: "e.g. Dr. Aris Thorne, FRCP" },
        { id: "shiftHours", label: "Shift Duration (Hours)", type: "number", placeholder: "e.g. 12" },
        { id: "patientCases", label: "Anonymized Patient Cases Encountered", type: "text", placeholder: "e.g. Acute Coronary Syndrome, Type 2 Diabetes Management" },
        { id: "procedureDone", label: "Clinical Procedure Log & Notes", type: "textarea", placeholder: "Detail patient history taking, physical examination notes, arterial blood gas draw..." }
      ]
    }
  },
  {
    id: "pharmacy",
    name: "Faculty of Pharmacy",
    faculty: "Faculty of Pharmacy",
    school: "School of Pharmacy",
    code: "FOP",
    color: "#10B981",
    icon: "Pill",
    description: "Pharmaceutical care, clinical therapeutics, drug compounding, and preceptor checklists.",
    programmes: [
      { name: "Foundation in Science", level: "Foundation" },
      { name: "Bachelor of Pharmacy with Honours", level: "Bachelor" },
      { name: "Pharmacy Bridge Programme – Doctor of Pharmacy (USA)", level: "Professional" },
      { name: "Master in Pharmaceutical Sciences", level: "Postgraduate" },
      { name: "Doctor of Philosophy (PhD) in Pharmaceutical Sciences", level: "Postgraduate" }
    ],
    systemAssignment: {
      type: "Preceptor & Community Attachment Log",
      features: ["Hospital Attachment Hours", "Preceptor Competency Checklist", "Biosafety & Dispensing Records", "PharmD Clinical Notes"],
      logFields: [
        { id: "facilityName", label: "Pharmacy Facility / Clinical Site", type: "text", placeholder: "e.g. National Heart Institute Pharmacy" },
        { id: "preceptorName", label: "Preceptor Pharmacist Name & License", type: "text", placeholder: "e.g. Pharm. Sarah Lin, RPh #4829" },
        { id: "attachmentHours", label: "Clinical Attachment Hours", type: "number", placeholder: "e.g. 8" },
        { id: "category", label: "Therapeutic Category / Specialty", type: "text", placeholder: "e.g. Oncology Dispensing, Patient Counseling, Compounding" },
        { id: "competencyNotes", label: "Dispensing & Drug Interaction Review", type: "textarea", placeholder: "Document dosage calculations, drug-drug interaction screenings, and preceptor feedback..." }
      ]
    }
  },
  {
    id: "lifesciences",
    name: "Faculty of Integrated Life Sciences",
    faculty: "Faculty of Integrated Life Sciences",
    school: "School of Integrated Sciences (SIS)",
    schools: ["School of Integrated Sciences (SIS)", "School of Applied Sciences (SAS)"],
    code: "FILS",
    color: "#8B5CF6",
    icon: "Dna",
    description: "Biotechnology, food innovation, environmental systems, and advanced laboratory research.",
    programmes: [
      { name: "Diploma in Environmental Technology", level: "Diploma" },
      { name: "Bachelor of Science (Honours) in Biotechnology", level: "Bachelor" },
      { name: "Bachelor of Environmental Technology (Honours)", level: "Bachelor" },
      { name: "Bachelor in Food Science with Management (Honours)", level: "Bachelor" },
      { name: "Master of Science", level: "Postgraduate" },
      { name: "Doctor of Philosophy (PhD) in Science", level: "Postgraduate" }
    ],
    systemAssignment: {
      type: "Research Lab & Biosafety Engine",
      features: ["Lab Equipment Booking Hours", "Biosafety Level 2 Clearances", "Research Milestones", "Environmental Sampling Logs"],
      logFields: [
        { id: "labRoom", label: "Research Lab & Facility", type: "text", placeholder: "e.g. BSL-2 Molecular Bio Lab 3" },
        { id: "equipmentUsed", label: "Equipment / Instrument Used", type: "text", placeholder: "e.g. Real-Time PCR Thermocycler, HPLC System" },
        { id: "labHours", label: "Lab Station Hours Logged", type: "number", placeholder: "e.g. 5" },
        { id: "safetyProtocol", label: "Safety Clearance & Protocol Ref", type: "text", placeholder: "e.g. BSL2-SOP-2026-B" },
        { id: "experimentSummary", label: "Experiment Objectives & Assay Results", type: "textarea", placeholder: "Summarize DNA extraction yield, chromatography peak analysis, or bio-reactor parameters..." }
      ]
    }
  },
  {
    id: "computing_engineering",
    name: "Faculty of Computing and Engineering",
    faculty: "Faculty of Computing and Engineering",
    school: "School of Computing (SoC)",
    schools: ["School of Computing (SoC)", "School of Engineering (SoE)", "School of Mathematics & Basic Sciences (SoMBaS)"],
    code: "FCE",
    color: "#E50914",
    icon: "Cpu",
    description: "Software engineering, artificial intelligence, robotics, data analytics, and mechatronics.",
    programmes: [
      // Computing
      { name: "Diploma in Information Technology", level: "Diploma", track: "Computing" },
      { name: "Bachelor of Information Technology (Honours)", level: "Bachelor", track: "Computing" },
      { name: "Bachelor of Computer Science (Honours)", level: "Bachelor", track: "Computing" },
      { name: "Bachelor of Science (Honours) Actuarial Sciences", level: "Bachelor", track: "Computing" },
      { name: "Master in Computing", level: "Postgraduate", track: "Computing" },
      { name: "Doctor of Philosophy (PhD) in Computing", level: "Postgraduate", track: "Computing" },
      // Engineering
      { name: "Diploma in Mechatronics Engineering", level: "Diploma", track: "Engineering" },
      { name: "Bachelor of Mechatronics Engineering with Honours", level: "Bachelor", track: "Engineering" },
      { name: "Bachelor of Electronics Technology with Honours", level: "Bachelor", track: "Engineering" }
    ],
    systemAssignment: {
      type: "FYP, Git & Tech Scorecard Engine",
      features: ["Final Year Project (FYP) Milestones", "Git Repository Sync & PR Logs", "Hackathons & Code Scorecards", "CAD / PCB Design Verification"],
      logFields: [
        { id: "projectTitle", label: "Project Title / Repository Name", type: "text", placeholder: "e.g. Autonomous Robotic Navigation / QIU AI Engine" },
        { id: "gitLink", label: "Git Repo URL / Commit SHA", type: "text", placeholder: "https://github.com/qiu-edu/core-ai" },
        { id: "devHours", label: "Engineering / Coding Hours", type: "number", placeholder: "e.g. 15" },
        { id: "stackUsed", label: "Tech Stack / Hardware Tools", type: "text", placeholder: "e.g. Python, PyTorch, ROS2, STM32 Microcontroller" },
        { id: "milestoneDetails", label: "Technical Milestone / Algorithm Achieved", type: "textarea", placeholder: "Implemented SLAM mapping algorithm with <5cm trajectory drift. Fixed memory leak in real-time inference loop..." }
      ]
    }
  },
  {
    id: "hospitality",
    name: "School of Hospitality & Tourism",
    faculty: "Faculty of Business and Management",
    parentFaculty: "Faculty of Business and Management",
    school: "School of Hospitality",
    isSchool: true,
    code: "HTA",
    color: "#EC4899",
    icon: "Utensils",
    description: "Culinary arts, international hotel management, event administration, and guest experience.",
    programmes: [
      { name: "Diploma in Hotel Management", level: "Diploma" },
      { name: "Diploma in Culinary Arts", level: "Diploma" },
      { name: "Bachelor of Hospitality Management (Honours)", level: "Bachelor" },
      { name: "Bachelor in Culinary Arts (Honours)", level: "Bachelor" }
    ],
    systemAssignment: {
      type: "Hospitality Shift & Culinary Logbook",
      features: ["Hotel Operation Shift Hours", "Culinary Technique Assessments", "Guest Satisfaction Scorecards", "Banquet Management"],
      logFields: [
        { id: "venueName", label: "Hotel / Restaurant Property", type: "text", placeholder: "e.g. Grand Hyatt Regency / Le Culinary Lab" },
        { id: "department", label: "Operation Section", type: "text", placeholder: "e.g. Pastry Kitchen, Front Office Operations" },
        { id: "shiftHours", label: "Shift Duration (Hours)", type: "number", placeholder: "e.g. 10" },
        { id: "skillsDemonstrated", label: "Skills / Dishes Prepared", type: "text", placeholder: "e.g. French Classic Consommé, VIP Guest Check-in Suite Prep" },
        { id: "supervisorNotes", label: "Head Chef / Manager Feedback", type: "textarea", placeholder: "Detail station cleanups, food safety HACCP compliance, and service evaluation..." }
      ]
    }
  },
  {
    id: "communication",
    name: "School of Communication",
    faculty: "Faculty of Social Sciences",
    parentFaculty: "Faculty of Social Sciences",
    school: "School of Communication",
    isSchool: true,
    code: "CPA",
    color: "#14B8A6",
    icon: "Megaphone",
    description: "Corporate communication, digital journalism, strategic advertising, and media production.",
    programmes: [
      { name: "Bachelor of Mass Communication (Honours) Advertising", level: "Bachelor" },
      { name: "Bachelor of Mass Communication (Honours) Journalism", level: "Bachelor" },
      { name: "Bachelor of Corporate Communication (Honours)", level: "Bachelor" }
    ],
    systemAssignment: {
      type: "Media Production & Public Relations Logbook",
      features: ["Published Article Portfolio", "Advertising Campaign Impressions", "Press Release Approvals", "Crisis Comm Simulations"],
      logFields: [
        { id: "mediaOutlet", label: "Media Outlet / Client Brand", type: "text", placeholder: "e.g. TechDaily News, Ogilvy PR Campaign" },
        { id: "deliverableType", label: "Media Deliverable", type: "text", placeholder: "e.g. Investigative Feature Article, 30s Brand Commercial Script" },
        { id: "workHours", label: "Production / Research Hours", type: "number", placeholder: "e.g. 8" },
        { id: "portfolioLink", label: "Published Article / Video Asset Link", type: "text", placeholder: "https://media.qiu.edu.my/articles/ai-future-2026" },
        { id: "campaignImpact", label: "Audience Reach & Media Metrics", type: "textarea", placeholder: "Detail total reads, engagement rate, interview transcript summary, and press release reach..." }
      ]
    }
  }
];

// Sample Initial Student Profile
export const DEFAULT_STUDENT = {
  id: "QIU-202404-007157",
  name: "Alex Thorne",
  email: "alex.thorne@student.qiu.edu.my",
  facultyId: "computing_engineering",
  programme: "Bachelor of Computer Science (Honours)",
  year: 3,
  intakeYearMonth: 202404,
  intakeSequence: 7157,
  xp: 3450,
  // Kept consistent with tierFor(3450) = Silver (Gold starts at 3500). The UI
  // derives the tier from xp via lib/xp.js; this label is only a fallback.
  level: "Silver",
  careerTargets: "Software engineer / applied AI researcher",
  industries: "AI, software engineering, climate technology",
  bio: "Year 3 computer science student building practical AI systems for real-world problems.",
  skills: ["Python", "Machine learning", "Product thinking", "Technical communication"],
  portfolioUrl: "",
  githubUrl: "https://github.com/qiu-student",
  linkedinUrl: "",
  publicTalent: false,
  fypSubmission: null,
  diagnosticResult: null,
  workshopAttendance: [],
  courses: [],
  avatarUrl: null,
  badges: [
    { id: "b1", title: "Git Master", category: "Technical", date: "2026-03-12", xp: 300, icon: "GitBranch" },
    { id: "b2", title: "AI Hackathon Winner", category: "Competition", date: "2026-05-20", xp: 500, icon: "Trophy" },
    { id: "b3", title: "BSL-2 Safety Cleared", category: "Safety", date: "2026-01-15", xp: 200, icon: "ShieldCheck" },
    { id: "b4", title: "Coursera: Deep Learning Spec", category: "Certification", date: "2026-06-10", xp: 450, icon: "Award" }
  ],
  logbookEntries: [
    {
      id: "LOG-101",
      date: "2026-07-28",
      facultyId: "computing_engineering",
      hours: 16,
      status: "APPROVED",
      supervisor: "Dr. Marcus Vance (Head of AI Lab)",
      title: "QIU AI Core Algorithm Optimization",
      details: "Refactored neural attention weights in PyTorch, reducing memory footprint by 28%. Pushed SHA: 9f8a32b to main branch.",
      magicToken: "tok_99182a"
    },
    {
      id: "LOG-102",
      date: "2026-07-30",
      facultyId: "computing_engineering",
      hours: 12,
      status: "PENDING",
      supervisor: "Prof. Sarah Connor",
      title: "Final Year Project Milestone 2 - Computer Vision Pipeline",
      details: "Integrated OpenCV tracking pipeline with WebRTC camera feed. Benchmark testing completed with 60 FPS performance.",
      magicToken: "tok_3381a9"
    }
  ]
};

// 4-Year Academic Roadmaps mapped by Faculty
export const ACADEMIC_ROADMAPS = {
  computing_engineering: [
    { year: 1, title: "Year 1: Foundations & Algorithmic Logic", tasks: ["Complete Data Structures & Algorithms", "Setup GitHub Student Developer Pack", "Attend CPDC Orientation & CV Workshop"], status: "COMPLETED" },
    { year: 2, title: "Year 2: Applied Software & Systems", tasks: ["Participate in 48-hour University AI Hackathon", "Obtain Coursera Cloud Architecture Certificate", "Draft initial Resume & LinkedIn Audit"], status: "COMPLETED" },
    { year: 3, title: "Year 3: Industrial Attachment & FYP", tasks: ["Execute 12-week Tech Internship Logbook", "Submit FYP Milestone 1 & 2 Code Review", "Complete three interview-practice sessions"], status: "IN_PROGRESS" },
    { year: 4, title: "Year 4: Career Launch & Employer Matching", tasks: ["Present FYP at University Tech Expo", "Apply to the CPDC Top Employer Talent Pool", "Finalize ATS Resume & Portfolio Sync"], status: "UPCOMING" }
  ],
  medicine: [
    { year: 1, title: "Year 1: Anatomy & Cell Biology", tasks: ["Complete Basic Medical Sciences", "Pass Cadaveric Anatomy Lab Assessment", "First Aid & CPR Certification"], status: "COMPLETED" },
    { year: 2, title: "Year 2: Pathology & Pharmacology", tasks: ["Pass Systemic Pathology Exam", "Clinical Skills OSCE Simulation", "Hospital Shadowing Logbook - 40 Hrs"], status: "COMPLETED" },
    { year: 3, title: "Year 3: Junior Clinical Rotations", tasks: ["Internal Medicine Ward Rotation (8 wks)", "General Surgery & Operating Theatre Log", "Doctor Sign-Off Verification (120 shift hrs)"], status: "IN_PROGRESS" },
    { year: 4, title: "Year 4: Senior Clinical & Housemanship Prep", tasks: ["Emergency Medicine & ICU Shift Logs", "National Medical Board Prep", "Hospital Placement Matching"], status: "UPCOMING" }
  ],
  business: [
    { year: 1, title: "Year 1: Microeconomics & Accounting", tasks: ["Complete Financial Accounting 1", "Join University Business Case Club", "LinkedIn Profile & Professional Networking"], status: "COMPLETED" },
    { year: 2, title: "Year 2: Corporate Finance & Analytics", tasks: ["Participate in L'Oréal Brandstorm Case Comp", "Obtain Bloomberg Market Concepts Badge", "Submit Corporate Shadowing Log"], status: "COMPLETED" },
    { year: 3, title: "Year 3: MNC Internship & Strategy", tasks: ["Execute 16-week Banking/MNC Internship", "Professional Services Leadership Badge", "Coursera Financial Modeling Course"], status: "IN_PROGRESS" },
    { year: 4, title: "Year 4: Capstone & Graduate Trainee Pool", tasks: ["Present Capstone Business Strategy", "Graduate Trainee Program Applications", "Executive Coffee Chat Series"], status: "UPCOMING" }
  ],
  default: [
    { year: 1, title: "Year 1: Academic & Professional Orientation", tasks: ["Build Core Academic Discipline Foundation", "Explore Campus Career Clubs", "CPDC Platform Registration"], status: "COMPLETED" },
    { year: 2, title: "Year 2: Skill Acquisition & Field Intro", tasks: ["Complete First Industry Attachment", "Earn 2 Skill Badges", "Draft ATS Resume"], status: "COMPLETED" },
    { year: 3, title: "Year 3: Advanced Fieldwork & Industry Logbook", tasks: ["Log 100+ Field/Practical Hours", "Pass Supervisor Competency Checklist", "Alumni Mentorship Coffee Chat"], status: "IN_PROGRESS" },
    { year: 4, title: "Year 4: Graduation & Career Placement", tasks: ["Complete Capstone Project", "Employer Marketplace Matching", "Final Placement Interview"], status: "UPCOMING" }
  ]
};

// Workshops Registry with AI Match Logic
// Workshops Registry with AI Match Logic & Deep Logistical Metadata
export const WORKSHOPS = [
  {
    id: "w1",
    title: "Applied AI & Data Science Masterclass",
    faculty: "computing_engineering",
    speaker: "Elena Rostova (Lead AI Scientist, Meridian AI Labs)",
    speakerBio: "20+ years industrial AI engineering experience, author of 40+ peer-reviewed publications in Neural Information Processing, and technology advisor for autonomous enterprise systems.",
    date: "2026-08-15 | 14:00 GMT+8",
    location: "Auditorium 1 & Virtual Stream",
    virtualLink: "https://zoom.us/w/983748291?pwd=ai-masterclass-secret",
    roomDetails: "Level 3, High-Performance Computing Lab, Building B. Includes dual 4K projection display and Gigabit workstation terminals.",
    agenda: [
      { time: "14:00 - 14:45", title: "Keynote: Next-Generation Generative AI & Agentic Scaling Laws", description: "Architectural evolution of large language models, structured output reliability, and reasoning loops." },
      { time: "14:45 - 15:45", title: "Hands-on Lab: Building Autonomous Agentic Workflows", description: "Live coding demonstration implementing recursive tool-calling and real-time database indexing." },
      { time: "15:45 - 16:30", title: "Career Mentorship & Executive Q&A", description: "Direct dialogue with senior AI leadership from Meridian AI Labs on career trajectory in applied AI." }
    ],
    prereqs: "Basic proficiency in Python 3.x and foundational data science terminology (linear algebra, regression).",
    learningOutcomes: [
      "Design and deploy robust multi-agent artificial intelligence workflows.",
      "Implement schema-validated JSON function calling for deterministic model outputs.",
      "Earn 250 verified CPDC Professionalism XP and the Applied AI digital competency badge."
    ],
    matchScore: 98,
    xpReward: 250,
    tags: ["Artificial Intelligence", "Python", "Deep Learning"],
    registered: false,
  },
  {
    id: "w2",
    title: "Financial Modeling & M&A Bootcamp",
    faculty: "business",
    speaker: "David Chen (Partner, Bellhaven Deal Advisory)",
    speakerBio: "Specialist in corporate valuation and restructuring with over 15 years directing enterprise mergers and cross-border corporate acquisitions across Southeast Asia.",
    date: "2026-08-18 | 10:00 GMT+8",
    location: "Business Building Hall B",
    virtualLink: "https://teams.microsoft.com/l/meetup-join/bellhaven-m-a-bootcamp",
    roomDetails: "Executive Case Room B201, Faculty of Business & Management. Equipped with dual Bloomberg terminal projections.",
    agenda: [
      { time: "10:00 - 11:15", title: "Advanced Three-Statement Financial Modeling", description: "Building dynamically linked income statements, balance sheets, and cash flow forecasts under uncertain market assumptions." },
      { time: "11:15 - 12:30", title: "M&A Deal Valuation & Discounted Cash Flow (DCF)", description: "Calculating terminal value, WACC optimization, and stress-testing enterprise acquisitions." },
      { time: "12:30 - 13:00", title: "Investment Banking Mock Deal Pitch", description: "Interactive participant roundtable reviewing a real-world corporate buyout scenario." }
    ],
    prereqs: "Completion of Principles of Finance (MKT-201 or eq.) or strong familiarity with accounting statements and Excel spreadsheets.",
    learningOutcomes: [
      "Construct dynamic 3-statement corporate valuation models from scratch.",
      "Evaluate cross-border capital budgeting risks using advanced discount rate methodologies.",
      "Obtain 200 CPDC Career Mastery XP and direct resume visibility with Bellhaven recruitment."
    ],
    matchScore: 94,
    xpReward: 200,
    tags: ["Financial Modeling", "M&A", "Valuation"],
    registered: true,
  },
  {
    id: "w3",
    title: "Clinical Emergency OSCE & Airway Management",
    faculty: "medicine",
    speaker: "Dr. Jonathan Hayes (Chief of Emergency Surgery, General Hospital)",
    speakerBio: "Trauma surgeon and primary OSCE clinical simulator director with 22 years of emergency medical service and surgical teaching experience.",
    date: "2026-08-20 | 09:00 GMT+8",
    location: "Medical Simulation Center Ward 3",
    virtualLink: "https://stream.med-qiu.edu.my/osce-ward3-live",
    roomDetails: "High-Fidelity Simulation Ward 3, Faculty of Medicine. Features SimMan 3G advanced trauma surgical mannequins and ventilator bays.",
    agenda: [
      { time: "09:00 - 10:30", title: "Rapid Assessment & Difficult Airway Algorithm", description: "Protocol review for acute respiratory distress, endotracheal intubation, and surgical cricothyroidotomy." },
      { time: "10:30 - 12:30", title: "Simulated Emergency Trauma Scenarios", description: "Small-group clinical diagnostic rotations on high-fidelity responsive medical mannequins." },
      { time: "12:30 - 13:30", title: "Debrief & Clinical Documentation Standards", description: "Structured review of triage decisions and legal medical documentation protocols." }
    ],
    prereqs: "Active enrollment in MBBS Year 2+ or Bachelor of Nursing Clinical Year. Mandatory PPE and stethoscope required upon entry.",
    learningOutcomes: [
      "Master rapid emergency airway establishment under high-pressure clinical scenarios.",
      "Execute structured OSCE triage communication using SBAR protocol.",
      "Acquire 300 clinical simulation XP verified towards mandatory clinical practicum hours."
    ],
    matchScore: 96,
    xpReward: 300,
    tags: ["Clinical Skills", "OSCE", "Surgery"],
    registered: false,
  },
  {
    id: "w4",
    title: "Pharmaceutical Dispensing & Biosafety Level 3 SOPs",
    faculty: "pharmacy",
    speaker: "Pharm. Catherine Bell (National Regulatory Director)",
    speakerBio: "Licensed pharmacist and bio-safety compliance compliance consultant specializing in sterile cleanroom manufacturing and clinical trial pharmacovigilance.",
    date: "2026-08-22 | 11:30 GMT+8",
    location: "Pharmacy Complex Lab 2",
    virtualLink: "https://zoom.us/w/pharmacy-bsl3-compliance",
    roomDetails: "Sterile Cleanroom Simulation Lab 2, Pharmacy Complex. Equipped with ISO Class 5 laminar airflow hoppers and biological containment hoods.",
    agenda: [
      { time: "11:30 - 12:30", title: "BSL-3 Cleanroom Protocol & Sterile Gowning", description: "Rigorous step-by-step practicum on aseptic technique, airborne hazard mitigation, and laminar hood operations." },
      { time: "12:30 - 14:00", title: "High-Precision Compounding & Hazardous Dispensing", description: "Safe handling of cytotoxic compounds and precision calculations for intravenous formulations." },
      { time: "14:00 - 14:45", title: "Regulatory Audit Readiness & Pharmacovigilance", description: "Navigating national health authorities and reporting adverse therapeutic drug occurrences." }
    ],
    prereqs: "General chemistry and pharmacology laboratory safety induction clearance.",
    learningOutcomes: [
      "Demonstrate compliant BSL-3 cleanroom entry and aseptic compounding techniques.",
      "Execute precision dosing for specialized cytotoxic medical prescriptions.",
      "Achieve 220 CPDC Laboratory Compliance XP and pharmaceutical safety accreditation."
    ],
    matchScore: 91,
    xpReward: 220,
    tags: ["PharmD", "Biosafety", "Regulatory"],
    registered: false,
  },
  {
    id: "w5",
    title: "Inclusive Classroom Design & Practicum Evidence Lab",
    faculty: "education",
    speaker: "QIU Faculty of Social Sciences Teaching Panel",
    speakerBio: "A faculty-led panel of practicum supervisors specialising in lesson design, inclusive assessment and evidence-based classroom reflection.",
    date: "2026-08-25 | 10:00 GMT+8",
    location: "Education Microteaching Studio",
    roomDetails: "Studio E204 with recording, observation and accessibility equipment. Bring one lesson plan or teaching activity to workshop.",
    agenda: [
      { time: "10:00 - 10:40", title: "Design for mixed-ability learners", description: "Turn learning outcomes into observable activities and adaptations." },
      { time: "10:40 - 12:00", title: "Microteaching evidence clinic", description: "Practise a short lesson and receive structured supervisor feedback." },
      { time: "12:00 - 12:30", title: "Practicum portfolio review", description: "Map lesson plans, observations and reflections to placement evidence." }
    ],
    prereqs: "Bring a draft lesson plan; no prior teaching placement is required.",
    learningOutcomes: ["Write measurable inclusive learning outcomes.", "Use observation feedback to improve a lesson.", "Build a practicum evidence trail that a school supervisor can verify."],
    xpReward: 180,
    tags: ["Teaching", "Inclusive Practice", "Lesson Planning"],
    registered: false,
  },
  {
    id: "w6",
    title: "Biotech Research Methods, Biosafety & Reproducibility Clinic",
    faculty: "lifesciences",
    speaker: "QIU Life Sciences Research Methods Panel",
    speakerBio: "Research and laboratory supervisors covering experimental design, biosafety documentation, reproducible analysis and research integrity.",
    date: "2026-08-27 | 09:30 GMT+8",
    location: "Life Sciences Research Lab 1",
    roomDetails: "Wet-lab and analysis stations in Building C. Closed-toe shoes and the faculty lab induction card are required.",
    agenda: [
      { time: "09:30 - 10:15", title: "Designing a defensible experiment", description: "Choose controls, sample sizes and records before touching a bench." },
      { time: "10:15 - 11:45", title: "Biosafety and sample traceability", description: "Practise chain-of-custody, risk assessment and incident documentation." },
      { time: "11:45 - 12:30", title: "Reproducible data notebook", description: "Turn raw observations into a reviewable analysis trail." }
    ],
    prereqs: "Complete the faculty biosafety induction before attending the wet-lab segment.",
    learningOutcomes: ["Plan an experiment with controls and measurable outcomes.", "Record biosafety and sample traceability evidence.", "Produce a reproducible notebook suitable for a research supervisor."],
    xpReward: 220,
    tags: ["Research", "Biosafety", "Laboratory", "Data Analysis"],
    registered: false,
  },
  {
    id: "w7",
    title: "Hotel Operations, Guest Recovery & Event Command Simulation",
    faculty: "hospitality",
    speaker: "QIU Hospitality Operations Simulation Team",
    speakerBio: "Hospitality lecturers and industry practitioners who coach students through front-office, service-recovery and live-event operating decisions.",
    date: "2026-08-29 | 13:00 GMT+8",
    location: "Hospitality Training Hotel & Banquet Suite",
    roomDetails: "Training reception, guest-room mock-up and 120-seat banquet suite. Smart-casual attire and closed-toe shoes recommended.",
    agenda: [
      { time: "13:00 - 13:45", title: "From guest promise to operating plan", description: "Translate a service standard into staffing, timing and quality checks." },
      { time: "13:45 - 15:15", title: "Live service-recovery simulation", description: "Resolve a multi-channel guest issue while protecting safety and brand trust." },
      { time: "15:15 - 16:00", title: "Event command debrief", description: "Review decisions using guest satisfaction, cost and team metrics." }
    ],
    prereqs: "No prerequisite; students should bring a current CV or placement reflection for the debrief.",
    learningOutcomes: ["Plan a guest-facing operation with measurable service standards.", "Handle a service-recovery scenario professionally.", "Quantify event and guest outcomes for a hospitality CV."],
    xpReward: 180,
    tags: ["Hospitality", "Guest Experience", "Event Management"],
    registered: false,
  },
  {
    id: "w8",
    title: "Corporate Storytelling, Campaign Measurement & Crisis Room",
    faculty: "communication",
    speaker: "QIU Communication Strategy & Media Panel",
    speakerBio: "Communication academics and campaign practitioners working across public relations, journalism, advertising and corporate affairs.",
    date: "2026-08-31 | 14:00 GMT+8",
    location: "Communication Media Lab",
    roomDetails: "Media lab with editing suites and a simulated newsroom. Bring a laptop and one piece of published or draft content.",
    agenda: [
      { time: "14:00 - 14:45", title: "Audience, message and channel", description: "Build a campaign brief from a stakeholder problem rather than a slogan." },
      { time: "14:45 - 16:00", title: "Crisis communication room", description: "Make timed editorial and stakeholder decisions using an evolving scenario." },
      { time: "16:00 - 16:45", title: "Evidence-led portfolio review", description: "Use reach, engagement and response quality to explain campaign impact." }
    ],
    prereqs: "Bring a draft press release, article, campaign or portfolio item if available.",
    learningOutcomes: ["Write a clear audience-led campaign brief.", "Respond to a crisis with a documented approval trail.", "Turn communication metrics into evidence for a portfolio or CV."],
    xpReward: 180,
    tags: ["Communication", "PR", "Campaigns", "Media"],
    registered: false,
  }
];

// Coursera / edX Sync Hub Data with Deep Syllabus & Accreditation Equivalency
export const ONLINE_COURSES = [
  {
    id: "c1",
    title: "Neural Networks and Deep Learning",
    platform: "Coursera",
    provider: "DeepLearning.AI & Stanford University",
    instructor: "Prof. Andrew Ng & DeepLearning.AI Research Team",
    instructorBio: "Founding Lead of Google Brain, former Director of Stanford AI Laboratory, and pioneer in democratizing artificial intelligence education worldwide.",
    externalUrl: "https://www.coursera.org/learn/neural-networks-deep-learning",
    duration: "4 Weeks (Approx. 22 Hours)",
    skillBadge: "Deep Learning Specialist",
    skillsEarned: ["Backpropagation", "Deep Learning", "Neural Network Architecture", "Python Programming", "Hyperparameter Optimization"],
    creditTransferEquivalency: "Accredited for 2.0 Elective SCL Credits under QIU Senate Approval #2026-EDX-AI.",
    syllabus: [
      { week: "Week 1", topic: "Introduction to Deep Learning & Neural Architectures", hours: "4 hours of video & exercises" },
      { week: "Week 2", topic: "Neural Network Basics & Vectorized Forward Propagation", hours: "6 hours including coding assignment" },
      { week: "Week 3", topic: "Shallow Neural Networks & Backpropagation Derivatives", hours: "5 hours with theoretical quizzes" },
      { week: "Week 4", topic: "Deep L-Layer Neural Networks & Application Showcase", hours: "7 hours capstone model build" }
    ],
    xp: 400,
    completed: true,
    certUrl: "https://coursera.org/verify/QIU-AI-991",
    faculty: "computing_engineering"
  },
  {
    id: "c2",
    title: "Corporate Finance & Capital Budgeting",
    platform: "edX",
    provider: "Harvard Business School Online",
    instructor: "Prof. W. Carl Kester (George Fisher Baker Jr. Professor of Business Administration)",
    instructorBio: "Renowned authority on corporate financial management and institutional cross-border finance at Harvard Business School.",
    externalUrl: "https://www.edx.org/course/corporate-finance-and-capital-budgeting",
    duration: "6 Weeks (Approx. 30 Hours)",
    skillBadge: "Capital Markets Analyst",
    skillsEarned: ["Capital Budgeting", "Net Present Value (NPV)", "Risk Assessment", "Corporate Valuation", "Financial Forecasting"],
    creditTransferEquivalency: "Accredited for 3.0 Elective Business Credits under QIU Senate Approval #2026-EDX-FIN.",
    syllabus: [
      { week: "Week 1-2", topic: "Time Value of Money & Discounted Cash Flow Mechanics", hours: "10 hours interactive lectures" },
      { week: "Week 3-4", topic: "Capital Budgeting Rules: NPV, IRR, and Payback Period", hours: "10 hours valuation case simulations" },
      { week: "Week 5-6", topic: "Risk, Return, and Cost of Capital Estimation (WACC)", hours: "10 hours comprehensive assessment" }
    ],
    xp: 350,
    completed: false,
    certUrl: null,
    faculty: "business"
  },
  {
    id: "c3",
    title: "Good Clinical Practice (GCP) & Trial Design",
    platform: "Coursera",
    provider: "Johns Hopkins University School of Medicine",
    instructor: "Dr. Janet R. Holroyd (Senior Clinical Trials Advisor)",
    instructorBio: "Principal clinical investigator at Johns Hopkins Medicine specializing in epidemiological biostatistics and multi-center phase III clinical pharmaceutical trials.",
    externalUrl: "https://www.coursera.org/learn/clinical-trials",
    duration: "5 Weeks (Approx. 25 Hours)",
    skillBadge: "GCP Clinical Researcher",
    skillsEarned: ["Good Clinical Practice (GCP)", "Clinical Trial Design", "Bio-medical Ethics", "Informed Consent Protocol", "Patient Safety Monitoring"],
    creditTransferEquivalency: "Accredited for 2.5 Clinical Elective Credits under QIU Senate Medical Board Approval #2026-EDX-MED.",
    syllabus: [
      { week: "Week 1", topic: "Historical Foundation of Medical Ethics & Institutional Review Boards", hours: "5 hours clinical lectures" },
      { week: "Week 2", topic: "Phase I to IV Clinical Trial Methodologies & Randomization", hours: "5 hours experimental design practicum" },
      { week: "Week 3", topic: "Informed Consent, Participant Safety, & Adverse Event Tracking", hours: "5 hours regulatory evaluation" },
      { week: "Week 4-5", topic: "Data Integrity, Biostatistical Analysis & Trial Audit Readiness", hours: "10 hours final audit case study" }
    ],
    xp: 450,
    completed: false,
    certUrl: null,
    faculty: "medicine"
  }
];

// Alumni Directory & Coffee Chat Network
export const ALUMNI_DIRECTORY = [
  {
    id: "alum-1",
    name: "Samantha Tan",
    graduationYear: 2023,
    facultyId: "computing_engineering",
    programme: "Bachelor of Computer Science",
    company: "Meridian Cloud",
    role: "Senior Software Engineer",
    location: "Singapore",
    avatar: null,
    bio: "Passionate about distributed systems, backend scaling, and helping junior CS students land MNC internships.",
    coffeeChatSlots: ["Tomorrow 3:00 PM", "Friday 5:00 PM", "Next Mon 10:00 AM"]
  },
  {
    id: "alum-2",
    name: "Dr. Kevin Ramasamy",
    graduationYear: 2021,
    facultyId: "medicine",
    programme: "MBBS",
    company: "Northshore Teaching Hospital",
    role: "Cardiology Fellow",
    location: "London, UK",
    avatar: null,
    bio: "Guiding medical graduates through hospital rotations, MRCP exam prep, and research publications.",
    coffeeChatSlots: ["Thursday 7:00 PM", "Saturday 2:00 PM"]
  },
  {
    id: "alum-3",
    name: "Rachel Dupont",
    graduationYear: 2022,
    facultyId: "business",
    programme: "Bachelor of Finance",
    company: "Straits Capital Partners",
    role: "Investment Banking Associate",
    location: "Hong Kong",
    avatar: null,
    bio: "Ex-QIU Case Competition champion. Happy to review financial modeling portfolios and conduct mock IB interviews.",
    coffeeChatSlots: ["Wednesday 6:00 PM", "Sunday 11:00 AM"]
  }
];

// Discussion Feed / Co-Founder Match
export const FEED_POSTS = [
  {
    id: "post-1",
    author: "Zackary Lim",
    faculty: "Faculty of Computing & Engineering",
    year: "Year 3 CS",
    time: "2 hours ago",
    avatar: null,
    title: "Looking for a Business Co-Founder for MedTech AI Startup!",
    content: "Building an AI-assisted triage tool for hospital casualty wards. Got the computer vision prototype working. Need a Business/Finance student to lead market validation & pitch deck for the upcoming VC challenge!",
    tags: ["Startup", "CoFounder", "AI", "Business"],
    likes: 24,
    comments: 8
  },
  {
    id: "post-2",
    author: "Dr. Priya Nair",
    faculty: "Faculty of Pharmacy",
    year: "PharmD Candidate",
    time: "5 hours ago",
    avatar: null,
    title: "Community Pharmacy Attachment Study Group",
    content: "Anyone in Pharmacy Year 3 preparing for the Preceptor Competency OSCE next month? Gathering a virtual study room to test drug interaction scenarios together.",
    tags: ["Pharmacy", "OSCE", "StudyGroup"],
    likes: 15,
    comments: 4
  }
];

// AI Mock Interviewer Questions
export const MOCK_INTERVIEW_QUESTIONS = {
  computing_engineering: [
    "Tell me about a complex technical algorithm you optimized. What was the bottleneck and how did you measure performance?",
    "Explain how you handle merge conflicts and code reviews in a multi-developer Git workflow.",
    "Walk me through the system architecture of your Final Year Project (FYP)."
  ],
  business: [
    "Walk me through a discounted cash flow (DCF) model and how you arrive at enterprise value.",
    "Describe a situation where your team faced conflicting priorities during a business case competition.",
    "Why do you want to join our Graduate Leadership Program over other financial institutions?"
  ],
  medicine: [
    "How do you prioritize patient care in a high-pressure casualty ward when multiple acute cases arrive simultaneously?",
    "Walk me through your diagnostic approach when taking a history for a patient presenting with acute retrosternal chest pain.",
    "Explain a clinical scenario where you received critical supervisor feedback and how you adjusted your clinical practice."
  ],
  default: [
    "Tell me about yourself and why you chose your specific degree track at QIU.",
    "Describe a challenge you faced during your industry attachment or practical logbook execution.",
    "Where do you see your career in 3 to 5 years after graduating?"
  ]
};

// Skill Gap Radar Targets
export const SKILL_GAP_TARGETS = [
  {
    role: "AI / ML Engineer",
    faculty: "computing_engineering",
    requiredBadges: ["Git Master", "Deep Learning Specialist", "AI Hackathon Winner", "Cloud Architecture"],
    learningPlan90Days: [
      { day: "Days 1-30", task: "Complete PyTorch Advanced Tensor Manipulation & CUDA optimization" },
      { day: "Days 31-60", task: "Publish 2 Open-Source PRs to LangChain or HuggingFace Transformers" },
      { day: "Days 61-90", task: "Execute 5 AI Mock Interview sessions focusing on System Design" }
    ]
  },
  {
    role: "Investment Banking Analyst",
    faculty: "business",
    requiredBadges: ["Corporate Finance Analyst", "L'Oréal Case Finalist", "Bloomberg BMC", "Excel Valuation Master"],
    learningPlan90Days: [
      { day: "Days 1-30", task: "Master 3-Statement Financial Modeling & LBO Analysis in Excel" },
      { day: "Days 31-60", task: "Conduct 3 coffee chats with alumni in investment banking" },
      { day: "Days 61-90", task: "Complete Wall Street Prep M&A Certification" }
    ]
  },
  {
    role: "Clinical Registrar / Specialist",
    faculty: "medicine",
    requiredBadges: ["OSCE Surgery Honors", "Clinical Shift Log (120+ Hrs)", "Cadaveric Anatomy Specialist", "GCP Certified"],
    learningPlan90Days: [
      { day: "Days 1-30", task: "Log 40 hours in High-Dependency ICU Ward Rotation" },
      { day: "Days 31-60", task: "Publish 1 Clinical Case Report in the QIU Medical Journal" },
      { day: "Days 61-90", task: "Complete Advanced Cardiac Life Support (ACLS) Practical Exam" }
    ]
  }
];
