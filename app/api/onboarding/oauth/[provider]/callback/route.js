import { NextResponse } from 'next/server';

import { resolveActor } from '@/lib/auth/actor';
import { getRequestId } from '@/lib/auth/identity';
import { OAUTH_PROVIDERS, fetchOAuthProfile, isConfigured, verifyState } from '@/lib/onboarding/oauth';
import { connectAccountByOAuth } from '@/lib/onboarding/service';

/**
 * GET /api/onboarding/oauth/:provider/callback
 *
 * Always redirects back to /onboarding with a readable status in the query
 * string — a student who declines consent, or hits a provider outage, must land
 * back in the flow with an explanation, never on a JSON error page.
 */
function back(request, params) {
  const url = new URL('/onboarding', new URL(request.url).origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, String(value));
  });
  return NextResponse.redirect(url);
}

export async function GET(request, { params }) {
  const providerId = String((await params).provider ?? '').toUpperCase();
  const query = new URL(request.url).searchParams;

  try {
    if (!OAUTH_PROVIDERS[providerId] || !isConfigured(providerId)) {
      return back(request, { connectError: 'That sign-in method is not available.' });
    }

    // The student pressed "Cancel" on the provider's consent screen.
    if (query.get('error')) {
      return back(request, {
        connectError: query.get('error_description') || 'You cancelled the connection.',
      });
    }

    const actor = await resolveActor(request);
    const code = query.get('code');
    const state = query.get('state');

    // State is bound to this student and signed, so a callback captured from
    // another session cannot attach that account here.
    if (!code || !verifyState(state, actor.student.id)) {
      return back(request, {
        connectError: 'That connection link expired or did not match your session. Please try again.',
      });
    }

    const profile = await fetchOAuthProfile(providerId, code, request);

    if (!profile.providerUserId) {
      return back(request, { connectError: `${providerId} did not return an account id.` });
    }

    await connectAccountByOAuth(actor.student.id, providerId, {
      profileUrl: profile.profileUrl,
      handle: profile.handle,
      providerUserId: profile.providerUserId,
      rawProfile: profile.raw,
      actorUserId: actor.user.id,
      requestId: getRequestId(request),
    });

    // LinkedIn verifies the person but cannot hand over the public URL, so the
    // flow tells the student exactly what is still needed rather than showing a
    // green tick over an incomplete connection.
    return back(request, {
      connected: providerId,
      needsUrl: OAUTH_PROVIDERS[providerId].yieldsProfileUrl ? null : providerId,
    });
  } catch (error) {
    console.error(`[oauth:${providerId}] callback failed`, error);
    return back(request, {
      connectError: 'We could not complete that connection. Please try again, or paste your profile link.',
    });
  }
}
