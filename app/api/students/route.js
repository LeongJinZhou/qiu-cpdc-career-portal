import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { toIdentityRouteError } from '@/lib/auth/identity';
import { getCapabilitySet } from '@/lib/auth/permissions';
import { layersForRole } from '@/lib/auth/student-profile-visibility';

import {
  DIRECTORY_ROLES,
  buildDirectoryWhere,
  buildStudentScopeWhere,
  describeScope,
  parseDirectoryQuery,
  resolveDirectoryIdentity,
} from './student-scope';

/**
 * GET /api/students — the staff student directory.
 *
 * Scope is applied inside the Postgres query (see ./student-scope.js), so an
 * out-of-scope student is never loaded, never counted, and cannot be reached by
 * paging. The row shape is deliberately thin: enough to find and triage a
 * student, never the record itself. The record is a separate request against
 * /api/students/[id]/profile, which applies field-level visibility.
 */

function forbidden(message) {
  const error = new Error(message);
  error.status = 403;
  error.code = 'FORBIDDEN';
  return error;
}

function riskFor(student) {
  const approvedHours = (student.logbookEntries ?? [])
    .filter((entry) => entry.status === 'APPROVED')
    .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);

  const checks = [
    { id: 'profile', done: Boolean(student.user?.name && student.facultyId && student.programmeId), label: 'complete profile' },
    { id: 'hours', done: approvedHours > 0, label: 'approved fieldwork hours' },
    { id: 'fyp', done: student.fypProject?.status === 'APPROVED', label: 'approved Final Year Project' },
    { id: 'diagnostic', done: Boolean(student.diagnostics?.[0]?.passed), label: 'passed skills diagnostic' },
    { id: 'course', done: (student.courseEnrolments ?? []).some((course) => course.verificationStatus === 'VERIFIED'), label: 'verified course' },
  ];

  const complete = checks.filter((check) => check.done).length;
  const readiness = Math.round((complete / checks.length) * 100);
  const outstanding = checks.filter((check) => !check.done).map((check) => check.label);

  return {
    readiness,
    approvedHours: Math.round(approvedHours * 10) / 10,
    // Never colour alone: the level carries a word, and the UI pairs it with an icon.
    attention: readiness < 40 ? 'Needs urgent follow-up' : readiness < 75 ? 'Needs a check-in' : 'On track',
    attentionLevel: readiness < 40 ? 'high' : readiness < 75 ? 'medium' : 'low',
    outstanding,
  };
}

export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });

    if (!DIRECTORY_ROLES.has(actor.role)) {
      throw forbidden('The student directory is available to university staff only.');
    }

    const identity = resolveDirectoryIdentity(actor);
    if (!identity || !getCapabilitySet(identity).has('student.read')) {
      throw forbidden('Your account does not have permission to read student records.');
    }

    const scope = buildStudentScopeWhere(identity);
    const filters = parseDirectoryQuery(new URL(request.url).searchParams);

    // No reach at all — a coordinator with no faculty assigned yet. Return an
    // empty, explained list rather than running an unfiltered query.
    if (scope.where === null) {
      return NextResponse.json({
        students: [],
        total: 0,
        page: 1,
        pageSize: filters.pageSize,
        scope: { role: actor.role, unrestricted: false, description: describeScope(scope.reach), filtersLocked: true },
        facets: { faculties: [], programmes: [], years: [] },
        layers: layersForRole(actor.role),
        emptyReason: 'No faculty, programme or students have been assigned to your account yet. Ask a CPDC administrator to assign your scope.',
      });
    }

    const where = buildDirectoryWhere(scope.where, filters);
    const skip = (filters.page - 1) * filters.pageSize;

    const [total, rows] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        orderBy: [{ academicYear: 'desc' }, { matricNo: 'asc' }],
        skip,
        take: filters.pageSize,
        select: {
          id: true,
          matricNo: true,
          academicYear: true,
          lifecycleStatus: true,
          searchable: true,
          facultyId: true,
          programmeId: true,
          updatedAt: true,
          user: { select: { name: true, email: true, accountStatus: true } },
          faculty: { select: { id: true, name: true, code: true } },
          programme: { select: { id: true, name: true, level: true } },
          logbookEntries: { select: { hours: true, status: true } },
          fypProject: { select: { status: true } },
          diagnostics: { orderBy: { createdAt: 'desc' }, take: 1, select: { passed: true } },
          courseEnrolments: { select: { verificationStatus: true } },
        },
      }),
    ]);

    // Facets are built from the same scoped query, so the faculty dropdown a
    // coordinator sees lists only their own faculty.
    const [facultyFacets, programmeFacets] = await Promise.all([
      prisma.student.groupBy({ by: ['facultyId'], where: scope.where, _count: { _all: true } }),
      prisma.student.groupBy({ by: ['programmeId'], where: scope.where, _count: { _all: true } }),
    ]);

    const [faculties, programmes] = await Promise.all([
      prisma.faculty.findMany({
        where: { id: { in: facultyFacets.map((facet) => facet.facultyId) } },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.programme.findMany({
        where: { id: { in: programmeFacets.map((facet) => facet.programmeId) } },
        select: { id: true, name: true, facultyId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const students = rows.map((student) => {
      const risk = riskFor(student);
      return {
        id: student.id,
        matricNo: student.matricNo,
        name: student.user?.name ?? 'Unnamed student',
        email: student.user?.email ?? null,
        accountStatus: student.user?.accountStatus ?? null,
        facultyId: student.facultyId,
        faculty: student.faculty?.name ?? null,
        facultyCode: student.faculty?.code ?? null,
        programmeId: student.programmeId,
        programme: student.programme?.name ?? null,
        year: student.academicYear,
        lifecycleStatus: student.lifecycleStatus,
        searchable: student.searchable,
        lastUpdatedAt: student.updatedAt,
        ...risk,
      };
    });

    return NextResponse.json({
      students,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      appliedFilters: filters,
      scope: {
        role: actor.role,
        unrestricted: scope.unrestricted,
        description: describeScope(scope.reach, { faculties, programmes }),
        demo: Boolean(actor.demo),
        filtersLocked: false,
      },
      facets: {
        faculties: faculties.map((faculty) => ({
          ...faculty,
          count: facultyFacets.find((facet) => facet.facultyId === faculty.id)?._count?._all ?? 0,
        })),
        programmes: programmes.map((programme) => ({
          ...programme,
          count: programmeFacets.find((facet) => facet.programmeId === programme.id)?._count?._all ?? 0,
        })),
        years: [...new Set(students.map((student) => student.year))].sort((a, b) => a - b),
      },
      layers: layersForRole(actor.role),
    });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
  }
}
