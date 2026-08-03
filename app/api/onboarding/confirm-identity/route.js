import { NextResponse } from 'next/server';

import { resolveActor } from '@/lib/auth/actor';
import { getRequestId, toIdentityRouteError } from '@/lib/auth/identity';
import { confirmIdentity, loadOnboardingState } from '@/lib/onboarding/service';

/**
 * POST /api/onboarding/confirm-identity
 *
 * Records that the student accepted their auto-detected academic record. The
 * body carries nothing: the student cannot edit these fields (they are
 * QIU-controlled and locked), so there is nothing to submit — only an
 * acknowledgement. Corrections go through the Super-Admin override panel.
 */
export async function POST(request) {
  try {
    const actor = await resolveActor(request);
    const result = await confirmIdentity(actor.student.id, {
      actorUserId: actor.user.id,
      requestId: getRequestId(request),
    });

    return NextResponse.json({
      ...result,
      state: await loadOnboardingState(actor.student.id),
    });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
