import { NextResponse } from 'next/server';

export const LINKEDIN_LOGIN_CALLBACK = '/api/auth/linkedin/callback';
export const LINKEDIN_LOGIN_STATE_COOKIE = 'qiu_linkedin_login_state';

/** Rate-limit key: the client's address as Render's proxy reports it. */
export function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0].trim() || 'unknown';
}

/** Back to /login with a fixed error code; the page maps codes to wording,
 *  so nothing from the URL is ever shown as text. */
export function loginErrorRedirect(request, code) {
  const url = new URL('/login', new URL(request.url).origin);
  url.searchParams.set('error', code);
  return NextResponse.redirect(url);
}
