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

export { DEFAULT_BOOTSTRAP_ADMIN_NAME };
