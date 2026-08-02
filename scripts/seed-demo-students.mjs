/**
 * Insert clearly-fictional demo students so the staff student directory has a
 * cohort to search, filter and page through.
 *
 * This is NOT production data and must never be mistaken for it:
 *   - every matric number starts with QIU-DEMO-
 *   - every name is suffixed "(demo)"
 *   - every address is on @demo.qiu.invalid, a reserved TLD that cannot receive mail
 *
 * Idempotent: re-running updates the same rows.
 *
 *   node scripts/seed-demo-students.mjs           # insert / refresh
 *   node scripts/seed-demo-students.mjs --remove  # delete every demo student
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MATRIC_PREFIX = 'QIU-DEMO-';
const EMAIL_DOMAIN = '@demo.qiu.invalid';

// facultyId, given name, year, and a profile shape that produces a spread of
// "record completeness" so the at-risk filter has something to filter.
const PEOPLE = [
  { faculty: 'computing_engineering', name: 'Ayu Rahman', year: 3, hours: 24, fyp: 'APPROVED', diagnostic: true, course: true },
  { faculty: 'computing_engineering', name: 'Bala Krishnan', year: 2, hours: 0, fyp: null, diagnostic: false, course: false },
  { faculty: 'computing_engineering', name: 'Chan Wei Ling', year: 4, hours: 60, fyp: 'PENDING_REVIEW', diagnostic: true, course: true },
  { faculty: 'computing_engineering', name: 'Danish Iskandar', year: 1, hours: 0, fyp: null, diagnostic: true, course: false },
  { faculty: 'medicine', name: 'Elena Marquez', year: 4, hours: 120, fyp: 'APPROVED', diagnostic: true, course: true },
  { faculty: 'medicine', name: 'Farhan Aziz', year: 3, hours: 8, fyp: null, diagnostic: false, course: false },
  { faculty: 'medicine', name: 'Grace Anand', year: 5, hours: 200, fyp: 'PENDING_REVIEW', diagnostic: true, course: true },
  { faculty: 'business', name: 'Hafiz Zulkifli', year: 2, hours: 12, fyp: null, diagnostic: true, course: true },
  { faculty: 'business', name: 'Intan Suraya', year: 3, hours: 0, fyp: 'NEEDS_CHANGES', diagnostic: false, course: true },
  { faculty: 'business', name: 'Joseph Tan', year: 1, hours: 0, fyp: null, diagnostic: false, course: false },
  { faculty: 'pharmacy', name: 'Kavitha Menon', year: 3, hours: 40, fyp: 'APPROVED', diagnostic: true, course: true },
  { faculty: 'pharmacy', name: 'Lim Jia Hui', year: 2, hours: 6, fyp: null, diagnostic: true, course: false },
  { faculty: 'lifesciences', name: 'Maryam Osman', year: 4, hours: 75, fyp: 'PENDING_REVIEW', diagnostic: true, course: true },
  { faculty: 'lifesciences', name: 'Nathan Ooi', year: 1, hours: 0, fyp: null, diagnostic: false, course: false },
  { faculty: 'education', name: 'Priya Selvam', year: 3, hours: 30, fyp: 'APPROVED', diagnostic: true, course: true },
  { faculty: 'education', name: 'Qistina Halim', year: 2, hours: 0, fyp: null, diagnostic: false, course: true },
  { faculty: 'communication', name: 'Rania Yusof', year: 3, hours: 18, fyp: 'PENDING_REVIEW', diagnostic: true, course: false },
  { faculty: 'communication', name: 'Samuel Adeyemi', year: 1, hours: 0, fyp: null, diagnostic: false, course: false },
  { faculty: 'hospitality', name: 'Tan Mei Xin', year: 2, hours: 45, fyp: null, diagnostic: true, course: true },
  { faculty: 'hospitality', name: 'Umar Hakim', year: 3, hours: 90, fyp: 'APPROVED', diagnostic: true, course: true },
];

function slug(name) {
  return name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
}

async function remove() {
  const students = await prisma.student.findMany({
    where: { matricNo: { startsWith: MATRIC_PREFIX } },
    select: { userId: true },
  });
  // Student, logbook, diagnostics etc. all cascade from User.
  const result = await prisma.user.deleteMany({ where: { id: { in: students.map((s) => s.userId) } } });
  console.log(`Removed ${result.count} demo students.`);
}

async function seed() {
  const programmes = await prisma.programme.findMany({ select: { id: true, facultyId: true, level: true, name: true } });
  const byFaculty = new Map();
  for (const programme of programmes) {
    if (!byFaculty.has(programme.facultyId)) byFaculty.set(programme.facultyId, []);
    byFaculty.get(programme.facultyId).push(programme);
  }

  let index = 0;
  for (const person of PEOPLE) {
    index += 1;
    const facultyProgrammes = byFaculty.get(person.faculty);
    if (!facultyProgrammes?.length) {
      console.warn(`No programmes found for faculty "${person.faculty}" — skipping ${person.name}.`);
      continue;
    }

    // Prefer a bachelor programme so the year of study makes sense.
    const programme = facultyProgrammes.find((p) => p.level === 'BACHELOR') ?? facultyProgrammes[0];
    const matricNo = `${MATRIC_PREFIX}${String(index).padStart(4, '0')}`;
    const email = `${slug(person.name)}${EMAIL_DOMAIN}`;
    const name = `${person.name} (demo)`;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, role: 'STUDENT', accountStatus: 'ACTIVE', identitySource: 'SEEDED' },
      create: {
        email,
        normalizedEmail: email,
        name,
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        loginAllowed: false,
        identitySource: 'SEEDED',
      },
    });

    const student = await prisma.student.upsert({
      where: { matricNo },
      update: {
        academicYear: person.year,
        facultyId: person.faculty,
        programmeId: programme.id,
        skillTags: person.course ? ['Communication', 'Teamwork'] : [],
      },
      create: {
        matricNo,
        academicYear: person.year,
        intakeYearMonth: 202409,
        intakeSequence: index,
        userId: user.id,
        facultyId: person.faculty,
        programmeId: programme.id,
        skillTags: person.course ? ['Communication', 'Teamwork'] : [],
      },
    });

    // Rebuild the derived records so re-running does not stack duplicates.
    await prisma.logbookEntry.deleteMany({ where: { studentId: student.id } });
    await prisma.diagnosticResult.deleteMany({ where: { studentId: student.id } });
    await prisma.courseEnrolment.deleteMany({ where: { studentId: student.id } });

    if (person.hours > 0) {
      await prisma.logbookEntry.create({
        data: {
          title: 'Demo placement day',
          details: 'Fictional entry created by scripts/seed-demo-students.mjs.',
          hours: person.hours,
          entryDate: new Date('2026-05-04'),
          status: 'APPROVED',
          fieldValues: {},
          latitude: 3.0738,
          longitude: 101.5183,
          studentId: student.id,
        },
      });
    }

    if (person.diagnostic) {
      await prisma.diagnosticResult.create({
        data: {
          testId: 'general-employability',
          score: 0.74,
          passed: true,
          gapTags: ['Data literacy'],
          breakdown: {},
          studentId: student.id,
        },
      });
    }

    if (person.course) {
      await prisma.courseEnrolment.create({
        data: {
          courseId: 'demo-course',
          title: 'Professional Communication (demo)',
          provider: 'QIU CPDC',
          skillTag: 'Communication',
          status: 'COMPLETED',
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          studentId: student.id,
        },
      });
    }

    if (person.fyp) {
      await prisma.fYPProject.upsert({
        where: { studentId: student.id },
        update: { status: person.fyp },
        create: {
          title: `${person.name}: demo final year project`,
          abstract: 'Fictional project record created for the staff directory demo.',
          status: person.fyp,
          studentId: student.id,
        },
      });
    } else {
      await prisma.fYPProject.deleteMany({ where: { studentId: student.id } });
    }
  }

  const total = await prisma.student.count({ where: { matricNo: { startsWith: MATRIC_PREFIX } } });
  console.log(`Demo students in the database: ${total} (matric numbers begin ${MATRIC_PREFIX}).`);
}

const run = process.argv.includes('--remove') ? remove : seed;

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
