import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { getCapabilitySet } from '@/lib/auth/permissions';
import { toIdentityRouteError } from '@/lib/auth/identity';

const OVERVIEW_ROLES = new Set([
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'ACADEMIC_SUPERVISOR',
  'PLACEMENT_OFFICER',
  'CPDC_ADMIN',
  'CAREER_COUNSELOR',
  'UNIVERSITY_REGISTRAR',
  'SUPER_ADMIN',
]);

function forbidden() {
  const error = new Error('This operational overview is restricted to university staff.');
  error.status = 403;
  error.code = 'FORBIDDEN';
  return error;
}

function scopeWhere(actor) {
  if (actor.demo && actor.student?.id) return { id: actor.student.id };
  if (['CPDC_ADMIN', 'CAREER_COUNSELOR', 'UNIVERSITY_REGISTRAR', 'SUPER_ADMIN'].includes(actor.role)) return {};

  const assignments = (actor.identity?.assignments ?? [])
    .filter((assignment) => assignment.role === actor.role);
  const programmeIds = assignments
    .filter((assignment) => assignment.scopeType === 'PROGRAMME')
    .map((assignment) => assignment.scopeValue)
    .filter(Boolean);
  const facultyIds = assignments
    .filter((assignment) => assignment.scopeType === 'FACULTY')
    .map((assignment) => assignment.scopeValue)
    .filter(Boolean);
  const studentIds = assignments
    .filter((assignment) => assignment.scopeType === 'STUDENT')
    .map((assignment) => assignment.scopeValue)
    .filter(Boolean);

  if (programmeIds.length) return { programmeId: { in: programmeIds } };
  if (facultyIds.length) return { facultyId: { in: facultyIds } };
  if (studentIds.length) return { id: { in: studentIds } };
  return { id: '__no_scope__' };
}

function readinessFor(student) {
  const approvedHours = (student.logbookEntries ?? [])
    .filter((entry) => entry.status === 'APPROVED')
    .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const checks = [
    Boolean(student.user?.name && student.facultyId && student.programmeId),
    approvedHours > 0,
    Boolean(student.fypProject?.status === 'APPROVED'),
    Boolean(student.diagnostics?.[0]?.passed),
    (student.courseEnrolments ?? []).some((course) => course.verificationStatus === 'VERIFIED'),
  ];
  return {
    value: Math.round((checks.filter(Boolean).length / checks.length) * 100),
    approvedHours,
  };
}

function studentRow(student) {
  const readiness = readinessFor(student);
  const missing = [];
  if (!student.fypProject || student.fypProject.status !== 'APPROVED') missing.push('FYP review');
  if (!readiness.approvedHours) missing.push('verified fieldwork');
  if (!student.diagnostics?.[0]) missing.push('skills diagnostic');
  if (!(student.courseEnrolments ?? []).some((course) => course.verificationStatus === 'VERIFIED')) missing.push('verified course');
  const risk = readiness.value < 40 ? 'high' : readiness.value < 75 ? 'medium' : 'low';

  return {
    id: student.matricNo,
    databaseId: student.id,
    name: student.user?.name ?? 'Unnamed student',
    email: student.user?.email ?? null,
    facultyId: student.facultyId,
    faculty: student.faculty?.name ?? null,
    programmeId: student.programmeId,
    programme: student.programme?.name ?? null,
    year: student.academicYear,
    readiness: readiness.value,
    risk,
    missing: missing.length ? missing.join(' · ') : 'On track',
    approvedHours: readiness.approvedHours,
    fypStatus: student.fypProject?.status ?? null,
    diagnosticPassed: Boolean(student.diagnostics?.[0]?.passed),
    verifiedCourses: (student.courseEnrolments ?? []).filter((course) => course.verificationStatus === 'VERIFIED').length,
    lifecycleStatus: student.lifecycleStatus,
  };
}

export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!OVERVIEW_ROLES.has(actor.role)) throw forbidden();
    if (!actor.demo && !getCapabilitySet(actor.identity).has('student.read')) throw forbidden();

    const where = scopeWhere(actor);
    const students = await prisma.student.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 500,
      include: {
        user: { select: { name: true, email: true } },
        faculty: { select: { id: true, name: true, code: true } },
        programme: { select: { id: true, name: true } },
        logbookEntries: { select: { hours: true, status: true } },
        fypProject: { select: { status: true } },
        diagnostics: { orderBy: { createdAt: 'desc' }, take: 1, select: { passed: true } },
        courseEnrolments: { select: { verificationStatus: true } },
      },
    });

    const globalScope = actor.demo || ['CPDC_ADMIN', 'CAREER_COUNSELOR', 'UNIVERSITY_REGISTRAR', 'SUPER_ADMIN'].includes(actor.role);
    const scopedFacultyIds = [...new Set(students.map((student) => student.facultyId))];
    const facultyRows = await prisma.faculty.findMany({
      where: globalScope ? {} : { id: { in: scopedFacultyIds } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, color: true, _count: { select: { students: true, programmes: true } } },
    });
    const [pendingFyp, pendingLogbook, pendingCourses, upcomingWorkshops, userCount, audit] = await Promise.all([
      prisma.fYPProject.count({ where: { status: 'PENDING_REVIEW', student: where } }),
      prisma.logbookEntry.count({ where: { status: 'PENDING', student: where } }),
      prisma.courseEnrolment.count({ where: { verificationStatus: 'PENDING', student: where } }),
      prisma.workshop.count({ where: globalScope ? { startsAt: { gte: new Date() } } : { startsAt: { gte: new Date() }, OR: [{ facultyId: null }, { facultyId: { in: scopedFacultyIds } }] } }),
      globalScope ? prisma.user.count() : Promise.resolve(students.length),
      globalScope ? prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { id: true, action: true, resourceType: true, resourceId: true, createdAt: true, actorUser: { select: { name: true, role: true } } },
      }) : Promise.resolve([]),
    ]);

    const rows = students.map(studentRow);
    const readinessAverage = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + row.readiness, 0) / rows.length)
      : 0;

    return NextResponse.json({
      source: 'database',
      generatedAt: new Date().toISOString(),
      scope: actor.demo ? 'DEMO_STUDENT' : actor.role,
      metrics: {
        studentsInScope: rows.length,
        totalUsers: userCount,
        readinessAverage,
        pendingFyp,
        pendingLogbook,
        pendingCourses,
        upcomingWorkshops,
      },
      students: rows,
      faculties: facultyRows.map((faculty) => ({ ...faculty, studentCount: faculty._count.students, programmeCount: faculty._count.programmes, _count: undefined })),
      audit: audit.map((entry) => ({ ...entry, actor: entry.actorUser, actorUser: undefined })),
      pendingApprovals: [
        { id: 'fyp-pending', type: 'FYP showcase', count: pendingFyp, href: '/admin' },
        { id: 'logbook-pending', type: 'Logbook review', count: pendingLogbook, href: '/logbook' },
        { id: 'course-pending', type: 'Course completion', count: pendingCourses, href: '/learning' },
      ].filter((item) => item.count > 0),
    });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
  }
}
