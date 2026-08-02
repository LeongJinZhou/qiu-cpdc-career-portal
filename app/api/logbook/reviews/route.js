import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { actorCanEndorseLogbook, resolveActor } from '@/lib/auth/actor';
import { getRequestId, parseJsonBody, toIdentityRouteError } from '@/lib/auth/identity';
import { createAuditEntry } from '@/lib/audit';
import { evaluateStudentLifecycle } from '@/lib/automation';
import { reviewerWhere } from '@/lib/fyp-review';

const decisionSchema = z.object({
  entryId: z.string().trim().min(1),
  status: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().trim().max(2000).optional().nullable(),
});

const FACULTY_SCOPE_ROLES = new Set(['FACULTY_COORDINATOR', 'PLACEMENT_OFFICER']);
const GLOBAL_ROLES = new Set(['CPDC_ADMIN', 'SUPER_ADMIN']);

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

function reviewWhere(actor) {
  if (!actorCanEndorseLogbook(actor?.role)) return null;
  if (actor.demo && actor.student) return { studentId: actor.student.id };

  if (GLOBAL_ROLES.has(actor.role) || actor.role === 'HEAD_OF_PROGRAMME' || actor.role === 'FACULTY_COORDINATOR') {
    return reviewerWhere(actor);
  }

  if (FACULTY_SCOPE_ROLES.has(actor.role)) {
    const values = (actor.identity?.assignments ?? [])
      .filter((assignment) => assignment.role === actor.role && assignment.scopeType === 'FACULTY')
      .map((assignment) => assignment.scopeValue)
      .filter(Boolean);
    return values.length
      ? { student: { facultyId: values.length === 1 ? values[0] : { in: values } } }
      : null;
  }

  if (actor.role === 'ACADEMIC_SUPERVISOR') {
    const values = (actor.identity?.assignments ?? [])
      .filter((assignment) => assignment.role === actor.role && assignment.scopeType === 'STUDENT')
      .map((assignment) => assignment.scopeValue)
      .filter(Boolean);
    return values.length ? { studentId: { in: values } } : null;
  }

  return null;
}

function serialize(entry) {
  return {
    id: entry.id,
    title: entry.title,
    details: entry.details,
    hours: entry.hours,
    entryDate: entry.entryDate,
    status: entry.status,
    createdAt: entry.createdAt,
    supervisor: entry.approval
      ? {
        name: entry.approval.supervisorName,
        email: entry.approval.supervisorEmail,
        decision: entry.approval.decision,
        comment: entry.approval.comment,
        usedAt: entry.approval.usedAt,
      }
      : null,
    student: {
      id: entry.student.id,
      matricNo: entry.student.matricNo,
      name: entry.student.user?.name ?? 'Student',
      facultyId: entry.student.facultyId,
      programme: entry.student.programme?.name ?? null,
    },
  };
}

function includeForReview() {
  return {
    approval: {
      select: {
        supervisorName: true,
        supervisorEmail: true,
        decision: true,
        comment: true,
        usedAt: true,
      },
    },
    student: {
      select: {
        id: true,
        matricNo: true,
        facultyId: true,
        user: { select: { name: true } },
        programme: { select: { name: true } },
      },
    },
  };
}

export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const where = reviewWhere(actor);
    if (!where) {
      return NextResponse.json({ error: 'Your role has no configured logbook review scope.', code: 'REVIEW_SCOPE_REQUIRED' }, { status: 403 });
    }

    const entries = await prisma.logbookEntry.findMany({
      where: { ...where, status: 'PENDING' },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
      include: includeForReview(),
    });
    return NextResponse.json({ entries: entries.map(serialize), source: 'database' });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const body = decisionSchema.parse(await parseJsonBody(request));
    const scope = reviewWhere(actor);
    if (!scope) {
      return NextResponse.json({ error: 'Your role has no configured logbook review scope.', code: 'REVIEW_SCOPE_REQUIRED' }, { status: 403 });
    }

    const existing = await prisma.logbookEntry.findFirst({
      where: { id: body.entryId, ...scope, status: 'PENDING' },
      include: includeForReview(),
    });
    if (!existing) {
      return NextResponse.json({ error: 'Pending logbook entry not found in your scope.', code: 'NOT_FOUND' }, { status: 404 });
    }

    const saved = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.logbookEntry.update({
        where: { id: existing.id },
        data: { status: body.status },
        include: includeForReview(),
      });

      if (existing.approval) {
        await tx.supervisorApproval.update({
          where: { logbookEntryId: existing.id },
          data: {
            decision: body.status,
            comment: body.comment ?? null,
            usedAt: now,
          },
        });
      }

      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: body.status === 'APPROVED' ? 'LOGBOOK_ENTRY_INTERNAL_APPROVED' : 'LOGBOOK_ENTRY_INTERNAL_REJECTED',
        resourceType: 'LogbookEntry',
        resourceId: existing.id,
        before: { status: existing.status },
        after: { status: body.status, studentId: existing.studentId, comment: body.comment ?? null },
        requestId: getRequestId(request),
      });

      if (body.status === 'APPROVED') {
        await evaluateStudentLifecycle(existing.studentId, {
          tx,
          actorUserId: actor.user.id,
          requestId: getRequestId(request),
          trigger: 'INTERNAL_LOGBOOK_APPROVAL',
        });
      }

      return updated;
    });

    const refreshed = await prisma.logbookEntry.findUnique({
      where: { id: saved.id },
      include: includeForReview(),
    });
    return NextResponse.json({ entry: serialize(refreshed) });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid logbook review.' }, { status: 400 });
    }
    return routeError(error);
  }
}
