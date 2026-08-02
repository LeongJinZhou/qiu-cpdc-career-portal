import { PrismaClient } from '@prisma/client';

import { createAuditEntry } from '../lib/audit/index.js';
import { normalizeBootstrapAdminInput } from '../lib/admin/bootstrap.js';

const prisma = new PrismaClient();

async function bootstrapSuperAdmin() {
  const input = normalizeBootstrapAdminInput({
    email: process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL,
    name: process.env.BOOTSTRAP_SUPER_ADMIN_NAME,
  });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({
      where: {
        OR: [
          { normalizedEmail: input.normalizedEmail },
          { email: input.email },
        ],
      },
    });

    const before = existing
      ? {
        email: existing.email,
        role: existing.role,
        loginAllowed: existing.loginAllowed,
        accountStatus: existing.accountStatus,
      }
      : null;

    const user = existing
      ? await tx.user.update({
        where: { id: existing.id },
        data: {
          normalizedEmail: input.normalizedEmail,
          name: input.name,
          role: 'SUPER_ADMIN',
          loginAllowed: true,
          accountStatus: 'ACTIVE',
          identitySource: 'MANUAL',
        },
      })
      : await tx.user.create({
        data: {
          email: input.email,
          normalizedEmail: input.normalizedEmail,
          name: input.name,
          role: 'SUPER_ADMIN',
          loginAllowed: true,
          accountStatus: 'ACTIVE',
          identitySource: 'MANUAL',
        },
      });

    await createAuditEntry({
      tx,
      action: 'BOOTSTRAP_SUPER_ADMIN',
      resourceType: 'User',
      resourceId: user.id,
      before,
      after: {
        email: user.email,
        role: user.role,
        loginAllowed: user.loginAllowed,
        accountStatus: user.accountStatus,
      },
      metadata: {
        source: 'CLI',
        normalizedEmail: input.normalizedEmail,
      },
    });

    return { created: !existing, user };
  });
}

try {
  if (!process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim()) {
    throw new Error('Set BOOTSTRAP_SUPER_ADMIN_EMAIL for this one-time command.');
  }

  const result = await bootstrapSuperAdmin();
  console.log(`${result.created ? 'Created' : 'Updated'} SUPER_ADMIN ${result.user.email} (${result.user.id}).`);
  console.log('Remove BOOTSTRAP_SUPER_ADMIN_EMAIL from the environment after this run.');
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
