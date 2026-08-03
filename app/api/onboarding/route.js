import { NextResponse } from 'next/server';

import { resolveActor } from '@/lib/auth/actor';
import { toIdentityRouteError } from '@/lib/auth/identity';
import { configuredProviders } from '@/lib/onboarding/oauth';
import { loadOnboardingState } from '@/lib/onboarding/service';

/**
 * GET /api/onboarding — the student's first-login state.
 *
 * This is the single source the onboarding page and the portal gate both read,
 * so "have I already confirmed?" always has one answer. Non-student accounts
 * get an explicit `needsOnboarding: false` rather than a 403: staff, employers
 * and alumni have no onboarding to do, and a route that errors for them would
 * force every caller to special-case roles.
 */
export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });

    if (!actor.student) {
      return NextResponse.json({ needsOnboarding: false, reason: 'NO_STUDENT', student: null });
    }

    const state = await loadOnboardingState(actor.student.id);

    if (!state) {
      return NextResponse.json({ needsOnboarding: false, reason: 'NO_STUDENT', student: null });
    }

    // The UI renders a "Sign in with …" button only for providers that actually
    // have credentials, so a student is never shown a button that dead-ends.
    return NextResponse.json({
      ...state,
      oauthProviders: configuredProviders(),
      demo: actor.demo,
    });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
