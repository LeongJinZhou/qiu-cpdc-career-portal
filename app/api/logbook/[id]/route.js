import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody, getRequestId } from '@/lib/auth/identity';
import { createAuditEntry } from '@/lib/audit';
import { requireCapability } from '@/lib/auth/permissions';
import { createMagicToken } from '@/lib/magic-link';
import { sendSupervisorApprovalEmail } from '@/lib/email';
import { publicOrigin } from '@/lib/http/public-origin';

const supervisorSchema = z.object({
  supervisor: z.object({
    name: z.string().trim().min(1, 'supervisor.name is required').max(160),
    email: z
      .union([z.string().trim().email('supervisor.email must be a valid email address').max(254), z.literal(''), z.null()])
      .optional(),
    phone: z.union([z.string().trim().max(50), z.literal(''), z.null()]).optional(),
  }),
});

/**
 * Edit a PENDING logbook entry's supervisor and re-mint the approval link
 * (Module 4). This is the fix for the "I typed the wrong email and I'm stuck"
 * case: rather than deleting the entry, the student corrects the address and a
 * fresh token is issued, invalidating the old (mistyped) link.
 *
 * Editing is refused once a decision exists, so an approved entry can't be
 * quietly reassigned to a different supervisor after sign-off.
 */
export async function PATCH(request, { params }) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const { id } = await params;

    const entry = await prisma.logbookEntry.findUnique({
      where: { id },
      include: {
        approval: true,
        student: {
          select: {
            id: true,
            facultyId: true,
            programmeId: true,
            user: { select: { name: true } },
          },
        },
      },
    });
    if (!entry) {
      return NextResponse.json({ error: 'Logbook entry not found.' }, { status: 404 });
    }
    const ownsEntry = actor.student?.id === entry.studentId;
    if (!ownsEntry) {
      if (actor.demo) {
        return NextResponse.json({ error: 'You can only edit your own entries.', code: 'FORBIDDEN' }, { status: 403 });
      }
      try {
        requireCapability(actor.identity, 'logbook.write', {
          studentId: entry.studentId,
          facultyId: entry.student.facultyId,
          programmeId: entry.student.programmeId,
        });
      } catch (error) {
        const routeError = toIdentityRouteError(error);
        return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
      }
    }
    if (entry.status !== 'PENDING' || entry.approval?.decision) {
      return NextResponse.json(
        { error: 'Only pending entries awaiting a decision can be edited.', code: 'ALREADY_DECIDED' },
        { status: 409 },
      );
    }

    const body = await parseJsonBody(request);
    const { supervisor } = supervisorSchema.parse(body);

    // A new token retires the previously sent (possibly misdirected) link.
    const { token, tokenHash, expiresAt } = createMagicToken();

    if (!entry.approval) {
      return NextResponse.json(
        { error: 'This logbook entry has no supervisor approval record.', code: 'APPROVAL_RECORD_MISSING' },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.supervisorApproval.update({
        where: { logbookEntryId: entry.id },
        data: {
          supervisorName: supervisor.name.trim(),
          supervisorEmail: supervisor.email ? supervisor.email.trim() : null,
          supervisorPhone: supervisor.phone ? supervisor.phone.trim() : null,
          tokenHash,
          expiresAt,
          usedAt: null,
        },
      });

      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'LOGBOOK_SUPERVISOR_UPDATED',
        resourceType: 'LogbookEntry',
        resourceId: entry.id,
        before: {
          supervisorName: entry.approval.supervisorName,
          supervisorEmail: entry.approval.supervisorEmail,
          status: entry.status,
        },
        after: {
          supervisorName: supervisor.name.trim(),
          supervisorEmail: supervisor.email ? supervisor.email.trim() : null,
          status: entry.status,
        },
        requestId: getRequestId(request),
      });
    });

    const approvalUrl = `${publicOrigin(request)}/approve/${token}`;

    const delivery = await sendSupervisorApprovalEmail({
      to: supervisor.email ? supervisor.email.trim() : null,
      supervisorName: supervisor.name.trim(),
      studentName: entry.student.user.name,
      entryTitle: entry.title,
      approvalUrl,
    });

    return NextResponse.json({
      entry: { id: entry.id, status: entry.status },
      emailDelivered: delivery.delivered,
      // Returned so the UI can show a copyable link when email isn't configured.
      approvalUrl: delivery.delivered ? undefined : approvalUrl,
      expiresAt,
    });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid supervisor details.' },
        { status: 400 },
      );
    }
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}
