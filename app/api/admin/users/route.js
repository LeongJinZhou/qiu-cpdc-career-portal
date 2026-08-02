import { NextResponse } from 'next/server';

import { getRequestId, parseJsonBody } from '@/lib/auth/identity';
import {
  createAdminUser,
  listAdminUsers,
  parseAdminUsersQuery,
  toAdminRouteError,
} from '@/lib/admin/identity-policy';
import { getAdminIdentity } from '@/lib/admin/route-auth';

export async function GET(request) {
  try {
    const identity = await getAdminIdentity(request);
    const filters = parseAdminUsersQuery(new URL(request.url).searchParams);
    const result = await listAdminUsers({ identity, filters });
    return NextResponse.json(result);
  } catch (error) {
    const routeError = toAdminRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}

export async function POST(request) {
  try {
    const identity = await getAdminIdentity(request);
    const body = await parseJsonBody(request);
    const result = await createAdminUser({
      identity,
      input: body,
      requestId: getRequestId(request),
      idempotencyKey: request.headers.get('idempotency-key') ?? null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const routeError = toAdminRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
