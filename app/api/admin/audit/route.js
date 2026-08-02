import { NextResponse } from 'next/server';

import {
  listAdminAudit,
  parseAdminAuditQuery,
  toAdminRouteError,
} from '@/lib/admin/identity-policy';
import { getAdminIdentity } from '@/lib/admin/route-auth';

export async function GET(request) {
  try {
    const identity = await getAdminIdentity(request);
    const filters = parseAdminAuditQuery(new URL(request.url).searchParams);
    const result = await listAdminAudit({ identity, filters });
    return NextResponse.json(result);
  } catch (error) {
    const routeError = toAdminRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
