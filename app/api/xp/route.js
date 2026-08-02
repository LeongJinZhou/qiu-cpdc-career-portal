import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { toIdentityRouteError } from '@/lib/auth/identity';
import { sumStudentXp } from '@/lib/xp-ledger';
import { buildXpSummary } from '@/lib/xp-summary';

/**
 * The acting student's real XP total, derived by summing the XpEvent ledger,
 * plus the tier it resolves to. This is the single source of truth the
 * dashboard reads instead of the hardcoded DEFAULT_STUDENT.xp (Module 1).
 */
export async function GET(request) {
  try {
    const actor = await resolveActor(request);
    const [totalXp, ledger, loginEvents] = await Promise.all([
      sumStudentXp(actor.student.id),
      prisma.xpEvent.findMany({
        where: { studentId: actor.student.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          amount: true,
          source: true,
          note: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          actorUserId: actor.user.id,
          action: 'LOGIN_SUCCESS',
        },
        orderBy: { createdAt: 'desc' },
        take: 400,
        select: { createdAt: true },
      }),
    ]);

    return NextResponse.json(buildXpSummary({ totalXp, ledger, loginEvents }));
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
