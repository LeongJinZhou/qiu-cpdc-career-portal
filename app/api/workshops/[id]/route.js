import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { seatsLeft } from '@/lib/workshop-policy';
import { toIdentityRouteError } from '@/lib/auth/identity';

export async function GET(request, { params }) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const { id } = await params;
    const studentId = actor.student?.id ?? null;
    const workshop = await prisma.workshop.findUnique({
      where: { id },
      include: {
        _count: { select: { rsvps: true, attendances: true } },
        rsvps: studentId ? { where: { studentId }, select: { id: true } } : false,
        attendances: studentId ? { where: { studentId }, select: { id: true } } : false,
      },
    });
    if (!workshop) return NextResponse.json({ error: 'Workshop not found.', code: 'WORKSHOP_NOT_FOUND' }, { status: 404 });

    return NextResponse.json({ workshop: {
      id: workshop.id,
      title: workshop.title,
      speaker: workshop.speaker,
      speakerBio: workshop.speakerBio,
      hostOrganization: workshop.hostOrganization,
      description: workshop.description,
      location: workshop.location,
      startsAt: workshop.startsAt,
      endsAt: workshop.endsAt,
      xpValue: workshop.xpValue,
      virtualLink: workshop.virtualLink,
      roomDetails: workshop.roomDetails,
      prerequisites: workshop.prerequisites,
      agenda: Array.isArray(workshop.agenda) ? workshop.agenda : [],
      learningOutcomes: workshop.learningOutcomes ?? [],
      registrationDeadline: workshop.registrationDeadline,
      coverImage: workshop.coverImage,
      category: workshop.category,
      tags: workshop.tags,
      facultyId: workshop.facultyId,
      capacity: workshop.capacity,
      rsvpCount: workshop._count.rsvps,
      attendanceCount: workshop._count.attendances,
      seatsLeft: seatsLeft(workshop.capacity, workshop._count.rsvps),
      rsvped: Array.isArray(workshop.rsvps) && workshop.rsvps.length > 0,
      attended: Array.isArray(workshop.attendances) && workshop.attendances.length > 0,
    } });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
  }
}

