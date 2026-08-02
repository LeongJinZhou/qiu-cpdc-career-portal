// Server-side helpers for the append-only XP ledger (XpEvent).
//
// Totals are always derived by summing the ledger — never stored on Student —
// so the history stays auditable and idempotency is enforced by dedupeKey.

import { prisma } from './prisma.js';

/** Sum a student's XP straight from the ledger. Returns 0 when empty. */
export async function sumStudentXp(studentId, client = prisma) {
  const result = await client.xpEvent.aggregate({
    where: { studentId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

/**
 * Award XP exactly once for a given dedupeKey. A replayed request (double QR
 * scan, re-toggled milestone) hits the unique constraint and is a no-op rather
 * than inflating the total.
 *
 * @returns {Promise<{ awarded: boolean }>} awarded=false when the key already existed.
 */
export async function awardXpOnce(
  { studentId, amount, source, note = null, dedupeKey },
  client = prisma,
) {
  const { count } = await client.xpEvent.createMany({
    data: [{ studentId, amount, source, note, dedupeKey }],
    skipDuplicates: true,
  });
  return { awarded: count > 0 };
}
