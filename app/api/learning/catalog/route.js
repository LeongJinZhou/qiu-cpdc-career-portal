import { NextResponse } from 'next/server';

import { resolveActor } from '@/lib/auth/actor';
import { toIdentityRouteError } from '@/lib/auth/identity';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/learning/catalog — the live external-learning catalogue.
 *
 * Replaces the static fixture the Learning Hub used to read. The single most
 * important behaviour here: a course the provider has taken down is filtered
 * out server-side for students, so it disappears from the portal without a
 * deploy. Availability is owned by `npm run catalog:sync` (see
 * lib/learning/liveness.js) and is never decided by the client.
 *
 * Staff (`?scope=all`) additionally see UNAVAILABLE and DRAFT rows, because
 * curating the catalogue means seeing exactly what students no longer can.
 *
 * The projection keeps the fixture's field names on purpose: the Learning Hub,
 * the match engine and the CV all already speak that shape, so this is a data
 * source swap rather than a rewrite.
 */

const STAFF_ROLES = new Set([
  'HEAD_OF_PROGRAMME', 'FACULTY_COORDINATOR', 'PLACEMENT_OFFICER',
  'CAREER_COUNSELOR', 'CPDC_ADMIN', 'SUPER_ADMIN', 'UNIVERSITY_REGISTRAR',
]);

function project(row) {
  return {
    // The fixture id, so enrolment records written against the old catalogue
    // still line up with the live one.
    id: row.externalId.split(':').slice(1).join(':'),
    externalId: row.externalId,
    title: row.title,
    provider: row.provider,
    taughtBy: row.taughtBy,
    summary: row.summary,
    duration: row.duration,
    effort: row.effort,
    level: row.level,
    prerequisite: row.prerequisite,
    outcomes: row.outcomes ?? [],
    tags: row.tags ?? [],
    faculty: row.facultyId ?? 'all',
    alsoFor: row.alsoFor ?? [],
    xp: row.xp,
    skillBadge: row.skillBadge,
    theme: row.theme,
    url: row.url,

    // Live-catalogue metadata the fixture could never carry.
    availability: row.availability,
    curationStatus: row.curationStatus,
    trendingScore: row.trendingScore,
    enrolmentsRecent: row.enrolmentsRecent,
    addedAt: row.addedAt,
    lastCheckedAt: row.lastCheckedAt,
    unavailableSince: row.unavailableSince,
  };
}

export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const params = new URL(request.url).searchParams;

    const wantsAll = params.get('scope') === 'all';
    const isStaff = STAFF_ROLES.has(actor.role);
    const includeHidden = wantsAll && isStaff;

    const where = includeHidden
      ? {}
      : {
        curationStatus: 'PUBLISHED',
        // UNKNOWN is included deliberately: a provider outage must not empty
        // the catalogue. Only a CONFIRMED take-down hides a course.
        availability: { not: 'UNAVAILABLE' },
      };

    // Two queries on purpose. `rows` is what the caller may see; the delisted
    // count is asked for separately because in the student scope the main query
    // has already excluded them — deriving it from `rows` would report 0 every
    // time and silently turn the "removed by the provider" notice into a lie.
    const [rows, unavailableCount] = await Promise.all([
      prisma.catalogCourse.findMany({
        where,
        orderBy: [{ trendingScore: 'desc' }, { title: 'asc' }],
      }),
      prisma.catalogCourse.count({
        where: { curationStatus: 'PUBLISHED', availability: 'UNAVAILABLE' },
      }),
    ]);

    const courses = rows.map(project);

    // Distinct filter values are derived from what is actually listed, so the
    // filter bar can never offer a level or provider that returns nothing.
    const facets = {
      providers: [...new Set(courses.map((c) => c.provider))].sort(),
      levels: [...new Set(courses.map((c) => c.level).filter(Boolean))],
      tags: [...new Set(courses.flatMap((c) => c.tags))].sort(),
    };

    const lastSync = rows.reduce((latest, row) => {
      if (!row.lastCheckedAt) return latest;
      return !latest || row.lastCheckedAt > latest ? row.lastCheckedAt : latest;
    }, null);

    return NextResponse.json({
      courses,
      facets,
      // Shown to students as "checked <date>" so the freshness claim is
      // evidenced rather than asserted.
      lastSync,
      counts: {
        listed: courses.length,
        unavailable: unavailableCount,
      },
      scope: includeHidden ? 'all' : 'student',
    });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
