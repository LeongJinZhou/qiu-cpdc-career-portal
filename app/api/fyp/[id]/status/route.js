import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveActor, actorCanDecideFyp } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody, getRequestId } from '@/lib/auth/identity';
import { updateFypStatus } from '@/lib/fyp-status';

const statusSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'NEEDS_CHANGES']),
  reviewNote: z.string().trim().max(2000).optional().nullable(),
});

export async function PATCH(request, { params }) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!actorCanDecideFyp(actor.role)) {
      return NextResponse.json(
        { error: 'Only programme staff can update FYP status.', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = statusSchema.parse(await parseJsonBody(request));
    const project = await updateFypStatus({
      projectId: id,
      status: body.status,
      reviewNote: body.reviewNote ?? null,
      actor,
      requestId: getRequestId(request),
    });

    return NextResponse.json({
      project: {
        id: project.id,
        status: project.status,
        reviewerName: project.reviewerName,
        reviewNote: project.reviewNote,
        reviewedAt: project.reviewedAt,
      },
    });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid status update.', code: 'INVALID_FYP_STATUS' },
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
