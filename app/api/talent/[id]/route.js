import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { effectiveAvatarUrl } from '@/lib/auth/identity';

/**
 * Full public showcase page for one approved, opted-in FYP project. This is a
 * detail projection, not a student-directory endpoint: private contact data,
 * academic records and employer-only workflow data stay out of the response.
 */
export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const project = await prisma.fYPProject.findFirst({
      where: {
        id,
        status: 'APPROVED',
        publicOptIn: true,
        student: { searchable: true },
      },
      include: {
        student: {
          include: {
            user: { select: { name: true, avatarUrl: true, googleAvatarUrl: true, avatarSource: true } },
            faculty: { select: { id: true, name: true, code: true } },
            programme: { select: { name: true } },
            badges: { select: { title: true, category: true, icon: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'That showcase is not public or no longer available.', code: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        abstract: project.abstract,
        supervisorName: project.supervisorName,
        repositoryUrl: project.repositoryUrl,
        liveUrl: project.liveUrl,
        reviewedAt: project.reviewedAt,
        student: {
          name: project.student.user.name,
          avatarUrl: effectiveAvatarUrl(project.student.user),
          faculty: project.student.faculty,
          programme: project.student.programme?.name ?? null,
          courseCode: project.student.courseCode ?? null,
          verifiedSkills: project.student.skillTags ?? [],
          badges: project.student.badges ?? [],
        },
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not load this public showcase.', code: 'TALENT_DETAIL_ERROR' }, { status: 500 });
  }
}
