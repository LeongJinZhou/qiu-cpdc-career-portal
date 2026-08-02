import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getAuthMode } from '@/lib/auth/config';
import {
  AUTH_SESSION_COOKIE,
  clearSessionCookie,
  createSessionCookie,
  readSessionCookie,
} from '@/lib/auth/session';
import { recordLogout } from '@/lib/auth/logout';

const sessionBodySchema = z.object({
  idToken: z.string().trim().min(1, 'idToken is required'),
});

function getRequestId(request) {
  return request.headers.get('x-request-id') || null;
}

function parseAuthError(error) {
  if (error instanceof z.ZodError) {
    return { status: 400, message: error.issues[0]?.message || 'Invalid request body.' };
  }

  if (typeof error?.status === 'number') {
    return {
      status: error.status,
      code: error.code ?? 'AUTHENTICATION_ERROR',
      message: error.message,
    };
  }

  return {
    status: 500,
    code: 'AUTHENTICATION_UNAVAILABLE',
    message: 'Authentication is unavailable right now.',
  };
}

export async function POST(request) {
  try {
    if (getAuthMode() !== 'firebase-google') {
      return NextResponse.json(
        { error: 'Server sessions are disabled while AUTH_MODE=demo is active.' },
        { status: 400 },
      );
    }

    const body = sessionBodySchema.parse(await request.json());
    const sessionCookie = await createSessionCookie(body.idToken, {
      prisma,
      requestId: getRequestId(request),
    });

    const response = NextResponse.json({ user: sessionCookie.user });
    response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
    return response;
  } catch (error) {
    const authError = parseAuthError(error);
    return NextResponse.json(
      { error: authError.message, code: authError.code },
      { status: authError.status },
    );
  }
}

export async function GET(request) {
  try {
    const session = await readSessionCookie(
      request.cookies.get(AUTH_SESSION_COOKIE)?.value,
      { prisma },
    );

    if (!session) {
      const response = NextResponse.json({ error: 'No active session.' }, { status: 401 });
      const cookie = clearSessionCookie();
      response.cookies.set(cookie.name, cookie.value, cookie.options);
      return response;
    }

    return NextResponse.json(session);
  } catch (error) {
    const authError = parseAuthError(error);
    return NextResponse.json(
      { error: authError.message, code: authError.code },
      { status: authError.status },
    );
  }
}

export async function DELETE(request) {
  await recordLogout(request);
  const cookie = clearSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
