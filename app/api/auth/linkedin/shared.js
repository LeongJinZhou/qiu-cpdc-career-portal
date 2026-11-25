import { NextResponse } from 'next/server';

import { publicOrigin } from '@/lib/http/public-origin';

export const LINKEDIN_LOGIN_CALLBACK = '/api/auth/linkedin/callback';
export const LINKEDIN_LOGIN_STATE_COOKIE = 'qiu_linkedin_login_state';

/**
 * Rate-limit key: the address Render's proxy appended (the LAST entry). The
 * earlier entries come from the client and can be faked.
 */
export function clientKey(request) {
  const hops = (request.headers.get('x-forwarded-for') ?? '').split(',').map((hop) => hop.trim()).filter(Boolean);
  return hops[hops.length - 1] || request.headers.get('x-real-ip') || 'unknown';
}

/** The signed state is tagged so a login state can never pass as a link state. */
export function loginStateSubject(nonce) {
  return `login-${nonce}`;
}

/** Back to /login with a fixed error code; the page maps codes to wording,
 *  so nothing from the URL is ever shown as text. */
export function loginErrorRedirect(request, code) {
  const url = new URL('/login', publicOrigin(request));
  url.searchParams.set('error', code);
  return NextResponse.redirect(url);
}
