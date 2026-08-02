import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';

/**
 * Return the university XP leaderboard for the signed-in student. The score is
 * derived from the append-only ledger; no fixture names or ranks are returned.
 */
export async function GET(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const students = await prisma.student.findMany({
      select: {
        id: true,
        facultyId: true,
        academicYear: true,
        user: { select: { name: true, avatarUrl: true } },
        faculty: { select: { code: true } },
        xpEvents: { select: { amount: true } },
      },
    });

    const ranked = students
      .map((student) => ({
        id: student.id,
        name: student.user.name,
        avatarUrl: student.user.avatarUrl,
        facultyId: student.facultyId,
        facultyCode: student.faculty.code,
        year: student.academicYear,
        xp: student.xpEvents.reduce((total, event) => total + Number(event.amount || 0), 0),
      }))
      .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
      .map((student, index) => ({ ...student, rank: index + 1 }));

    const top = ranked.slice(0, 5);
    const self = ranked.find((student) => student.id === actor.student.id);
    if (self && !top.some((student) => student.id === self.id)) top.push({ ...self, isSelf: true });
    return NextResponse.json({
      scope: 'UNIVERSITY',
      entries: top.map((student) => ({ ...student, isSelf: student.id === actor.student.id })),
      selfRank: self?.rank ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Leaderboard unavailable.', code: error.code || 'LEADERBOARD_UNAVAILABLE' }, { status: error.status || 500 });
  }
}
