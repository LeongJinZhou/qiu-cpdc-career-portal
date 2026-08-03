import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { createAuditEntry } from '@/lib/audit/index.js';
import { getRequestId, toIdentityRouteError } from '@/lib/auth/identity';

/**
 * Admin data explorer — a read-only window onto the raw records behind the
 * curated student views.
 *
 * The per-student record (/api/students/[id]/profile) answers "tell me about
 * this student"; this endpoint answers "show me every attempt / application /
 * audit line across the platform". It is deliberately CPDC/Super-Admin only and
 * exposes only an allowlisted set of entities and columns — a browser can never
 * name an arbitrary Prisma model here. Every page view is audited.
 */

// Only platform administrators may browse raw cross-student data. Faculty and
// Registrar staff use the curated/scoped student views instead; raw exports
// contain identity and audit fields that exceed those roles' normal duties.
// Demo mode (dev-only) honours the x-demo-role header, so a demo SUPER_ADMIN
// can exercise this in development.
const EXPLORER_ROLES = new Set(['CPDC_ADMIN', 'SUPER_ADMIN']);

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// Each entity declares its columns, how to load a page, and how to flatten a row
// to a flat object of strings/numbers. Nothing outside this registry is reachable.
const ENTITIES = {
  student: {
    label: 'Students',
    columns: ['id', 'name', 'matricNo', 'employeeId', 'courseCode', 'email', 'faculty', 'directorySyncedAt'],
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } }, faculty: { select: { code: true } } },
    search: (q) => ({
      OR: [
        { matricNo: { contains: q, mode: 'insensitive' } },
        { employeeId: { contains: q, mode: 'insensitive' } },
        { courseCode: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ],
    }),
    toRow: (r) => ({
      id: r.id,
      name: r.user?.name ?? '—',
      matricNo: r.matricNo ?? '—',
      employeeId: r.employeeId ?? '—',
      courseCode: r.courseCode ?? '—',
      email: r.user?.email ?? '—',
      faculty: r.faculty?.code ?? '—',
      directorySyncedAt: r.directorySyncedAt?.toISOString?.() ?? 'Never',
    }),
  },
  assessmentAttempt: {
    label: 'Assessment attempts',
    columns: ['id', 'student', 'matricNo', 'assessment', 'score', 'passed', 'submittedAt'],
    orderBy: { startedAt: 'desc' },
    include: { student: { include: { user: { select: { name: true } } } }, assessment: { select: { title: true } } },
    search: (q) => ({
      OR: [
        { assessment: { title: { contains: q, mode: 'insensitive' } } },
        { student: { matricNo: { contains: q, mode: 'insensitive' } } },
        { student: { user: { name: { contains: q, mode: 'insensitive' } } } },
      ],
    }),
    toRow: (r) => ({
      id: r.id,
      student: r.student?.user?.name ?? '—',
      matricNo: r.student?.matricNo ?? '—',
      assessment: r.assessment?.title ?? '—',
      score: r.score != null ? `${Math.round(r.score * 100)}%` : '—',
      passed: r.passed == null ? 'In progress' : r.passed ? 'Passed' : 'Not passed',
      submittedAt: r.submittedAt?.toISOString?.() ?? 'In progress',
    }),
  },
  application: {
    label: 'Job applications',
    columns: ['id', 'student', 'matricNo', 'posting', 'stage', 'appliedAt'],
    orderBy: { createdAt: 'desc' },
    include: { student: { include: { user: { select: { name: true } } } }, jobPosting: { select: { title: true } } },
    search: (q) => ({
      OR: [
        { jobPosting: { title: { contains: q, mode: 'insensitive' } } },
        { student: { matricNo: { contains: q, mode: 'insensitive' } } },
        { student: { user: { name: { contains: q, mode: 'insensitive' } } } },
      ],
    }),
    toRow: (r) => ({
      id: r.id,
      student: r.student?.user?.name ?? '—',
      matricNo: r.student?.matricNo ?? '—',
      posting: r.jobPosting?.title ?? '—',
      stage: r.stage ?? '—',
      appliedAt: r.createdAt?.toISOString?.() ?? '',
    }),
  },
  workshop: {
    label: 'Workshops',
    columns: ['id', 'title', 'category', 'startsAt', 'capacity', 'rsvps'],
    orderBy: { startsAt: 'desc' },
    include: { _count: { select: { rsvps: true } } },
    search: (q) => ({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ],
    }),
    toRow: (r) => ({
      id: r.id,
      title: r.title ?? '—',
      category: r.category ?? '—',
      startsAt: r.startsAt?.toISOString?.() ?? '',
      capacity: r.capacity ?? '—',
      rsvps: r._count?.rsvps ?? 0,
    }),
  },
  courseEnrolment: {
    label: 'Course enrolments',
    columns: ['id', 'student', 'matricNo', 'courseId', 'status', 'enrolledAt'],
    orderBy: { createdAt: 'desc' },
    include: { student: { include: { user: { select: { name: true } } } } },
    search: (q) => ({
      OR: [
        { courseId: { contains: q, mode: 'insensitive' } },
        { student: { matricNo: { contains: q, mode: 'insensitive' } } },
        { student: { user: { name: { contains: q, mode: 'insensitive' } } } },
      ],
    }),
    toRow: (r) => ({
      id: r.id,
      student: r.student?.user?.name ?? '—',
      matricNo: r.student?.matricNo ?? '—',
      courseId: r.courseId ?? '—',
      status: r.status ?? '—',
      enrolledAt: r.createdAt?.toISOString?.() ?? '',
    }),
  },
  auditLog: {
    label: 'Audit log',
    columns: ['id', 'action', 'resourceType', 'resourceId', 'actorUserId', 'at'],
    orderBy: { createdAt: 'desc' },
    include: {},
    search: (q) => ({
      OR: [
        { action: { contains: q, mode: 'insensitive' } },
        { resourceType: { contains: q, mode: 'insensitive' } },
        { resourceId: { contains: q, mode: 'insensitive' } },
      ],
    }),
    toRow: (r) => ({
      id: r.id,
      action: r.action ?? '—',
      resourceType: r.resourceType ?? '—',
      resourceId: r.resourceId ?? '—',
      actorUserId: r.actorUserId ?? '—',
      at: r.createdAt?.toISOString?.() ?? '',
    }),
  },
};

function forbidden() {
  const error = new Error('The data explorer is restricted to CPDC Admin and Super Admin accounts.');
  error.status = 403;
  error.code = 'FORBIDDEN';
  return error;
}

export async function GET(request, { params }) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!EXPLORER_ROLES.has(actor.role)) throw forbidden();

    const { entity } = await params;
    const config = ENTITIES[entity];
    if (!config) {
      return NextResponse.json({ error: 'Unknown data set.', code: 'ENTITY_NOT_FOUND' }, { status: 404 });
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
    const where = q ? config.search(q) : {};

    const model = prisma[entity];
    const [total, records] = await Promise.all([
      model.count({ where }),
      model.findMany({ where, include: config.include, orderBy: config.orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    ]);

    // A raw cross-student read is sensitive; record who looked and at what.
    await prisma.$transaction(async (tx) => {
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'ADMIN_DATA_EXPLORER_VIEWED',
        resourceType: 'DataExplorer',
        resourceId: entity,
        metadata: { entity, q: q || null, page, pageSize, total },
        requestId: getRequestId(request),
      });
    });

    return NextResponse.json({
      entity,
      label: config.label,
      columns: config.columns,
      rows: records.map(config.toRow),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}

export const EXPLORER_ENTITY_LABELS = Object.fromEntries(
  Object.entries(ENTITIES).map(([key, value]) => [key, value.label]),
);
