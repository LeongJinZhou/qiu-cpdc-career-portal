import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Public talent feed (Module 13): approved FYP projects whose owner opted in.
 *
 * Deliberately unauthenticated — it exposes only projects a Head of Programme
 * has APPROVED and the student explicitly opted into sharing (publicOptIn), so
 * there is nothing private to gate. Contact details are limited to the student's
 * name, programme and faculty; the email is included only for opted-in projects
 * so a registered employer can reach out.
 */
export async function GET() {
  try {
    const projects = await prisma.fYPProject.findMany({
      where: { status: 'APPROVED', publicOptIn: true, student: { searchable: true } },
      orderBy: { reviewedAt: 'desc' },
      include: {
        student: {
          include: {
            user: { select: { name: true, avatarUrl: true } },
            faculty: { select: { id: true, name: true } },
            programme: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        abstract: p.abstract,
        repositoryUrl: p.repositoryUrl,
        liveUrl: p.liveUrl,
        reviewedAt: p.reviewedAt,
        studentName: p.student.user.name,
        studentAvatar: p.student.user.avatarUrl,
        facultyId: p.student.faculty?.id ?? null,
        faculty: p.student.faculty?.name ?? null,
        programme: p.student.programme?.name ?? null,
        skills: p.student.skillTags ?? [],
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Could not load the talent feed.', code: 'TALENT_FEED_ERROR' },
      { status: 500 },
    );
  }
}
