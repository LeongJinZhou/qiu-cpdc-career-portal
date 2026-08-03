// Module 6 — External Learning catalogue (Coursera / edX / LinkedIn Learning).
//
// Demo seed data for the prototype. Two content rules are deliberately applied
// here and should survive any future edit:
//
//  1. Course titles are real, publicly-listed courses on those platforms, and
//     the `taughtBy` field names the real partner organisation that publishes
//     the course. No individual instructor names are invented and attached to a
//     real course, and no enrolment/rating statistics are fabricated.
//  2. Nothing here claims a QIU partnership with any platform. CPDC "curating"
//     a course means listing it, not reselling it.
//
// The shape is close to what a catalogue API would return, so swapping the
// fixture for a real feed is a data change rather than a UI rewrite.

// Relative rather than the '@/' alias: this module is imported by
// scripts/sync-catalog.mjs under plain node, which has no bundler alias.
import { workshopMatch } from '../matching.js';

/** Platform chrome. `theme` maps to a gradient in the card component. */
export const PROVIDERS = {
  coursera: { id: 'coursera', label: 'Coursera' },
  edx: { id: 'edx', label: 'edX' },
  linkedin: { id: 'linkedin', label: 'LinkedIn Learning' },
};

export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

/**
 * The catalogue.
 *
 * `faculty` is the primary owning faculty and `alsoFor` lists faculties CPDC
 * also recommends it to — both feed the match score. `tags` are shared with the
 * workshop vocabulary and with `recommendTag` values from lib/data/diagnostics,
 * which is what lets a diagnostic gap pull a course to the top.
 */
export const COURSE_CATALOGUE = [
  {
    id: 'crs-ml-spec',
    title: 'Machine Learning Specialization',
    provider: 'coursera',
    taughtBy: 'DeepLearning.AI & Stanford Online',
    duration: '~2 months',
    level: 'Intermediate',
    faculty: 'computing_engineering',
    alsoFor: [],
    theme: 'indigo',
    xp: 400,
    skillBadge: 'Applied Machine Learning',
    tags: ['Artificial Intelligence', 'Machine Learning', 'Python'],
    summary: 'Supervised and unsupervised learning, from regression through to recommender systems.',
    url: "https://www.coursera.org/specializations/machine-learning-introduction",
    instructor: "Andrew Ng",
    effort: "6-8 hrs/week",
    prerequisite: "Basic Python and secondary-school algebra.",
    outcomes: [
      "Frame a real problem as a supervised learning task and pick a sensible model",
      "Train, evaluate and explain a regression or classification model in Python",
      "Recognise overfitting and describe how you corrected for it in an interview",
    ],
  },
  {
    id: 'crs-deep-learning',
    title: 'Deep Learning Specialization',
    provider: 'coursera',
    taughtBy: 'DeepLearning.AI',
    duration: '~3 months',
    level: 'Advanced',
    faculty: 'computing_engineering',
    alsoFor: [],
    theme: 'slate',
    xp: 450,
    skillBadge: 'Deep Learning Practitioner',
    tags: ['Deep Learning', 'Artificial Intelligence', 'Python'],
    summary: 'Neural networks, convolutional and sequence models, and how to structure an ML project.',
    url: "https://www.coursera.org/specializations/deep-learning",
    instructor: "Andrew Ng",
    effort: "8-10 hrs/week",
    prerequisite: "Python plus the Machine Learning Specialization or equivalent.",
    outcomes: [
      "Build and tune a neural network end to end",
      "Choose between convolutional and sequence architectures for a given problem",
      "Talk through a model you built as an FYP or portfolio piece",
    ],
  },
  {
    id: 'crs-cloud-leader',
    title: 'Preparing for Google Cloud Certification: Cloud Digital Leader',
    provider: 'coursera',
    taughtBy: 'Google Cloud',
    duration: '~4 weeks',
    level: 'Beginner',
    faculty: 'computing_engineering',
    alsoFor: ['business'],
    theme: 'sky',
    xp: 300,
    skillBadge: 'Cloud Fundamentals',
    tags: ['Cloud Fundamentals', 'Productivity', 'Infrastructure'],
    summary: 'Cloud vocabulary, core infrastructure and the data/AI services a graduate is expected to name.',
    url: "https://www.coursera.org/professional-certificates/google-cloud-digital-leader-training",
    instructor: null,
    effort: "3-4 hrs/week",
    prerequisite: "None.",
    outcomes: [
      "Use cloud vocabulary correctly in a technical interview",
      "Describe core compute, storage and data services and when each applies",
      "Explain a migration in business terms, not just technical ones",
    ],
  },
  {
    id: 'edx-cs50',
    title: "CS50's Introduction to Computer Science",
    provider: 'edx',
    taughtBy: 'Harvard University',
    duration: '~11 weeks',
    level: 'Beginner',
    faculty: 'computing_engineering',
    alsoFor: ['communication', 'business'],
    theme: 'crimson',
    xp: 350,
    skillBadge: 'Computer Science Foundations',
    tags: ['Critical Thinking', 'Programming', 'Computer Science'],
    summary: 'The classic foundations course: abstraction, algorithms, data structures and C through Python.',
    url: "https://www.edx.org/cs50",
    instructor: "David J. Malan",
    effort: "10-20 hrs/week",
    prerequisite: "None — designed for complete beginners.",
    outcomes: [
      "Write, compile and debug programs in C and Python",
      "Reason about algorithmic efficiency in plain language",
      "Ship a final project you can put at the top of your CV",
    ],
  },
  {
    id: 'crs-cybersecurity',
    title: 'Google Cybersecurity Professional Certificate',
    provider: 'coursera',
    taughtBy: 'Google Career Certificates',
    duration: '~6 months',
    level: 'Beginner',
    faculty: 'computing_engineering',
    alsoFor: [],
    theme: 'slate',
    xp: 450,
    skillBadge: 'Security Analyst Ready',
    tags: ['Cybersecurity', 'Networking', 'Critical Thinking'],
    summary: 'Security frameworks, network defence, SIEM tooling and incident response fundamentals.',
    url: "https://www.coursera.org/professional-certificates/google-cybersecurity",
    instructor: null,
    effort: "7-10 hrs/week",
    prerequisite: "None.",
    outcomes: [
      "Identify common threats and describe the control that mitigates each",
      "Use SIEM and packet-inspection tooling at an entry-level standard",
      "Answer \"walk me through triaging an alert\" credibly",
    ],
  },
  {
    id: 'crs-google-data',
    title: 'Google Data Analytics Professional Certificate',
    provider: 'coursera',
    taughtBy: 'Google Career Certificates',
    duration: '~6 months',
    level: 'Beginner',
    faculty: 'business',
    alsoFor: ['computing_engineering', 'lifesciences'],
    theme: 'amber',
    xp: 450,
    skillBadge: 'Data Analytics Ready',
    tags: ['Analytics', 'Critical Thinking', 'Data Visualisation'],
    summary: 'The full analyst workflow — ask, prepare, process, analyse, share — with SQL, R and Tableau.',
    url: "https://www.coursera.org/professional-certificates/google-data-analytics",
    instructor: null,
    effort: "8-10 hrs/week",
    prerequisite: "None.",
    outcomes: [
      "Clean and join messy data in spreadsheets and SQL",
      "Build a dashboard that answers one stated business question",
      "Present a finding to a non-technical audience without jargon",
    ],
  },
  {
    id: 'crs-financial-markets',
    title: 'Financial Markets',
    provider: 'coursera',
    taughtBy: 'Yale University',
    duration: '~7 weeks',
    level: 'Beginner',
    faculty: 'business',
    alsoFor: [],
    theme: 'emerald',
    xp: 300,
    skillBadge: 'Capital Markets Literacy',
    tags: ['Financial Modeling', 'Valuation', 'Critical Thinking'],
    summary: 'Risk, behavioural finance and how the institutions behind modern markets actually work.',
    url: "https://www.coursera.org/learn/financial-markets-global",
    instructor: "Robert J. Shiller",
    effort: "4-6 hrs/week",
    prerequisite: "None.",
    outcomes: [
      "Explain how risk is priced across the main asset classes",
      "Read market news critically rather than descriptively",
      "Connect behavioural finance ideas to a real market episode",
    ],
  },
  {
    id: 'crs-excel-business',
    title: 'Excel Skills for Business Specialization',
    provider: 'coursera',
    taughtBy: 'Macquarie University',
    duration: '~6 months',
    level: 'Beginner',
    faculty: 'business',
    alsoFor: ['hospitality', 'education'],
    theme: 'emerald',
    xp: 300,
    skillBadge: 'Spreadsheet Analyst',
    tags: ['Productivity', 'Analytics', 'Financial Modeling'],
    summary: 'From clean data entry to dashboards, lookups and the modelling habits employers assume you have.',
    url: null,
    instructor: null,
    effort: "4-5 hrs/week",
    prerequisite: "Comfort with basic spreadsheet formulas.",
    outcomes: [
      "Build a financial model that a reviewer can follow",
      "Use lookup, pivot and scenario tools without hunting for them",
      "Sit an Excel-based assessment centre task with confidence",
    ],
  },
  {
    id: 'edx-supply-chain',
    title: 'Supply Chain Analytics',
    provider: 'edx',
    taughtBy: 'Massachusetts Institute of Technology (MITx)',
    duration: '~10 weeks',
    level: 'Intermediate',
    faculty: 'business',
    alsoFor: ['computing_engineering'],
    theme: 'sky',
    xp: 350,
    skillBadge: 'Supply Chain Analyst',
    tags: ['Analytics', 'Optimisation', 'Critical Thinking'],
    summary: 'Modelling, forecasting and optimisation applied to real logistics and inventory problems.',
    url: null,
    instructor: null,
    effort: "5-7 hrs/week",
    prerequisite: "None.",
    outcomes: [
      "Map an end-to-end supply chain and locate its bottleneck",
      "Apply basic inventory and demand-planning models",
      "Quantify a trade-off between cost and service level",
    ],
  },
  {
    id: 'crs-clinical-trials',
    title: 'Design and Interpretation of Clinical Trials',
    provider: 'coursera',
    taughtBy: 'Johns Hopkins University',
    duration: '~5 weeks',
    level: 'Intermediate',
    faculty: 'medicine',
    alsoFor: ['pharmacy', 'lifesciences'],
    theme: 'crimson',
    xp: 400,
    skillBadge: 'Clinical Trial Literacy',
    tags: ['Clinical Skills', 'Critical Thinking', 'Research'],
    summary: 'Trial design, randomisation, blinding and how to read a published result without being fooled.',
    url: null,
    instructor: null,
    effort: "4-6 hrs/week",
    prerequisite: "Pre-clinical study or equivalent.",
    outcomes: [
      "Describe trial phases and the ethics approval pathway",
      "Read a published trial and identify its primary endpoint and limitations",
      "Explain informed consent to a patient in plain language",
    ],
  },
  {
    id: 'crs-epidemiology',
    title: 'Epidemiology: The Basic Science of Public Health',
    provider: 'coursera',
    taughtBy: 'The University of North Carolina at Chapel Hill',
    duration: '~6 weeks',
    level: 'Beginner',
    faculty: 'medicine',
    alsoFor: ['lifesciences', 'pharmacy'],
    theme: 'emerald',
    xp: 300,
    skillBadge: 'Public Health Foundations',
    tags: ['Clinical Skills', 'Analytics', 'Research'],
    summary: 'Study designs, measures of association and the reasoning behind population-level evidence.',
    url: null,
    instructor: null,
    effort: "4-6 hrs/week",
    prerequisite: "Basic statistics.",
    outcomes: [
      "Choose an appropriate study design for a research question",
      "Interpret relative risk and odds ratios correctly",
      "Spot confounding and bias in a published paper",
    ],
  },
  {
    id: 'crs-drug-discovery',
    title: 'Drug Discovery',
    provider: 'coursera',
    taughtBy: 'University of California San Diego',
    duration: '~5 weeks',
    level: 'Intermediate',
    faculty: 'pharmacy',
    alsoFor: ['lifesciences', 'medicine'],
    theme: 'indigo',
    xp: 400,
    skillBadge: 'Drug Discovery Foundations',
    tags: ['Pharmacology', 'Research', 'Regulatory'],
    summary: 'Target identification through lead optimisation, and the regulatory gates in between.',
    url: null,
    instructor: null,
    effort: "5-7 hrs/week",
    prerequisite: "Foundational pharmacology or chemistry.",
    outcomes: [
      "Trace a compound from target identification to first-in-human",
      "Explain pharmacokinetics to a non-specialist",
      "Discuss the regulatory gates a candidate drug must clear",
    ],
  },
  {
    id: 'crs-genomic-data',
    title: 'Genomic Data Science Specialization',
    provider: 'coursera',
    taughtBy: 'Johns Hopkins University',
    duration: '~4 months',
    level: 'Intermediate',
    faculty: 'lifesciences',
    alsoFor: ['medicine', 'computing_engineering'],
    theme: 'sky',
    xp: 450,
    skillBadge: 'Genomic Data Analyst',
    tags: ['Research', 'Analytics', 'Python'],
    summary: 'Sequencing workflows, alignment and statistics for genomics, using Python, R and Bioconductor.',
    url: null,
    instructor: null,
    effort: "5-7 hrs/week",
    prerequisite: "Introductory biology; some command-line comfort helps.",
    outcomes: [
      "Run a standard genomic analysis pipeline end to end",
      "Interpret and sanity-check sequencing quality metrics",
      "Document an analysis so someone else can reproduce it",
    ],
  },
  {
    id: 'crs-teach-english',
    title: 'Teach English Now! Foundational Principles',
    provider: 'coursera',
    taughtBy: 'Arizona State University',
    duration: '~5 weeks',
    level: 'Beginner',
    faculty: 'education',
    alsoFor: ['communication'],
    theme: 'amber',
    xp: 300,
    skillBadge: 'TESL Foundations',
    tags: ['Teaching', 'Communication', 'TESL'],
    summary: 'Second-language acquisition theory turned into lesson design you can defend to a supervisor.',
    url: null,
    instructor: null,
    effort: "3-5 hrs/week",
    prerequisite: "None.",
    outcomes: [
      "Plan a lesson with stated, observable learning objectives",
      "Adapt an activity for mixed proficiency in one classroom",
      "Give corrective feedback that does not shut a learner down",
    ],
  },
  {
    id: 'crs-learning-how',
    title: 'Learning How to Learn',
    provider: 'coursera',
    taughtBy: 'Deep Teaching Solutions',
    duration: '~4 weeks',
    level: 'Beginner',
    faculty: 'all',
    alsoFor: [],
    theme: 'amber',
    xp: 200,
    skillBadge: 'Study Strategy',
    tags: ['Productivity', 'Critical Thinking', 'Career Planning'],
    summary: 'Evidence-based study technique — chunking, spaced practice and beating procrastination.',
    url: "https://www.coursera.org/learn/learning-how-to-learn",
    instructor: "Barbara Oakley and Terrence Sejnowski",
    effort: "2-3 hrs/week",
    prerequisite: "None.",
    outcomes: [
      "Use spaced retrieval instead of re-reading before assessments",
      "Recognise and interrupt your own procrastination pattern",
      "Explain how you study — a question interviewers genuinely ask",
    ],
  },
  {
    id: 'li-communication',
    title: 'Communication Foundations',
    provider: 'linkedin',
    taughtBy: 'LinkedIn Learning',
    duration: '~2 hours',
    level: 'Beginner',
    faculty: 'communication',
    alsoFor: 'all',
    theme: 'sky',
    xp: 150,
    skillBadge: 'Professional Communicator',
    tags: ['Communication', 'Leadership', 'Career Planning'],
    summary: 'The four building blocks of workplace communication, including tone, audience and channel.',
    url: null,
    instructor: null,
    effort: "2-3 hrs/week",
    prerequisite: "None.",
    outcomes: [
      "Structure a short talk so the point lands in the first minute",
      "Handle a hostile or confused question without deflecting",
      "Write an email that gets a reply",
    ],
  },
  {
    id: 'crs-hotel-revenue',
    title: 'Hotel Management: Distribution, Revenue and Demand Management',
    provider: 'coursera',
    taughtBy: 'ESSEC Business School',
    duration: '~3 months',
    level: 'Intermediate',
    faculty: 'hospitality',
    alsoFor: ['business'],
    theme: 'emerald',
    xp: 350,
    skillBadge: 'Revenue Management',
    tags: ['Revenue Management', 'Analytics', 'Hospitality'],
    summary: 'Distribution channels, pricing and demand forecasting for hotels and travel operators.',
    url: null,
    instructor: null,
    effort: "4-5 hrs/week",
    prerequisite: "None.",
    outcomes: [
      "Explain RevPAR and the levers that actually move it",
      "Set a rate strategy for a stated demand scenario",
      "Read an occupancy forecast and act on it",
    ],
  },
];

/**
 * CPDC-curated bundles. The blueprint asks for 3-5 courses grouped into a
 * themed path with visible progress, so a student sees a route rather than a
 * shelf. `courses` holds catalogue ids in the intended order.
 */
export const LEARNING_PATHS = [
  {
    id: 'path-data-analytics',
    title: 'Data Analytics Starter Path',
    curator: 'CPDC Digital Skills',
    faculty: 'business',
    alsoFor: ['computing_engineering', 'lifesciences'],
    theme: 'amber',
    blurb: 'Zero to a defensible analytics portfolio: tooling, spreadsheets, then a full analyst certificate.',
    bonusXp: 250,
    courses: ['crs-excel-business', 'crs-google-data', 'edx-supply-chain'],
  },
  {
    id: 'path-ai-engineer',
    title: 'AI Engineer Path',
    curator: 'CPDC x Faculty of Computing & Engineering',
    faculty: 'computing_engineering',
    alsoFor: [],
    theme: 'indigo',
    blurb: 'Foundations, then classical ML, then deep learning — with the cloud layer employers ask about.',
    bonusXp: 400,
    courses: ['edx-cs50', 'crs-ml-spec', 'crs-deep-learning', 'crs-cloud-leader'],
  },
  {
    id: 'path-clinical-research',
    title: 'Clinical Research Readiness Path',
    curator: 'CPDC x Faculty of Medicine',
    faculty: 'medicine',
    alsoFor: ['pharmacy', 'lifesciences'],
    theme: 'crimson',
    blurb: 'Read, appraise and contribute to clinical evidence before your first research attachment.',
    bonusXp: 300,
    courses: ['crs-epidemiology', 'crs-clinical-trials', 'crs-genomic-data'],
  },
  {
    id: 'path-graduate-ready',
    title: 'Graduate Ready Path',
    curator: 'CPDC Careers Team',
    faculty: 'all',
    alsoFor: [],
    theme: 'sky',
    blurb: 'The cross-faculty baseline: how to learn, how to communicate, how to work a spreadsheet.',
    bonusXp: 200,
    courses: ['crs-learning-how', 'li-communication', 'crs-excel-business'],
  },
];

/**
 * Certificates awaiting a CPDC decision, for the staff verification queue.
 *
 * Clearly fictional demo students, in the same spirit as the rest of the
 * prototype fixtures — no real student record is represented here.
 */
export const DEMO_CERTIFICATE_QUEUE = [
  {
    id: 'sub-demo-1',
    studentName: 'Priya Ramasamy (demo)',
    studentId: 'STU-2026-4471',
    programme: 'Bachelor of Business Administration (Honours)',
    facultyId: 'business',
    courseId: 'crs-google-data',
    evidenceType: 'link',
    evidence: 'https://coursera.org/verify/DEMO-PLACEHOLDER-4471',
    submittedAt: '2026-07-27',
    status: 'PENDING',
  },
  {
    id: 'sub-demo-2',
    studentName: 'Wei Jian Tan (demo)',
    studentId: 'STU-2026-1180',
    programme: 'Bachelor of Computer Science (Honours)',
    facultyId: 'computing_engineering',
    courseId: 'crs-cloud-leader',
    evidenceType: 'file',
    evidence: 'cloud-digital-leader-certificate.pdf',
    submittedAt: '2026-07-29',
    status: 'PENDING',
  },
  {
    id: 'sub-demo-3',
    studentName: 'Nurul Aisyah Binti Kamal (demo)',
    studentId: 'STU-2026-2203',
    programme: 'Bachelor of Biomedical Sciences (Honours)',
    facultyId: 'medicine',
    courseId: 'crs-epidemiology',
    evidenceType: 'link',
    evidence: 'https://coursera.org/verify/DEMO-PLACEHOLDER-2203',
    submittedAt: '2026-07-30',
    status: 'PENDING',
  },
];

/** Catalogue lookup by id. */
export function courseById(id) {
  return COURSE_CATALOGUE.find((course) => course.id === id) ?? null;
}

/** Where a provider's search lives, for courses whose canonical URL we don't hold. */
const PROVIDER_SEARCH = {
  coursera: 'https://www.coursera.org/search?query=',
  edx: 'https://www.edx.org/search?q=',
  linkedin: 'https://www.linkedin.com/learning/search?keywords=',
};

/**
 * The link a student should actually follow, and whether it is the course
 * itself or a search for it.
 *
 * Only canonical URLs we are confident are real are stored on a course.
 * Guessing a deep link would send students to a 404 and quietly imply CPDC
 * verified a page nobody checked — so anything unknown degrades to a provider
 * search, and the UI says so rather than dressing it up as a direct link.
 */
export function courseLink(course) {
  if (course?.url) {
    return { href: course.url, exact: true, label: `Open on ${PROVIDERS[course.provider]?.label ?? course.provider}` };
  }
  const base = PROVIDER_SEARCH[course?.provider];
  if (!base) return null;
  return {
    href: `${base}${encodeURIComponent(course.title)}`,
    exact: false,
    label: `Find on ${PROVIDERS[course.provider]?.label ?? course.provider}`,
  };
}

/** Who fronts the course: a named instructor when public, else the publisher. */
export function courseCredit(course) {
  if (course?.instructor) {
    return { name: course.instructor, kind: 'instructor', publishedBy: course.taughtBy };
  }
  return { name: course?.taughtBy ?? 'Unknown', kind: 'publisher', publishedBy: course?.taughtBy };
}

/** True when CPDC lists this course for the given faculty. */
export function servesFaculty(item, facultyId) {
  if (!facultyId) return false;
  if (item.faculty === 'all' || item.alsoFor === 'all') return true;
  if (item.faculty === facultyId) return true;
  return Array.isArray(item.alsoFor) && item.alsoFor.includes(facultyId);
}

/**
 * Score a course for a student.
 *
 * Deliberately delegates to `workshopMatch` so the platform has ONE explainable
 * scoring algorithm and one set of admin-tunable weights. The only adaptation
 * is faculty: a course can be listed for several faculties, so a course the
 * student's faculty is served by is presented to the scorer as a faculty hit.
 */
export function courseMatch(course, context = {}) {
  const { facultyId } = context;
  const normalised = {
    ...course,
    faculty: servesFaculty(course, facultyId) ? facultyId : course.faculty,
  };
  return workshopMatch(normalised, context);
}

/** "Bachelor of Computer Science (Honours)" -> "Computer Science". */
export function shortProgramme(programme) {
  return String(programme ?? '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/^(bachelor|master|diploma|foundation|doctor)\s+(of|in)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim() || 'your programme';
}

/**
 * One plain-English line explaining why a course was surfaced.
 *
 * Blueprint §12.4: matched items are sorted first but nothing is ever hidden,
 * and every recommendation must say *why* in a sentence a first-year can read.
 */
export function whyRecommended(course, { programme, year, gapTags = [], facultyId } = {}) {
  const parts = [];

  if (servesFaculty(course, facultyId)) {
    parts.push(`you're in ${shortProgramme(programme)}${year ? ` Year ${year}` : ''}`);
  }

  const gapHit = (gapTags ?? []).find((tag) => course.tags.some(
    (courseTag) => courseTag.toLowerCase() === String(tag).toLowerCase(),
  ));
  if (gapHit) parts.push(`your diagnostic flagged ${gapHit}`);

  if (!parts.length) return `Open to every QIU student — CPDC lists it for ${course.level.toLowerCase()} learners.`;
  return `Because ${parts.join(' and ')}.`;
}

/** Progress of a student through a curated path. */
export function pathProgress(path, statusById = {}) {
  const total = path.courses.length;
  const verified = path.courses.filter((id) => statusById[id] === 'VERIFIED').length;
  const pending = path.courses.filter((id) => statusById[id] === 'PENDING').length;
  return {
    total,
    verified,
    pending,
    complete: total > 0 && verified === total,
    percent: total === 0 ? 0 : Math.round((verified / total) * 100),
  };
}
