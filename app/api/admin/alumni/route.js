import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createAuditEntry } from '@/lib/audit/index.js';
import { getRequestId } from '@/lib/auth/identity';
import { listAlumni, summarizeAlumni } from '@/lib/admin/alumni';
import { toAdminRouteError } from '@/lib/admin/identity-policy';
import { getAdminIdentity } from '@/lib/admin/route-auth';

/**
 * GET /api/admin/alumni -- CPDC admins and super admins only (the server
 * checks; the hidden tab is only for looks). Holds personal emails, so every
 * read is written to the audit log (count only, never the data).
 */
export async function GET(request) {
  try {
    const identity = await getAdminIdentity(request);
    const rows = await listAlumni(prisma);

    await prisma.$transaction(async (tx) => {
      await createAuditEntry({
        tx,
        actorUserId: identity.user.id,
        action: 'ALUMNI_LIST_VIEWED',
        resourceType: 'Alumni',
        resourceId: 'list',
        metadata: { rows: rows.length },
        requestId: getRequestId(request),
      });
    });

    return NextResponse.json({ rows, summary: summarizeAlumni(rows) }, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    const routeError = toAdminRouteError(error);
    return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
  }
}
