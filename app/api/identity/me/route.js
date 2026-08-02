import { NextResponse } from 'next/server';

import { getAuthenticatedIdentity, toIdentityRouteError } from '@/lib/auth/identity';

export async function GET(request) {
  try {
    const identity = await getAuthenticatedIdentity(request);
    return NextResponse.json(identity);
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
