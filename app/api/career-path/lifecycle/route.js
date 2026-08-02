import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { toIdentityRouteError, getRequestId } from '@/lib/auth/identity';
import { evaluateStudentLifecycle, INTERNSHIP_HOURS_THRESHOLD } from '@/lib/automation';

async function lifecycleFor(studentId) {
  const [student, hours, events] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: {
        lifecycleStatus: true,
        internshipCompletedAt: true,
        alumniEligibleAt: true,
      },
    }),
    prisma.logbookEntry.aggregate({
      where: { studentId, status: 'APPROVED' },
      _sum: { hours: true },
    }),
    prisma.automationEvent.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, type: true, status: true, payload: true, createdAt: true },
    }),
  ]);

  return {
    status: student?.lifecycleStatus ?? 'ACTIVE_STUDENT',
    approvedHours: Number(hours._sum.hours ?? 0),
    threshold: INTERNSHIP_HOURS_THRESHOLD,
    internshipCompletedAt: student?.internshipCompletedAt ?? null,
    alumniEligibleAt: student?.alumniEligibleAt ?? null,
    events,
  };
}

export async function GET(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    return NextResponse.json(await lifecycleFor(actor.student.id));
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
  }
}

/**
 * Re-check actual approved hours. This is intentionally idempotent; it never
 * fabricates completion and is useful for existing standalone records while a
 * background worker has not yet been configured.
 */
export async function POST(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const result = await prisma.$transaction((tx) => evaluateStudentLifecycle(actor.student.id, {
      tx,
      actorUserId: actor.user.id,
      requestId: getRequestId(request),
      trigger: 'MANUAL_LIFECYCLE_RECHECK',
    }));
    return NextResponse.json({ ...result, lifecycle: await lifecycleFor(actor.student.id) });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
  }
}
