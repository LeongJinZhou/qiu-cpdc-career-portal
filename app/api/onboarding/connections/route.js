import { NextResponse } from 'next/server';

import { resolveActor } from '@/lib/auth/actor';
import { getRequestId, toIdentityRouteError } from '@/lib/auth/identity';
import { ConnectionError } from '@/lib/onboarding/connections';
import {
  connectAccountByUrl,
  disconnectAccount,
  loadOnboardingState,
} from '@/lib/onboarding/service';

function connectionErrorResponse(error) {
  // A bad link is the student's normal, expected mistake — a 400 with the
  // specific reason, never a 500.
  const status = error.code === 'PROVIDER_REQUIRED' ? 409
    : error.code === 'NOT_FOUND' ? 404
      : 400;
  return NextResponse.json({ error: error.message, code: error.code }, { status });
}

/** POST — attach or replace a professional profile link. */
export async function POST(request) {
  try {
    const actor = await resolveActor(request);
    const body = await request.json().catch(() => ({}));
    const provider = typeof body.provider === 'string' ? body.provider.trim().toUpperCase() : '';

    const { warning } = await connectAccountByUrl(actor.student.id, provider, body.profileUrl, {
      actorUserId: actor.user.id,
      requestId: getRequestId(request),
    });

    return NextResponse.json({
      connected: true,
      warning,
      state: await loadOnboardingState(actor.student.id),
    });
  } catch (error) {
    if (error instanceof ConnectionError) return connectionErrorResponse(error);
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}

/** DELETE — detach an optional account. Required providers are refused (409). */
export async function DELETE(request) {
  try {
    const actor = await resolveActor(request);
    const provider = new URL(request.url).searchParams.get('provider')?.trim().toUpperCase() ?? '';

    await disconnectAccount(actor.student.id, provider, {
      actorUserId: actor.user.id,
      requestId: getRequestId(request),
    });

    return NextResponse.json({
      disconnected: true,
      state: await loadOnboardingState(actor.student.id),
    });
  } catch (error) {
    if (error instanceof ConnectionError) return connectionErrorResponse(error);
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
