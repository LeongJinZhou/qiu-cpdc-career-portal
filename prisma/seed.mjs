// Seeds the university hierarchy from the same registry the UI renders, so the
// database and the prototype's fixtures cannot drift apart.

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { FACULTIES, DEFAULT_STUDENT, WORKSHOPS } from '../lib/data/facultyData.js';
import { formatStudentId } from '../lib/identity/student-id.js';

const prisma = new PrismaClient();

// Set SEED_PROFILE=production on the host (render.yaml does). NODE_ENV is not
// used: Render builds without it so devDependencies (prisma) still install.
const PRODUCTION = process.env.SEED_PROFILE === 'production';

const LEVEL_MAP = {
  Foundation: 'FOUNDATION',
  Diploma: 'DIPLOMA',
  Bachelor: 'BACHELOR',
  Professional: 'PROFESSIONAL',
  Postgraduate: 'POSTGRADUATE',
};

function toLevel(level) {
  const mapped = LEVEL_MAP[level];
  if (!mapped) throw new Error(`Unmapped programme level: ${level}`);
  return mapped;
}

async function seedFaculties() {
  for (const faculty of FACULTIES) {
    await prisma.faculty.upsert({
      where: { id: faculty.id },
      update: {
        name: faculty.name,
        code: faculty.code,
        color: faculty.color,
        icon: faculty.icon,
        description: faculty.description,
        logFields: faculty.systemAssignment.logFields,
        features: faculty.systemAssignment.features,
      },
      create: {
        id: faculty.id,
        name: faculty.name,
        code: faculty.code,
        color: faculty.color,
        icon: faculty.icon,
        description: faculty.description,
        logFields: faculty.systemAssignment.logFields,
        features: faculty.systemAssignment.features,
      },
    });

    for (const programme of faculty.programmes) {
      await prisma.programme.upsert({
        where: {
          facultyId_name: { facultyId: faculty.id, name: programme.name },
        },
        update: { level: toLevel(programme.level) },
        create: {
          facultyId: faculty.id,
          name: programme.name,
          level: toLevel(programme.level),
        },
      });
    }
  }

  const facultyCount = await prisma.faculty.count();
  const programmeCount = await prisma.programme.count();
  console.log(`  faculties: ${facultyCount}, programmes: ${programmeCount}`);
}

async function seedDemoStudent() {
  const programme = await prisma.programme.findFirst({
    where: { facultyId: DEFAULT_STUDENT.facultyId, name: DEFAULT_STUDENT.programme },
  });

  if (!programme) {
    throw new Error(`Demo student's programme not found: ${DEFAULT_STUDENT.programme}`);
  }

  const user = await prisma.user.upsert({
    where: { email: DEFAULT_STUDENT.email },
    update: {
      name: DEFAULT_STUDENT.name,
      avatarUrl: DEFAULT_STUDENT.avatarUrl,
      normalizedEmail: DEFAULT_STUDENT.email.toLowerCase(),
      loginAllowed: true,
      accountStatus: 'ACTIVE',
      identitySource: 'SEEDED',
    },
    create: {
      email: DEFAULT_STUDENT.email,
      normalizedEmail: DEFAULT_STUDENT.email.toLowerCase(),
      name: DEFAULT_STUDENT.name,
      avatarUrl: DEFAULT_STUDENT.avatarUrl,
      role: 'STUDENT',
      loginAllowed: true,
      accountStatus: 'ACTIVE',
      identitySource: 'SEEDED',
    },
  });

  const canonicalMatricNo = formatStudentId({
    intakeYearMonth: DEFAULT_STUDENT.intakeYearMonth,
    sequence: DEFAULT_STUDENT.intakeSequence,
  });

  const student = await prisma.student.upsert({
    where: { userId: user.id },
    update: {
      matricNo: canonicalMatricNo,
      intakeYearMonth: DEFAULT_STUDENT.intakeYearMonth,
      intakeSequence: DEFAULT_STUDENT.intakeSequence,
      academicYear: DEFAULT_STUDENT.year,
      facultyId: DEFAULT_STUDENT.facultyId,
      programmeId: programme.id,
    },
    create: {
      matricNo: canonicalMatricNo,
      intakeYearMonth: DEFAULT_STUDENT.intakeYearMonth,
      intakeSequence: DEFAULT_STUDENT.intakeSequence,
      academicYear: DEFAULT_STUDENT.year,
      userId: user.id,
      facultyId: DEFAULT_STUDENT.facultyId,
      programmeId: programme.id,
    },
  });

  for (const badge of DEFAULT_STUDENT.badges) {
    await prisma.badge.upsert({
      where: { studentId_title: { studentId: student.id, title: badge.title } },
      update: {},
      create: {
        studentId: student.id,
        title: badge.title,
        category: badge.category,
        icon: badge.icon,
        xp: badge.xp,
        awardedAt: new Date(badge.date),
      },
    });

    // Badge XP flows through the ledger like every other award, so the derived
    // total stays consistent with the badge list.
    await prisma.xpEvent.upsert({
      where: { dedupeKey: `badge:${student.id}:${badge.title}` },
      update: {},
      create: {
        dedupeKey: `badge:${student.id}:${badge.title}`,
        studentId: student.id,
        amount: badge.xp,
        source: 'BADGE_AWARD',
        note: badge.title,
      },
    });
  }

  for (const entry of DEFAULT_STUDENT.logbookEntries) {
    // Each seeded entry carries a supervisor sign-off record so the logbook UI
    // shows a real reviewer (and, for APPROVED rows, a decision) rather than
    // falling back to "No supervisor assigned". The token is hashed, never
    // stored raw — same discipline as the live magic-link route.
    const decided = entry.status === 'APPROVED' || entry.status === 'REJECTED';
    const tokenHash = crypto.createHash('sha256').update(`seed-${entry.id}`).digest('hex');

    await prisma.logbookEntry.upsert({
      where: { id: entry.id },
      update: {},
      create: {
        id: entry.id,
        studentId: student.id,
        title: entry.title,
        details: entry.details,
        hours: entry.hours,
        entryDate: new Date(entry.date),
        status: entry.status,
        fieldValues: {},
      },
    });

    // Upsert the sign-off separately (keyed by the one-to-one logbookEntryId)
    // so re-seeding an existing entry still backfills its supervisor record.
    await prisma.supervisorApproval.upsert({
      where: { logbookEntryId: entry.id },
      update: {
        supervisorName: entry.supervisor ?? 'Field Supervisor',
        decision: decided ? entry.status : null,
        usedAt: decided ? new Date(entry.date) : null,
        comment: decided ? 'Verified against placement records.' : null,
      },
      create: {
        logbookEntryId: entry.id,
        supervisorName: entry.supervisor ?? 'Field Supervisor',
        tokenHash,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        decision: decided ? entry.status : null,
        usedAt: decided ? new Date(entry.date) : null,
        comment: decided ? 'Verified against placement records.' : null,
      },
    });
  }

  const total = await prisma.xpEvent.aggregate({
    where: { studentId: student.id },
    _sum: { amount: true },
  });
  console.log(`  demo student ${student.matricNo}, ledger XP: ${total._sum.amount ?? 0}`);
}

/**
 * Workshop dates in the UI registry are display strings, not ISO timestamps:
 *   "2026-08-15 | 14:00 GMT+8"
 * Passing that straight to `new Date()` yields Invalid Date, which Prisma
 * rejects. Parse it explicitly, and throw rather than silently storing a bad
 * timestamp that would misorder every workshop listing.
 */
function parseWorkshopDate(value, workshopId) {
  const match = /^(\d{4}-\d{2}-\d{2})\s*\|\s*(\d{2}:\d{2})\s*GMT([+-]\d{1,2})$/.exec(value ?? '');

  if (!match) {
    throw new Error(`Workshop ${workshopId}: unrecognised date format "${value}"`);
  }

  const [, day, time, offsetHours] = match;
  const offset = `${offsetHours.startsWith('-') ? '-' : '+'}${String(
    Math.abs(Number(offsetHours)),
  ).padStart(2, '0')}:00`;

  const parsed = new Date(`${day}T${time}:00${offset}`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Workshop ${workshopId}: could not parse date "${value}"`);
  }
  return parsed;
}

async function seedWorkshops() {
  const facultyIds = new Set((await prisma.faculty.findMany({ select: { id: true } })).map((f) => f.id));

  for (const workshop of WORKSHOPS) {
    // The registry uses `faculty`; a workshop pointing at an unknown faculty is
    // treated as university-wide rather than failing the whole seed.
    const facultyId = facultyIds.has(workshop.faculty) ? workshop.faculty : null;
    // A random QR secret is set once, on create. Re-seeding must never rotate
    // it: printed QR codes would stop working after every deploy. Static demo
    // content still never carries a predictable QR secret into the bundle.
    const qrSecret = crypto.randomBytes(32).toString('hex');

    await prisma.workshop.upsert({
      where: { id: workshop.id },
      // Production keeps whatever admins edited; dev refreshes registry content.
      update: PRODUCTION ? {} : {
        description: workshop.description ?? (workshop.tags ?? []).join(', '),
        speakerBio: workshop.speakerBio ?? null,
        hostOrganization: workshop.hostOrganization ?? null,
        virtualLink: workshop.virtualLink ?? null,
        roomDetails: workshop.roomDetails ?? null,
        prerequisites: workshop.prereqs ?? null,
        agenda: workshop.agenda ?? [],
        learningOutcomes: workshop.learningOutcomes ?? [],
        category: workshop.category ?? 'CPDC Workshop',
        tags: workshop.tags ?? [],
        capacity: workshop.capacity ?? null,
        coverImage: workshop.coverImage ?? null,
      },
      create: {
        id: workshop.id,
        title: workshop.title,
        speaker: workshop.speaker ?? 'TBC',
        description: workshop.description ?? (workshop.tags ?? []).join(', '),
        location: workshop.location ?? 'TBC',
        startsAt: parseWorkshopDate(workshop.date, workshop.id),
        speakerBio: workshop.speakerBio ?? null,
        hostOrganization: workshop.hostOrganization ?? null,
        virtualLink: workshop.virtualLink ?? null,
        roomDetails: workshop.roomDetails ?? null,
        prerequisites: workshop.prereqs ?? null,
        agenda: workshop.agenda ?? [],
        learningOutcomes: workshop.learningOutcomes ?? [],
        xpValue: workshop.xpReward ?? 150,
        category: workshop.category ?? 'CPDC Workshop',
        tags: workshop.tags ?? [],
        capacity: workshop.capacity ?? null,
        coverImage: workshop.coverImage ?? null,
        facultyId,
        // The registry's QR code is the check-in secret; fall back to a random
        // one so a workshop without a code still gets a unique value.
        qrSecret,
      },
    });
  }
  console.log(`  workshops: ${await prisma.workshop.count()}`);
}

async function seedOfficialSsoTestAccounts() {
  const programme = await prisma.programme.findFirst({
    where: { facultyId: 'computing_engineering', name: 'Bachelor of Computer Science (Honours)' },
  });

  if (programme) {
    const user = await prisma.user.upsert({
      where: { email: 'yauming.soo@qiu.edu.my' },
      update: {
        normalizedEmail: 'yauming.soo@qiu.edu.my',
        loginAllowed: true,
        accountStatus: 'ACTIVE',
      },
      create: {
        email: 'yauming.soo@qiu.edu.my',
        normalizedEmail: 'yauming.soo@qiu.edu.my',
        name: 'Soo Yau Ming',
        role: 'STUDENT',
        loginAllowed: true,
        accountStatus: 'ACTIVE',
        identitySource: 'SEEDED',
      },
    });

    await prisma.student.upsert({
      where: { userId: user.id },
      update: {
        matricNo: 'QIU-202310-006958',
        courseCode: 'BCS',
        employeeId: 'QIU-202310-006958',
        employeeType: 'Student',
        facultyId: 'computing_engineering',
        programmeId: programme.id,
      },
      create: {
        userId: user.id,
        matricNo: 'QIU-202310-006958',
        courseCode: 'BCS',
        employeeId: 'QIU-202310-006958',
        employeeType: 'Student',
        facultyId: 'computing_engineering',
        programmeId: programme.id,
        academicYear: 3,
        intakeYearMonth: 202310,
        intakeSequence: 6958,
      },
    });
    console.log('  seeded QIU student yauming.soo@qiu.edu.my');

    const jzUser = await prisma.user.upsert({
      where: { email: 'jinzhou.leong@qiu.edu.my' },
      update: {
        normalizedEmail: 'jinzhou.leong@qiu.edu.my',
        loginAllowed: true,
        accountStatus: 'ACTIVE',
      },
      create: {
        email: 'jinzhou.leong@qiu.edu.my',
        normalizedEmail: 'jinzhou.leong@qiu.edu.my',
        name: 'Leong Jin Zhou',
        role: 'STUDENT',
        loginAllowed: true,
        accountStatus: 'ACTIVE',
        identitySource: 'SEEDED',
      },
    });

    await prisma.student.upsert({
      where: { userId: jzUser.id },
      update: {
        matricNo: 'QIU-202310-007000',
        courseCode: 'BCS',
        employeeId: 'QIU-202310-007000',
        employeeType: 'Student',
        facultyId: 'computing_engineering',
        programmeId: programme.id,
      },
      create: {
        userId: jzUser.id,
        matricNo: 'QIU-202310-007000',
        courseCode: 'BCS',
        employeeId: 'QIU-202310-007000',
        employeeType: 'Student',
        facultyId: 'computing_engineering',
        programmeId: programme.id,
        academicYear: 3,
        intakeYearMonth: 202310,
        intakeSequence: 7000,
      },
    });
    console.log('  seeded QIU student jinzhou.leong@qiu.edu.my');
  }

  await prisma.user.upsert({
    where: { email: 'admin@qiu.edu.my' },
    update: {
      normalizedEmail: 'admin@qiu.edu.my',
      loginAllowed: true,
      accountStatus: 'ACTIVE',
    },
    create: {
      email: 'admin@qiu.edu.my',
      normalizedEmail: 'admin@qiu.edu.my',
      name: 'QIU CPDC Administrator',
      role: 'CPDC_ADMIN',
      loginAllowed: true,
      accountStatus: 'ACTIVE',
      identitySource: 'SEEDED',
    },
  });
  console.log('  seeded QIU admin admin@qiu.edu.my');
}

// Production seed: reference data (faculties, programmes, workshops) and the
// first admin account only. No demo or test users, and nothing that re-enables
// an account an admin has since disabled.
async function seedProductionAdmin() {
  await prisma.user.upsert({
    where: { email: 'admin@qiu.edu.my' },
    update: {},
    create: {
      email: 'admin@qiu.edu.my',
      normalizedEmail: 'admin@qiu.edu.my',
      name: 'QIU CPDC Administrator',
      role: 'CPDC_ADMIN',
      loginAllowed: true,
      accountStatus: 'ACTIVE',
      identitySource: 'SEEDED',
    },
  });
  console.log('  ensured QIU admin admin@qiu.edu.my (created only if missing)');
}

async function main() {
  console.log(`Seeding CPDC platform (${PRODUCTION ? 'production' : 'development'})...`);
  await seedFaculties();
  if (PRODUCTION) {
    await seedProductionAdmin();
  } else {
    await seedDemoStudent();
    await seedOfficialSsoTestAccounts();
  }
  await seedWorkshops();
  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
