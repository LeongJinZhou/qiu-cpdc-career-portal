import { NextResponse } from 'next/server';

import { resolveActor } from '@/lib/auth/actor';
import { getRequestId, toIdentityRouteError } from '@/lib/auth/identity';
import { ConnectionError } from '@/lib/onboarding/connections';
import { completeOnboarding, loadOnboardingState } from '@/lib/onboarding/service';

/**
 * POST /api/onboarding/complete
 *
 * The server re-checks every requirement before recording completion. The
 * client's Continue button being enabled is a UI convenience, never the
 * authority — a student who calls this endpoint directly with LinkedIn missing
 * is refused exactly like one who never reached the step.
 */
export async function POST(request) {
  try {
    const actor = await resolveActor(request);
    const result = await completeOnboarding(actor.student.id, {
      actorUserId: actor.user.id,
      requestId: getRequestId(request),
    });

    return NextResponse.json({
      completed: true,
      ...result,
      state: await loadOnboardingState(actor.student.id),
    });
  } catch (error) {
    if (error instanceof ConnectionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
