import { NextResponse } from 'next/server';

import { resolveActor } from '@/lib/auth/actor';
import { toIdentityRouteError } from '@/lib/auth/identity';
import { OAUTH_PROVIDERS, authorizeUrl, createState, isConfigured } from '@/lib/onboarding/oauth';

/**
 * GET /api/onboarding/oauth/:provider/start
 *
 * Redirects the student to the provider's own consent screen. Refuses with a
 * plain 501 when credentials are absent, rather than sending the student to a
 * broken provider page — the UI only renders this button when the state payload
 * says the provider is configured, so reaching here unconfigured means someone
 * hit the URL directly.
 */
export async function GET(request, { params }) {
  try {
    const actor = await resolveActor(request);
    const providerId = String((await params).provider ?? '').toUpperCase();

    if (!OAUTH_PROVIDERS[providerId]) {
      return NextResponse.json({ error: 'Unknown provider.', code: 'UNKNOWN_PROVIDER' }, { status: 404 });
    }

    if (!isConfigured(providerId)) {
      return NextResponse.json(
        {
          error: `${providerId} sign-in is not switched on for this deployment. Paste your profile link instead.`,
          code: 'OAUTH_NOT_CONFIGURED',
        },
        { status: 501 },
      );
    }

    const state = createState(actor.student.id);
    return NextResponse.redirect(authorizeUrl(providerId, { state, request }));
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
