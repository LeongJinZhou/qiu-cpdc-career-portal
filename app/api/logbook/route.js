import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditEntry } from '@/lib/audit';
import {
  getRequestId,
  parseJsonBody,
  toIdentityRouteError,
  validateLogbookPayload,
} from '@/lib/auth/identity';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { requireCapability } from '@/lib/auth/permissions';
import { createMagicToken } from '@/lib/magic-link';
import { sendSupervisorApprovalEmail } from '@/lib/email';

/**
 * Submit a logbook entry and mint the supervisor's approval link.
 *
 * The raw token is returned exactly once, here, because only the hash is
 * persisted. In production this response is what the SMS/email job consumes;
 * it must never be logged.
 */
export async function POST(request) {
  let actor;
  try {
    actor = requireStudentActor(await resolveActor(request));
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }

  try {
    const body = await parseJsonBody(request);
    // The acting student is resolved server-side (session identity, or the
    // seeded student in demo), so the client can't submit on another student's
    // behalf by supplying a different id.
    const {
      title,
      details,
      hours,
      entryDate,
      fieldValues,
      supervisor,
      latitude,
      longitude,
    } = validateLogbookPayload({ ...body, studentId: actor.student.id });
    const studentId = actor.student.id;

    const parsedDate = entryDate ? new Date(entryDate) : new Date();
  const hasValidCoordinates =
    (latitude == null && longitude == null) ||
    (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) &&
      Number(latitude) >= -90 && Number(latitude) <= 90 &&
      Number(longitude) >= -180 && Number(longitude) <= 180);

  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'entryDate must be a valid date' }, { status: 400 });
  }

  if (!hasValidCoordinates) {
    return NextResponse.json({ error: 'latitude and longitude must be valid coordinates' }, { status: 400 });
  }

  const student = actor.student;

  // Real auth enforces the capability scope exactly as before; demo mode skips
  // it (dev-only, and the actor is always the seeded student).
  if (!actor.demo) {
    try {
      requireCapability(actor.identity, 'logbook.write', {
        studentId: student.id,
        facultyId: student.facultyId,
        programmeId: student.programmeId,
      });
    } catch (error) {
      const routeError = toIdentityRouteError(error);
      return NextResponse.json(
        { error: routeError.message, code: routeError.code },
        { status: routeError.status },
      );
    }
  }

  const { token, tokenHash, expiresAt } = createMagicToken();

  const entry = await prisma.$transaction(async (tx) => {
    const createdEntry = await tx.logbookEntry.create({
      data: {
        studentId,
        title: title.trim(),
        details,
        hours,
        entryDate: parsedDate,
        fieldValues,
        latitude: latitude == null ? null : Number(latitude),
        longitude: longitude == null ? null : Number(longitude),
        status: 'PENDING',
        approval: {
          create: {
            supervisorName: supervisor.name.trim(),
            supervisorEmail: supervisor.email ? supervisor.email.trim() : null,
            supervisorPhone: supervisor.phone ? supervisor.phone.trim() : null,
            tokenHash,
            expiresAt,
          },
        },
      },
      include: { approval: true },
    });

    await createAuditEntry({
      tx,
      actorUserId: actor.user.id,
      action: 'LOGBOOK_ENTRY_CREATED',
      resourceType: 'LogbookEntry',
      resourceId: createdEntry.id,
      after: {
        studentId: createdEntry.studentId,
        title: createdEntry.title,
        hours: createdEntry.hours,
        entryDate: createdEntry.entryDate.toISOString(),
        status: createdEntry.status,
      },
      requestId: getRequestId(request),
      metadata: {
        supervisorName: supervisor.name.trim(),
      },
    });

    return createdEntry;
  });

  const origin = new URL(request.url).origin;
  const approvalUrl = `${origin}/approve/${token}`;
  const delivery = await sendSupervisorApprovalEmail({
    to: supervisor.email ? supervisor.email.trim() : null,
    supervisorName: supervisor.name.trim(),
    studentName: actor.user.name,
    entryTitle: entry.title,
    approvalUrl,
  });

  return NextResponse.json(
    {
      entry: { id: entry.id, status: entry.status },
      emailDelivered: delivery.delivered,
      // With no provider configured, the standalone UI can copy the link.
      // When a provider delivers successfully, do not echo the raw token.
      approvalUrl: delivery.delivered ? undefined : approvalUrl,
      expiresAt,
    },
    { status: 201 },
  );
  } catch (error) {
    if (typeof error?.status === 'number' && error.status === 400) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid logbook entry.' },
        { status: 400 },
      );
    }

    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}

export async function GET(request) {
  let actor;
  try {
    actor = requireStudentActor(await resolveActor(request));
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }

  const student = actor.student;
  const studentId = student.id;

  if (!actor.demo) {
    try {
      requireCapability(actor.identity, 'logbook.read', {
        studentId: student.id,
        facultyId: student.facultyId,
        programmeId: student.programmeId,
      });
    } catch (error) {
      const routeError = toIdentityRouteError(error);
      return NextResponse.json(
        { error: routeError.message, code: routeError.code },
        { status: routeError.status },
      );
    }
  }

  const entries = await prisma.logbookEntry.findMany({
    where: { studentId },
    orderBy: { entryDate: 'desc' },
    include: {
      approval: {
        // Never expose tokenHash to the client.
        select: {
          supervisorName: true,
          supervisorEmail: true,
          decision: true,
          comment: true,
          usedAt: true,
        },
      },
    },
  });

  return NextResponse.json({ entries });
}
