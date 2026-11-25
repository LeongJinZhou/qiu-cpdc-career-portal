import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getAuthMode } from '@/lib/auth/config';
import { getRequestId } from '@/lib/auth/identity';
import { authorizeAlumniLinkedIn } from '@/lib/auth/linkedin-signin';
import { issueSessionCookie } from '@/lib/auth/session';
import { fetchOAuthProfile, isConfigured, verifyState } from '@/lib/onboarding/oauth';
import { createRateLimiter } from '@/lib/rate-limit';
import { clientKey, LINKEDIN_LOGIN_CALLBACK, LINKEDIN_LOGIN_STATE_COOKIE, loginErrorRedirect } from '../shared';

export const runtime = 'nodejs';

const limiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

const ERROR_CODES = {
  LINKEDIN_NOT_LINKED: 'linkedin-not-linked',
  LINKEDIN_NOT_ALUMNI: 'linkedin-not-alumni',
  LINKEDIN_ACCOUNT_BLOCKED: 'linkedin-blocked',
  LINKEDIN_AMBIGUOUS: 'linkedin-ambiguous',
};

/** GET /api/auth/linkedin/callback -- finishes alumni sign-in. */
export async function GET(request) {
  const query = new URL(request.url).searchParams;
  const nonce = request.cookies.get(LINKEDIN_LOGIN_STATE_COOKIE)?.value ?? '';

  const finish = (response) => {
    // The state cookie is single-use, whatever the outcome.
    response.cookies.set(LINKEDIN_LOGIN_STATE_COOKIE, '', { path: '/api/auth/linkedin', maxAge: 0 });
    return response;
  };

  if (getAuthMode() !== 'firebase-google' || !isConfigured('LINKEDIN')) {
    return finish(loginErrorRedirect(request, 'linkedin-off'));
  }
  if (!limiter.check(clientKey(request)).allowed) {
    return finish(loginErrorRedirect(request, 'linkedin-busy'));
  }
  if (query.get('error')) {
    return finish(loginErrorRedirect(request, 'linkedin-cancelled'));
  }
  const code = query.get('code');
  if (!code || !nonce || !verifyState(query.get('state'), nonce)) {
    return finish(loginErrorRedirect(request, 'linkedin-expired'));
  }

  try {
    const profile = await fetchOAuthProfile('LINKEDIN', code, request, { callbackPath: LINKEDIN_LOGIN_CALLBACK });
    const user = await authorizeAlumniLinkedIn({
      prisma,
      linkedinId: profile.providerUserId,
      verifiedEmail: profile.verifiedEmail,
      requestId: getRequestId(request),
    });

    const session = issueSessionCookie(user);
    const response = NextResponse.redirect(new URL('/network', new URL(request.url).origin));
    response.cookies.set(session.name, session.value, session.options);
    return finish(response);
  } catch (error) {
    const known = ERROR_CODES[error?.code];
    if (!known) console.warn('[linkedin-login] sign-in failed', error?.name ?? 'Error');
    return finish(loginErrorRedirect(request, known ?? 'linkedin-failed'));
  }
}
