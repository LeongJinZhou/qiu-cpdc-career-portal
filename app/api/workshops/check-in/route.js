import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getAuthMode } from '@/lib/auth/config';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody, getRequestId } from '@/lib/auth/identity';
import { createAuditEntry } from '@/lib/audit';
import { awardXpOnce, sumStudentXp } from '@/lib/xp-ledger';
import { isQrCheckInOpen } from '@/lib/workshop-policy';

// Production requires the QR secret (the credential a camera reads off the
// printed code). Demo mode has no camera, so a simulated scan may pass the
// workshopId directly — this branch is unreachable on a live site because
// getAuthMode() refuses demo in production.
const checkInSchema = z
  .object({
    qrSecret: z.string().trim().min(1).optional(),
    workshopId: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.qrSecret || v.workshopId, {
    message: 'qrSecret is required',
  });

/**
 * Validate a workshop's QR secret and record attendance for the acting
 * student, awarding the workshop's XP exactly once (Module 5). A second scan
 * of the same code is idempotent: the unique attendance row and the ledger
 * dedupeKey both short-circuit, so no duplicate XP is granted.
 */
export async function POST(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const body = await parseJsonBody(request);
    const { qrSecret, workshopId } = checkInSchema.parse(body);

    let workshop = null;
    if (qrSecret) {
      workshop = await prisma.workshop.findUnique({ where: { qrSecret } });
      if (workshop && !isQrCheckInOpen(workshop.startsAt)) {
        return NextResponse.json(
          { error: 'This workshop QR code is outside its check-in window.', code: 'QR_EXPIRED' },
          { status: 410 },
        );
      }
    } else if (workshopId && getAuthMode() === 'demo') {
      workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
    }

    if (!workshop) {
      return NextResponse.json(
        { error: 'That QR code is not valid.', code: 'INVALID_QR' },
        { status: 404 },
      );
    }

    const studentId = actor.student.id;
    const dedupeKey = `workshop:${studentId}:${workshop.id}`;

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.workshopAttendance.createMany({
        data: { workshopId: workshop.id, studentId },
        skipDuplicates: true,
      });
      const alreadyCheckedIn = created.count === 0;

      const { awarded } = await awardXpOnce(
        {
          studentId,
          amount: workshop.xpValue,
          source: 'WORKSHOP_ATTENDANCE',
          note: workshop.title,
          dedupeKey,
        },
        tx,
      );

      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'WORKSHOP_CHECK_IN',
        resourceType: 'Workshop',
        resourceId: workshop.id,
        after: {
          workshopId: workshop.id,
          studentId,
          alreadyCheckedIn,
          xpAwarded: awarded ? workshop.xpValue : 0,
        },
        requestId: getRequestId(request),
      });

      return { alreadyCheckedIn, awarded };
    });

    const xp = await sumStudentXp(studentId);

    return NextResponse.json({
      workshopId: workshop.id,
      title: workshop.title,
      alreadyCheckedIn: result.alreadyCheckedIn,
      xpAwarded: result.awarded ? workshop.xpValue : 0,
      xp,
    });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid check-in.' },
        { status: 400 },
      );
    }
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}
