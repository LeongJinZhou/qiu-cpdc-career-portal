import { prisma } from '../prisma.js';
import { createAuditEntry } from '../audit/index.js';
import { getAuthenticatedIdentity, getRequestId } from './identity.js';

/**
 * Record a logout when the caller still has a valid session. Clearing an
 * already-stale cookie is still safe and successful; the audit entry is best
 * effort because logout must never strand the user behind an error screen.
 */
export async function recordLogout(request, { prismaClient = prisma } = {}) {
  try {
    const identity = await getAuthenticatedIdentity(request, { prismaClient });
    await prismaClient.$transaction(async (tx) => {
      await createAuditEntry({
        tx,
        actorUserId: identity.user.id,
        action: 'LOGOUT',
        resourceType: 'User',
        resourceId: identity.user.id,
        requestId: getRequestId(request),
        metadata: { source: 'SERVER_SESSION' },
      });
    });
  } catch {
    // The cookie is cleared by the route even if the session or audit store is
    // already unavailable.
  }
}
