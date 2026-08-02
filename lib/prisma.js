import { PrismaClient } from '@prisma/client';

// Next.js dev mode hot-reloads modules, which would otherwise open a new pool
// on every reload and exhaust Postgres connections. Reuse a global instance.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
