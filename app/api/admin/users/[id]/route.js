import { NextResponse } from 'next/server';

import { getRequestId, parseJsonBody } from '@/lib/auth/identity';
import { toAdminRouteError, updateAdminUser } from '@/lib/admin/identity-policy';
import { getAdminIdentity } from '@/lib/admin/route-auth';

export async function PATCH(request, { params }) {
  try {
    const identity = await getAdminIdentity(request);
    const body = await parseJsonBody(request);
    const { id } = await params;

    const result = await updateAdminUser({
      identity,
      targetUserId: id,
      input: body,
      requestId: getRequestId(request),
      idempotencyKey: request.headers.get('idempotency-key') ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    const routeError = toAdminRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
