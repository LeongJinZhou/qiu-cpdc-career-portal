import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { getAuthMode, isProduction } from '@/lib/auth/config';
import { authorizeUrl, createState, isConfigured } from '@/lib/onboarding/oauth';
import { createRateLimiter } from '@/lib/rate-limit';
import { clientKey, LINKEDIN_LOGIN_CALLBACK, LINKEDIN_LOGIN_STATE_COOKIE, loginErrorRedirect } from '../shared';

export const runtime = 'nodejs';

const limiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

/**
 * GET /api/auth/linkedin/start  -- "Graduated? Sign in with LinkedIn".
 *
 * A random nonce goes into an httpOnly cookie; the signed state sent to
 * LinkedIn carries the same nonce. The callback accepts only a state that
 * matches this browser's cookie (login CSRF protection).
 */
export async function GET(request) {
  if (getAuthMode() !== 'firebase-google' || !isConfigured('LINKEDIN')) {
    return loginErrorRedirect(request, 'linkedin-off');
  }
  if (!limiter.check(clientKey(request)).allowed) {
    return loginErrorRedirect(request, 'linkedin-busy');
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const response = NextResponse.redirect(authorizeUrl('LINKEDIN', {
    state: createState(nonce),
    request,
    callbackPath: LINKEDIN_LOGIN_CALLBACK,
  }));
  response.cookies.set(LINKEDIN_LOGIN_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/api/auth/linkedin',
    maxAge: 10 * 60,
  });
  return response;
}
