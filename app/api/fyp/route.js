import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody, getRequestId } from '@/lib/auth/identity';
import { createAuditEntry } from '@/lib/audit';
import { createNotifications, userIdsForScopedStaff } from '@/lib/notifications';
import { awardXpOnce, sumStudentXp } from '@/lib/xp-ledger';
import { XP_VALUES } from '@/lib/xp';
import { normalizeFypSaveStatus } from '@/lib/fyp-status-policy';

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

const optionalUrl = z
  .union([z.string().trim().url('Must be a valid URL'), z.literal(''), z.null()])
  .optional();

const submitSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  abstract: z.string().trim().min(1, 'abstract is required').max(5000),
  supervisorName: z.string().trim().max(200).optional().nullable(),
  repositoryUrl: optionalUrl,
  liveUrl: optionalUrl,
  posterData: z.string().max(3_500_000, 'Poster is too large (max ~2.5MB).').optional().nullable(),
  posterName: z.string().trim().max(200).optional().nullable(),
  publicOptIn: z.boolean().optional().default(false),
  status: z.enum(['DRAFT', 'PENDING_REVIEW']).optional().default('PENDING_REVIEW'),
});

function serializeProject(project) {
  if (!project) return null;
  return {
    id: project.id,
    title: project.title,
    abstract: project.abstract,
    supervisorName: project.supervisorName,
    repositoryUrl: project.repositoryUrl,
    liveUrl: project.liveUrl,
    posterName: project.posterName,
    hasPoster: Boolean(project.posterData),
    status: project.status,
    publicOptIn: project.publicOptIn,
    reviewerName: project.reviewerName,
    reviewNote: project.reviewNote,
    reviewedAt: project.reviewedAt,
    updatedAt: project.updatedAt,
  };
}

/** The acting student's FYP project (or null). */
export async function GET(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const project = await prisma.fYPProject.findUnique({
      where: { studentId: actor.student.id },
    });
    return NextResponse.json({ project: serializeProject(project) });
  } catch (error) {
    return routeError(error);
  }
}

/**
 * Create or update the acting student's FYP submission (Module 2).
 *
 * Any content change resets the record to PENDING_REVIEW and clears a prior
 * decision — an approved project can't silently change under the Head of
 * Programme after sign-off. The one-time FYP submission XP is awarded via an
 * idempotent ledger entry keyed to the student.
 */
export async function POST(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const body = await parseJsonBody(request);
    const data = submitSchema.parse(body);
    const studentId = actor.student.id;

    const status = normalizeFypSaveStatus(data.status);
    const shared = {
      title: data.title,
      abstract: data.abstract,
      supervisorName: data.supervisorName || null,
      repositoryUrl: data.repositoryUrl || null,
      liveUrl: data.liveUrl || null,
      posterName: data.posterName ?? null,
      publicOptIn: Boolean(data.publicOptIn),
      // Re-enters the queue on every edit.
      status,
      reviewerName: null,
      reviewNote: null,
      reviewedAt: null,
    };

    // Only overwrite the stored poster when a new one is supplied, so a plain
    // metadata edit doesn't wipe an existing upload.
    if (typeof data.posterData === 'string' && data.posterData.length > 0) {
      shared.posterData = data.posterData;
    }

    const project = await prisma.$transaction(async (tx) => {
      const saved = await tx.fYPProject.upsert({
        where: { studentId },
        update: shared,
        create: { studentId, ...shared, posterData: shared.posterData ?? null },
      });

      if (status !== 'DRAFT') {
        await awardXpOnce({
          studentId,
          amount: XP_VALUES.FYP_SUBMISSION,
          source: 'FYP_SUBMISSION',
          note: saved.title,
          dedupeKey: `fyp-submission:${studentId}`,
        }, tx);
      }

      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: status === 'DRAFT' ? 'FYP_DRAFT_SAVED' : 'FYP_SUBMITTED',
        resourceType: 'FYPProject',
        resourceId: saved.id,
        after: {
          studentId: saved.studentId,
          title: saved.title,
          status: saved.status,
          publicOptIn: saved.publicOptIn,
          hasPoster: Boolean(saved.posterData),
        },
        requestId: getRequestId(request),
      });

      if (status !== 'DRAFT') {
        const reviewerIds = (await userIdsForScopedStaff(tx, {
          globalRoles: ['CPDC_ADMIN', 'SUPER_ADMIN'],
          scopedRoles: ['HEAD_OF_PROGRAMME'],
          facultyId: actor.student.facultyId,
          programmeId: actor.student.programmeId,
        })).filter((userId) => userId !== actor.user.id);
        await createNotifications(tx, {
          recipientUserIds: reviewerIds,
          actorUserId: actor.user.id,
          type: 'FYP_SUBMITTED',
          title: 'FYP project needs review',
          body: `${actor.user.name} submitted “${saved.title}” for programme review.`,
          href: '/admin',
          resourceType: 'FYPProject',
          resourceId: saved.id,
          dedupeKey: `fyp.submitted:${saved.id}:${saved.updatedAt.toISOString()}`,
        });
      }

      return saved;
    });

    const xp = await sumStudentXp(studentId);
    return NextResponse.json({ project: serializeProject(project), xp }, { status: 201 });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid FYP submission.' },
        { status: 400 },
      );
    }
    return routeError(error);
  }
}
