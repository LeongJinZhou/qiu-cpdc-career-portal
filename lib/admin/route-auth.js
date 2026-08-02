import { resolveActor } from '@/lib/auth/actor';
import { createIdentityError } from '@/lib/auth/identity';

const ADMIN_ROLES = new Set(['CPDC_ADMIN', 'SUPER_ADMIN']);

/**
 * Resolve an admin identity for admin-only routes.
 *
 * In Firebase mode this returns the verified session identity. In the explicit
 * local demo mode it projects the selected CPDC/Super Admin role onto the
 * seeded actor so the People and Audit screens exercise the real database
 * policy instead of presenting buttons that can never work. The actor helper
 * refuses this branch outside development, so the client header is never an
 * authority on a hosted deployment.
 */
export async function getAdminIdentity(request) {
  const actor = await resolveActor(request, { allowNonStudent: true });

  if (!ADMIN_ROLES.has(actor.role)) {
    throw createIdentityError(
      403,
      'INSUFFICIENT_CAPABILITY',
      'This area is restricted to CPDC and Super Admin accounts.',
    );
  }

  if (actor.identity) return actor.identity;

  return {
    user: {
      ...actor.user,
      role: actor.role,
      normalizedEmail: actor.user.email?.trim().toLowerCase() ?? null,
    },
    assignments: [{
      id: `demo-admin:${actor.user.id}:${actor.role}`,
      role: actor.role,
      scopeType: 'GLOBAL',
      scopeValue: 'GLOBAL',
    }],
    student: actor.student ?? null,
    role: actor.role,
  };
}

