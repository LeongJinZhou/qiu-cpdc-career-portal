import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashToken, tokenMatches, isExpired } from '@/lib/magic-link';
import { XP_VALUES } from '@/lib/xp';
import { awardXpOnce } from '@/lib/xp-ledger';
import { createAuditEntry } from '@/lib/audit';
import { getRequestId } from '@/lib/auth/identity';
import { evaluateStudentLifecycle } from '@/lib/automation';

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().trim().max(2000).optional().nullable(),
});

/**
 * Look up an approval by its raw token.
 *
 * The hash is indexed, so we fetch by hash directly rather than scanning every
 * row, then re-verify in constant time to avoid a timing side channel.
 */
async function loadApproval(token) {
  const approval = await prisma.supervisorApproval.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      logbookEntry: {
        include: { student: { include: { user: true, faculty: true } } },
      },
    },
  });

  if (!approval) return null;
  return tokenMatches(token, approval.tokenHash) ? approval : null;
}

// What the supervisor sees before deciding. No account, no password.
export async function GET(_request, { params }) {
  const { token } = await params;
  const approval = await loadApproval(token);

  if (!approval) {
    return NextResponse.json({ error: 'Invalid approval link' }, { status: 404 });
  }
  if (approval.usedAt) {
    return NextResponse.json({ error: 'This link has already been used' }, { status: 410 });
  }
  if (isExpired(approval)) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
  }

  const entry = approval.logbookEntry;

  return NextResponse.json({
    supervisorName: approval.supervisorName,
    expiresAt: approval.expiresAt,
    entry: {
      title: entry.title,
      details: entry.details,
      hours: entry.hours,
      entryDate: entry.entryDate,
      fieldValues: entry.fieldValues,
      location:
        entry.latitude != null && entry.longitude != null
          ? { latitude: entry.latitude, longitude: entry.longitude }
          : null,
      student: {
        name: entry.student.user.name,
        matricNo: entry.student.matricNo,
        faculty: entry.student.faculty.name,
      },
    },
  });
}

// Record the decision. Single-use: the token is burned on first submission.
export async function POST(request, { params }) {
  const { token } = await params;
  let decision;
  let comment;
  try {
    ({ decision, comment } = decisionSchema.parse(await request.json()));
  } catch (error) {
    return NextResponse.json(
      { error: error?.issues?.[0]?.message ?? "decision must be 'APPROVED' or 'REJECTED'" },
      { status: 400 },
    );
  }

  const approval = await loadApproval(token);

  if (!approval) {
    return NextResponse.json({ error: 'Invalid approval link' }, { status: 404 });
  }
  if (approval.usedAt) {
    return NextResponse.json({ error: 'This link has already been used' }, { status: 410 });
  }
  if (isExpired(approval)) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
  }

  const studentId = approval.logbookEntry.studentId;

  // One transaction so a link can never be spent without its decision landing.
  try {
    await prisma.$transaction(async (tx) => {
      // Guarded update: if a concurrent request burned the token first, this
      // matches zero rows and the transaction aborts instead of double-awarding.
      const burned = await tx.supervisorApproval.updateMany({
        where: { id: approval.id, usedAt: null },
        data: { usedAt: new Date(), decision, comment: comment ?? null },
      });

      if (burned.count === 0) {
        throw new Error('ALREADY_USED');
      }

      await tx.logbookEntry.update({
        where: { id: approval.logbookEntryId },
        data: { status: decision },
      });

      if (decision === 'APPROVED') {
        await awardXpOnce({
          studentId,
          amount: XP_VALUES.LOGBOOK_ONTIME,
          source: 'LOGBOOK_ONTIME',
          note: approval.logbookEntry.title,
          dedupeKey: `logbook:${approval.logbookEntryId}`,
        }, tx);

        // Verified hours are the source of truth for the standalone lifecycle
        // rule. The helper is idempotent, so every approval can safely trigger
        // a re-evaluation until the internship threshold is reached.
        await evaluateStudentLifecycle(studentId, {
          tx,
          requestId: getRequestId(request),
          trigger: 'SUPERVISOR_LOGBOOK_APPROVED',
        });
      }

      await createAuditEntry({
        tx,
        actorUserId: null,
        action: 'SUPERVISOR_LOGBOOK_DECISION',
        resourceType: 'LogbookEntry',
        resourceId: approval.logbookEntryId,
        before: { status: approval.logbookEntry.status, decision: null },
        after: { status: decision, decision, comment: comment ?? null },
        requestId: getRequestId(request),
        metadata: { supervisorApprovalId: approval.id },
      });
    });
  } catch (error) {
    if (error.message === 'ALREADY_USED') {
      return NextResponse.json({ error: 'This link has already been used' }, { status: 410 });
    }
    throw error;
  }

  return NextResponse.json({ status: decision });
}
