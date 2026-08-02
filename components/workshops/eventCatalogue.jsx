// Module 3 — event catalogue.
//
// The four seeded workshops in lib/data/facultyData.js are the records prisma
// seeds from, so they stay the source of truth for id / title / date / QR
// secret. Everything Module 3 adds on top (category, capacity, target years,
// speaker role + bio, materials, past events) is layered here by id, plus a set
// of additional clearly-fictional demo events so the catalogue shows past, live
// and upcoming states and a real archive.
//
// When this data moves to the database, this file is the seam: replace
// `allEvents()` with a fetch and every component below keeps working.

import { WORKSHOPS } from '@/lib/data/facultyData';

/**
 * Blueprint categories. `tone` drives the card banner; every card also states
 * its category in words, so meaning is never carried by colour alone.
 */
export const CATEGORIES = {
  technical: { id: 'technical', label: 'Technical', tone: 'from-slate-700 to-slate-950' },
  soft: { id: 'soft', label: 'Soft skills', tone: 'from-amber-600 to-amber-900' },
  industry: { id: 'industry', label: 'Industry talk', tone: 'from-sky-700 to-sky-950' },
  clinical: { id: 'clinical', label: 'Clinical / field', tone: 'from-teal-600 to-teal-950' },
  entrepreneurship: { id: 'entrepreneurship', label: 'Entrepreneurship', tone: 'from-rose-600 to-rose-950' },
  postgraduate: { id: 'postgraduate', label: 'Postgraduate only', tone: 'from-indigo-700 to-indigo-950' },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

/** Display format used by the seeded fixtures and parsed by prisma/seed.mjs. */
export const DATE_FORMAT_HINT = '2026-09-05 | 14:00 GMT+8';

const DATE_RE = /^(\d{4}-\d{2}-\d{2})\s*\|\s*(\d{2}:\d{2})\s*GMT([+-]\d{1,2})$/;

/** Parse "2026-08-15 | 14:00 GMT+8" into a Date, or null if malformed. */
export function parseEventDate(value) {
  const match = DATE_RE.exec(String(value ?? '').trim());
  if (!match) return null;
  const [, day, time, offsetHours] = match;
  const sign = offsetHours.startsWith('-') ? '-' : '+';
  const offset = `${sign}${String(Math.abs(Number(offsetHours))).padStart(2, '0')}:00`;
  const parsed = new Date(`${day}T${time}:00${offset}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True when a string is in the format prisma/seed.mjs can parse. */
export function isValidEventDate(value) {
  return parseEventDate(value) !== null;
}

const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000; // doors open until 3h after start

/** 'past' | 'live' | 'upcoming' — derived, never stored. */
export function eventStatus(event, now = Date.now()) {
  const start = parseEventDate(event.date);
  if (!start) return 'upcoming';
  const startMs = start.getTime();
  if (now < startMs - 30 * 60 * 1000) return 'upcoming';
  if (now <= startMs + LIVE_WINDOW_MS) return 'live';
  return 'past';
}

export function formatEventDate(event) {
  const start = parseEventDate(event.date);
  if (!start) return event.date ?? 'Date to be confirmed';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur',
  }).format(start) + ' (GMT+8)';
}

/** Initials for the avatar chip — never an <img>, so never a broken image. */
export function initialsOf(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

/** "Elena Rostova (Lead AI Scientist)" -> { name, role }. */
function splitSpeaker(value) {
  const raw = String(value ?? '').trim();
  const match = /^(.*?)\s*\((.+)\)\s*$/.exec(raw);
  if (match) return { name: match[1], role: match[2] };
  return { name: raw || 'Facilitator to be confirmed', role: '' };
}

// Detail the seeded fixtures do not carry. Bios are written for the prototype
// and are deliberately generic about employers — no claims are made about any
// real organisation.
const SEED_DETAIL = {
  w1: {
    category: 'technical',
    summary: 'Build and evaluate a small model end to end, then walk through how hiring panels read an AI portfolio.',
    speakerBio: 'Fifteen years building production machine-learning systems; mentors final-year AI projects.',
    capacity: 120,
    seatsTaken: 86,
    years: [2, 3, 4],
    programmes: ['Bachelor of Computer Science (Honours)'],
    materials: [],
  },
  w2: {
    category: 'industry',
    summary: 'A live three-statement model built from a blank sheet, then a walkthrough of how deal teams pressure-test assumptions.',
    speakerBio: 'Corporate finance practitioner and case-competition judge.',
    capacity: 90,
    seatsTaken: 71,
    years: [2, 3, 4],
    programmes: [],
    materials: [],
  },
  w3: {
    category: 'clinical',
    summary: 'Timed OSCE stations on airway assessment and escalation, with individual feedback after each rotation.',
    speakerBio: 'Consultant surgeon and long-standing OSCE examiner.',
    capacity: 40,
    seatsTaken: 38,
    years: [3, 4],
    programmes: [],
    materials: [],
  },
  w4: {
    category: 'clinical',
    summary: 'Dispensing accuracy drills plus the documentation trail a regulator expects to see.',
    speakerBio: 'Regulatory affairs pharmacist working on GMP compliance audits.',
    capacity: 60,
    seatsTaken: 27,
    years: [2, 3, 4],
    programmes: [],
    materials: [],
  },
};

// Additional demo events. All people and organisations here are fictional.
const EXTRA_EVENTS = [
  {
    id: 'w-arch-1',
    title: 'Industry Talk: What an Applied AI Career Actually Looks Like',
    faculty: 'computing_engineering',
    category: 'industry',
    speaker: { name: 'Priya Nadarajah', role: 'Machine Learning Engineer (guest speaker)', bio: 'Works on recommendation systems and runs an open-source study group for graduates.' },
    date: '2026-07-22 | 16:00 GMT+8',
    location: 'Auditorium 2',
    summary: 'An honest account of the first three years in an AI role: the work, the interviews, and the parts nobody advertises.',
    tags: ['Artificial Intelligence', 'Deep Learning', 'Career Planning'],
    years: [2, 3, 4],
    programmes: [],
    capacity: 150,
    seatsTaken: 141,
    xpReward: 150,
    materials: [
      { title: 'Talk slides (PDF)', type: 'Slides' },
      { title: 'Portfolio checklist', type: 'Worksheet' },
    ],
  },
  {
    id: 'w-arch-2',
    title: 'Cloud Fundamentals Lab: Deploy Your First Service',
    faculty: 'computing_engineering',
    category: 'technical',
    speaker: { name: 'Daniel Ooi', role: 'Platform Engineer (guest facilitator)', bio: 'Spends his week on deployment pipelines and his weekends teaching them.' },
    date: '2026-07-04 | 10:00 GMT+8',
    location: 'Computing Lab 4',
    summary: 'Containers, environments and a first deployment — the vocabulary interviewers assume you already have.',
    tags: ['Cloud Fundamentals', 'Productivity', 'Python'],
    years: [1, 2, 3],
    programmes: ['Bachelor of Computer Science (Honours)'],
    capacity: 45,
    seatsTaken: 45,
    xpReward: 200,
    materials: [
      { title: 'Lab handbook', type: 'Guide' },
      { title: 'Starter repository', type: 'Code' },
    ],
  },
  {
    id: 'w-arch-3',
    title: 'Resume Clinic: From Transcript to Shortlist',
    faculty: null,
    category: 'soft',
    speaker: { name: 'Marina Yusof', role: 'CPDC Career Adviser', bio: 'Reviews several hundred student CVs a semester and keeps a list of the recurring mistakes.' },
    date: '2026-06-12 | 14:00 GMT+8',
    location: 'CPDC Career Studio',
    summary: 'Bring a draft, leave with a rewritten first half — the section recruiters actually read.',
    tags: ['Communication', 'Career Planning'],
    years: [],
    programmes: [],
    capacity: 80,
    seatsTaken: 74,
    xpReward: 150,
    materials: [
      { title: 'CV rewrite worksheet', type: 'Worksheet' },
      { title: 'Before / after examples', type: 'Slides' },
    ],
  },
  {
    id: 'w-soft-1',
    title: 'Interview Storytelling: Answering the Hard Questions',
    faculty: null,
    category: 'soft',
    speaker: { name: 'Aaron Sim', role: 'Communication Coach (guest facilitator)', bio: 'Coaches graduates through panel interviews and assessment centres.' },
    date: '2026-08-13 | 15:00 GMT+8',
    location: 'CPDC Career Studio',
    summary: 'Structure a two-minute answer about failure, gaps or a weak grade without losing the room.',
    tags: ['Communication', 'Leadership', 'Career Planning'],
    years: [],
    programmes: [],
    capacity: 60,
    seatsTaken: 22,
    xpReward: 150,
    materials: [],
  },
  {
    id: 'w-ent-1',
    title: "Founders' Circle: Validating Your First Customer",
    faculty: null,
    category: 'entrepreneurship',
    speaker: { name: 'Hafiz Rahman', role: 'Founder in residence (fictional demo profile)', bio: 'Started two small ventures, closed one, and talks openly about both.' },
    date: '2026-08-05 | 18:00 GMT+8',
    location: 'Innovation Hub, Level 2',
    summary: 'Ten customer conversations before a single line of code — the exercise, then the debrief.',
    tags: ['Entrepreneurship', 'Critical Thinking', 'Leadership'],
    years: [],
    programmes: [],
    capacity: 50,
    seatsTaken: 31,
    xpReward: 200,
    materials: [],
  },
  {
    id: 'w-pg-1',
    title: 'Postgraduate Lab: Research Funding & Grant Writing',
    faculty: null,
    category: 'postgraduate',
    speaker: { name: 'Dr. Lena Kaur', role: 'Research Development Officer', bio: 'Supports postgraduate candidates through their first external funding applications.' },
    date: '2026-08-27 | 11:00 GMT+8',
    location: 'Postgraduate Centre, Seminar Room 1',
    summary: 'Turn a research question into a fundable proposal, with a structure reviewers expect.',
    tags: ['Research', 'Communication', 'Critical Thinking'],
    years: [4],
    programmes: [],
    capacity: 30,
    seatsTaken: 12,
    xpReward: 220,
    materials: [],
  },
  {
    id: 'w-clin-1',
    title: 'Ward Communication & Patient Handover Drills',
    faculty: 'medicine',
    category: 'clinical',
    speaker: { name: 'Dr. Amirah Zainal', role: 'Emergency Physician (guest facilitator)', bio: 'Runs handover training for junior doctors and has strong views on shortcuts.' },
    date: '2026-08-09 | 09:00 GMT+8',
    location: 'Medical Simulation Center Ward 1',
    summary: 'Structured handover under time pressure, including what to do when you are interrupted mid-sentence.',
    tags: ['Clinical Skills', 'Communication', 'OSCE'],
    years: [2, 3, 4],
    programmes: [],
    capacity: 36,
    seatsTaken: 30,
    xpReward: 250,
    materials: [],
  },
];

/**
 * The full catalogue: seeded workshops enriched with Module 3 detail, plus the
 * demo events above. Nothing is filtered here — filtering belongs to the UI,
 * and even there it is always student-driven, never automatic.
 */
export function allEvents() {
  const seeded = WORKSHOPS.map((workshop) => {
    const detail = SEED_DETAIL[workshop.id] ?? {};
    const { name, role } = splitSpeaker(workshop.speaker);
    return {
      id: workshop.id,
      title: workshop.title,
      faculty: workshop.faculty ?? null,
      category: detail.category ?? 'technical',
      speaker: { name, role: role || 'Guest facilitator', bio: detail.speakerBio ?? '' },
      date: workshop.date,
      location: workshop.location,
      summary: detail.summary ?? '',
      tags: workshop.tags ?? [],
      years: detail.years ?? [],
      programmes: detail.programmes ?? [],
      capacity: detail.capacity ?? 100,
      seatsTaken: detail.seatsTaken ?? 0,
      xpReward: workshop.xpReward ?? 150,
      qrCode: null,
      materials: detail.materials ?? [],
      registered: Boolean(workshop.registered),
    };
  });

  return [...seeded, ...EXTRA_EVENTS].map((event) => ({
    registered: false,
    materials: [],
    ...event,
  }));
}

/**
 * Venue check-in code shown at the event and typed by the student.
 * Derived from the event's QR secret so it is stable across reloads and the
 * same on the staff screen and the student screen.
 */
export function checkInCodeFor(event) {
  const source = String(event?.qrCode ?? event?.id ?? '');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 1000000;
  }
  return String(hash).padStart(6, '0');
}
