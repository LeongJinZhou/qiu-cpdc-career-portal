import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor, actorCanDecideFyp } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody, getRequestId } from '@/lib/auth/identity';
import { reviewerWhere } from '@/lib/fyp-review';
import { updateFypStatus } from '@/lib/fyp-status';

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

const decisionSchema = z.object({
  projectId: z.string().trim().min(1, 'projectId is required'),
  status: z.enum(['APPROVED', 'NEEDS_CHANGES']),
  reviewNote: z.string().trim().max(2000).optional().nullable(),
});

/**
 * The Head of Programme's review queue (Module 2). A HoP is scoped to their own
 * programme; coordinators/admins see their faculty or all. Demo mode resolves
 * the seeded staff context, so the queue is populated from the same DB the
 * students write to — an approval persists across devices and refreshes.
 */
export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!actorCanDecideFyp(actor.role)) {
      return NextResponse.json(
        { error: 'Only programme staff can review FYP submissions.', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    const where = reviewerWhere(actor);
    if (where == null) {
      return NextResponse.json(
        { error: 'Your reviewer role has no configured programme or faculty scope.', code: 'REVIEW_SCOPE_REQUIRED' },
        { status: 403 },
      );
    }

    const projects = await prisma.fYPProject.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
            programme: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        abstract: p.abstract,
        supervisorName: p.supervisorName,
        repositoryUrl: p.repositoryUrl,
        liveUrl: p.liveUrl,
        status: p.status,
        publicOptIn: p.publicOptIn,
        reviewerName: p.reviewerName,
        reviewNote: p.reviewNote,
        reviewedAt: p.reviewedAt,
        updatedAt: p.updatedAt,
        studentName: p.student.user.name,
        studentMatric: p.student.matricNo,
        programme: p.student.programme?.name ?? null,
      })),
    });
  } catch (error) {
    return routeError(error);
  }
}

/** Record a review decision on a project. */
export async function POST(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    // Recording a decision is narrower than opening the queue. This used to
    // gate on actorCanReview — which merely means "may see a review queue" —
    // so a Faculty Coordinator could sign off an FYP even though the roles
    // matrix marks them read-only and actorCanDecideFyp excludes them. The GET
    // above already uses the narrow predicate; the write must match it.
    if (!actorCanDecideFyp(actor.role)) {
      return NextResponse.json(
        {
          error: 'Only a Head of Programme, CPDC officer or Super Admin can record an FYP decision.',
          code: 'FORBIDDEN',
        },
        { status: 403 },
      );
    }

    const body = await parseJsonBody(request);
    const { projectId, status, reviewNote } = decisionSchema.parse(body);

    const updated = await updateFypStatus({
      projectId,
      status,
      reviewNote: reviewNote ?? null,
      actor,
      requestId: getRequestId(request),
    });

    return NextResponse.json({
      project: {
        id: updated.id,
        status: updated.status,
        reviewerName: updated.reviewerName,
        reviewNote: updated.reviewNote,
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid decision.' },
        { status: 400 },
      );
    }
    return routeError(error);
  }
}
