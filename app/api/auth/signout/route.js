import { NextResponse } from 'next/server';

import { clearSessionCookie } from '@/lib/auth/session';
import { recordLogout } from '@/lib/auth/logout';

/**
 * Sign out.
 *
 * Logout revokes the server-side session timestamp and clears the httpOnly
 * cookie — browser storage cleanup is cosmetic and cannot be trusted, because
 * the cookie is not readable from JavaScript in the first place. Exposed as its own POST endpoint (as well as
 * DELETE /api/auth/session) so /logout, and any plain HTML form fallback, has a
 * single obvious target.
 *
 * Always returns 200: signing out when you are already signed out is a success,
 * not an error, and reporting a failure there would only strand the user.
 */
async function signOutResponse(request) {
  await recordLogout(request);
  const cookie = clearSessionCookie();
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

export async function POST(request) {
  return signOutResponse(request);
}

export async function DELETE(request) {
  return signOutResponse(request);
}
