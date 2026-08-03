#!/usr/bin/env node
// Module 6 -- catalogue sync.
//
//   npm run catalog:sync              import + liveness check + trending
//   npm run catalog:sync -- --check   liveness + trending only (the cron job)
//   npm run catalog:sync -- --import  import only, no network
//   npm run catalog:sync -- --dry-run report what would change, write nothing
//
// This is the job that answers "the provider took the course down today".
// Run it on a schedule (daily is plenty). The delisting rules live in
// lib/learning/liveness.js and are deliberately conservative -- see the header
// there for why a single 404 does not remove anything.

import { PrismaClient } from '@prisma/client';

import { COURSE_CATALOGUE } from '../lib/data/courses.js';
import { COURSE_EXPANSION } from '../lib/data/courses-expansion.js';
import { nextCourseState, probeCourseUrl, trendingScore } from '../lib/learning/liveness.js';

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const importOnly = args.has('--import');
const checkOnly = args.has('--check');
const doImport = !checkOnly;
const doCheck = !importOnly;

/** Trailing window used for the popularity half of the trending score. */
const TRENDING_WINDOW_DAYS = 30;
/** Politeness delay between provider requests. */
const PROBE_DELAY_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function externalIdFor(course) {
  // Stable across re-runs and readable in the admin console.
  return `${course.provider}:${course.id}`;
}

async function importCatalogue() {
  const source = [...COURSE_CATALOGUE, ...COURSE_EXPANSION];
  const facultyIds = new Set((await prisma.faculty.findMany({ select: { id: true } })).map((f) => f.id));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const course of source) {
    // A course with no URL cannot be liveness-checked, and an unverifiable link
    // in front of a student is exactly what this system is meant to prevent.
    if (!course.url) {
      skipped += 1;
      continue;
    }

    // `faculty: 'all'` is a fixture convention, not a Faculty row.
    const facultyId = facultyIds.has(course.faculty) ? course.faculty : null;

    const data = {
      title: course.title,
      provider: course.provider,
      url: course.url,
      taughtBy: course.taughtBy ?? null,
      summary: course.summary ?? null,
      duration: course.duration ?? null,
      effort: course.effort ?? null,
      level: course.level ?? null,
      prerequisite: course.prerequisite ?? null,
      outcomes: course.outcomes ?? [],
      tags: course.tags ?? [],
      facultyId,
      alsoFor: course.alsoFor ?? [],
      xp: course.xp ?? 300,
      skillBadge: course.skillBadge ?? null,
      theme: course.theme ?? null,
    };

    const externalId = externalIdFor(course);
    const existing = await prisma.catalogCourse.findUnique({ where: { externalId } });

    if (dryRun) {
      existing ? (updated += 1) : (created += 1);
      continue;
    }

    if (existing) {
      // Deliberately does NOT touch availability / failureStreak / curationStatus:
      // re-importing the source list must never silently un-delist a course the
      // liveness check retired, nor undo a CPDC archive decision.
      await prisma.catalogCourse.update({ where: { externalId }, data });
      updated += 1;
    } else {
      await prisma.catalogCourse.create({ data: { externalId, ...data } });
      created += 1;
    }
  }

  console.log(`[import] ${created} created, ${updated} updated, ${skipped} skipped (no URL)`);
}

async function checkLiveness() {
  const courses = await prisma.catalogCourse.findMany({
    where: { curationStatus: { not: 'ARCHIVED' } },
    select: {
      id: true, externalId: true, title: true, url: true,
      availability: true, failureStreak: true, unavailableSince: true,
    },
    orderBy: { externalId: 'asc' },
  });

  console.log(`[liveness] probing ${courses.length} courses…`);

  const transitions = [];
  let alive = 0;
  let gone = 0;
  let inconclusive = 0;

  for (const course of courses) {
    const probe = await probeCourseUrl(course.url);
    const state = nextCourseState(course, probe);

    if (probe.verdict === 'ALIVE') alive += 1;
    else if (probe.verdict === 'GONE') gone += 1;
    else inconclusive += 1;

    if (state.availability !== course.availability) {
      transitions.push({
        title: course.title,
        url: course.url,
        from: course.availability,
        to: state.availability,
        note: probe.note,
      });
    }

    if (!dryRun) {
      await prisma.catalogCourse.update({ where: { id: course.id }, data: state });
    }

    await sleep(PROBE_DELAY_MS);
  }

  console.log(`[liveness] alive ${alive} · gone ${gone} · inconclusive ${inconclusive}`);

  if (transitions.length) {
    console.log('[liveness] availability changes:');
    transitions.forEach((t) => {
      console.log(`  ${t.from} -> ${t.to}  ${t.title}`);
      console.log(`      ${t.url}`);
      console.log(`      ${t.note}`);
    });
  } else {
    console.log('[liveness] no availability changes');
  }

  return transitions;
}

async function recomputeTrending() {
  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 86_400_000);

  // CourseEnrolment.courseId holds the fixture id, which is the suffix of the
  // externalId — so group once and map, rather than querying per course.
  const grouped = await prisma.courseEnrolment.groupBy({
    by: ['courseId'],
    where: { createdAt: { gte: since } },
    _count: { courseId: true },
  });
  const counts = new Map(grouped.map((row) => [row.courseId, row._count.courseId]));

  const courses = await prisma.catalogCourse.findMany({
    select: { id: true, externalId: true, addedAt: true },
  });

  for (const course of courses) {
    const fixtureId = course.externalId.split(':').slice(1).join(':');
    const enrolmentsRecent = counts.get(fixtureId) ?? 0;
    const score = trendingScore({ enrolmentsRecent, addedAt: course.addedAt });

    if (!dryRun) {
      await prisma.catalogCourse.update({
        where: { id: course.id },
        data: { enrolmentsRecent, trendingScore: score },
      });
    }
  }

  console.log(`[trending] recomputed for ${courses.length} courses (${TRENDING_WINDOW_DAYS}-day window)`);
}

async function main() {
  if (dryRun) console.log('[dry-run] nothing will be written\n');

  if (doImport) await importCatalogue();
  if (doCheck) await checkLiveness();
  await recomputeTrending();

  const summary = await prisma.catalogCourse.groupBy({
    by: ['availability'],
    _count: { availability: true },
  });
  console.log('\n[catalogue]', summary.map((r) => `${r.availability}=${r._count.availability}`).join(' · '));
}

main()
  .catch((error) => {
    console.error('[catalog:sync] failed', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
