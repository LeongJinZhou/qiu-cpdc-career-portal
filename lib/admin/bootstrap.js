import { z } from 'zod';

const DEFAULT_BOOTSTRAP_ADMIN_NAME = 'QIU CPDC Super Admin';

const bootstrapAdminSchema = z.object({
  email: z.string().trim().min(1, 'email is required').email('email must be valid').max(254, 'email is too long'),
  name: z.string().trim().min(1, 'name is required').max(120, 'name is too long'),
});

export function normalizeBootstrapAdminInput(input = {}) {
  const parsed = bootstrapAdminSchema.parse({
    email: input.email,
    name: typeof input.name === 'string' && input.name.trim()
      ? input.name
      : DEFAULT_BOOTSTRAP_ADMIN_NAME,
  });

  return {
    email: parsed.email,
    normalizedEmail: parsed.email.toLowerCase(),
    name: parsed.name,
  };
}

/** Suspended or disabled on purpose (e.g. after a compromise): never undone by a deploy. */
export function isDeliberatelyBlocked(existing) {
  return existing?.accountStatus === 'SUSPENDED' || existing?.accountStatus === 'DISABLED';
}

/**
 * What must change so `existing` is an active Super Admin, or null when it
 * already is. The deploy seed calls this every release; returning null keeps
 * an unchanged account from writing an audit entry on every deploy. Callers
 * check isDeliberatelyBlocked first.
 */
export function superAdminPatchFor(existing, normalizedEmail = null) {
  const patch = {};
  if (existing?.role !== 'SUPER_ADMIN') patch.role = 'SUPER_ADMIN';
  if (existing?.loginAllowed !== true) patch.loginAllowed = true;
  if (existing?.accountStatus !== 'ACTIVE') patch.accountStatus = 'ACTIVE';
  if (normalizedEmail && existing?.normalizedEmail !== normalizedEmail) patch.normalizedEmail = normalizedEmail;
  return Object.keys(patch).length ? patch : null;
}

export { DEFAULT_BOOTSTRAP_ADMIN_NAME };
