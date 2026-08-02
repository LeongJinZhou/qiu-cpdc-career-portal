import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { resolveActor, actorCanReview, actorCanPublishWorkshops } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody, getRequestId } from '@/lib/auth/identity';
import { createAuditEntry } from '@/lib/audit';
import { parseWorkshopStart, seatsLeft } from '@/lib/workshop-policy';

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

function hasGlobalPublishAuthority(actor) {
  return (
    (actor.role === 'CPDC_ADMIN' || actor.role === 'SUPER_ADMIN')
    && (actor.demo
      || actor.user.role === actor.role
      || (actor.identity?.assignments ?? []).some((assignment) => (
        assignment.role === actor.role
        && assignment.scopeType === 'GLOBAL'
        && assignment.scopeValue === 'GLOBAL'
      )))
  );
}

async function allowedPublisherFaculties(actor) {
  if (hasGlobalPublishAuthority(actor)) return null;

  const assignments = actor.identity?.assignments ?? [];
  if (actor.role === 'FACULTY_COORDINATOR') {
    const assigned = assignments
      .filter((assignment) => assignment.role === actor.role && assignment.scopeType === 'FACULTY')
      .map((assignment) => assignment.scopeValue)
      .filter(Boolean);
    if (assigned.length) return new Set(assigned);
  }

  if (actor.role === 'HEAD_OF_PROGRAMME') {
    const programmeIds = assignments
      .filter((assignment) => assignment.role === actor.role && assignment.scopeType === 'PROGRAMME')
      .map((assignment) => assignment.scopeValue)
      .filter(Boolean);
    if (programmeIds.length) {
      const programmes = await prisma.programme.findMany({
        where: { id: { in: programmeIds } },
        select: { facultyId: true },
      });
      return new Set(programmes.map((programme) => programme.facultyId));
    }
  }

  if (actor.demo && actor.student?.facultyId) return new Set([actor.student.facultyId]);
  return new Set();
}

const publishSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(160),
  speaker: z.string().trim().max(160).optional().default('TBC'),
  speakerBio: z.string().trim().max(4000).optional().nullable(),
  hostOrganization: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().default(''),
  location: z.string().trim().max(200).optional().default('TBC'),
  startsAt: z.string().trim().min(1, 'startsAt is required'),
  endsAt: z.string().trim().optional().nullable(),
  virtualLink: z.union([z.string().trim().url(), z.literal(''), z.null()]).optional(),
  roomDetails: z.string().trim().max(2000).optional().nullable(),
  prerequisites: z.string().trim().max(2000).optional().nullable(),
  agenda: z.array(z.object({
    time: z.string().trim().max(80),
    title: z.string().trim().max(200),
    description: z.string().trim().max(1000).optional().default(''),
  })).max(30).optional().default([]),
  learningOutcomes: z.array(z.string().trim().max(500)).max(20).optional().default([]),
  registrationDeadline: z.string().trim().optional().nullable(),
  xpValue: z.coerce.number().int().min(0).max(1000).optional().default(150),
  facultyId: z.string().trim().optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(20).optional().default([]),
  capacity: z.coerce.number().int().positive().max(100000).optional().nullable(),
  // Data-URL cover image; bounded so a huge upload can't wedge the request.
  coverImage: z
    .string()
    .max(3_500_000, 'Cover image is too large (max ~2.5MB).')
    .optional()
    .nullable(),
});

/**
 * List published workshops from the database, annotated with the acting
 * student's RSVP and attendance state so the feed can render "Registered" and
 * "Attended (+150 XP)" without a second round-trip.
 */
export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const studentId = actor.student?.id ?? null;

    const workshops = await prisma.workshop.findMany({
      orderBy: { startsAt: 'asc' },
      include: {
        _count: { select: { rsvps: true, attendances: true } },
        rsvps: studentId ? { where: { studentId }, select: { id: true } } : false,
        attendances: studentId ? { where: { studentId }, select: { id: true } } : false,
      },
    });

    return NextResponse.json({
      workshops: workshops.map((w) => ({
        id: w.id,
        title: w.title,
        speaker: w.speaker,
        description: w.description,
        location: w.location,
        startsAt: w.startsAt,
        xpValue: w.xpValue,
        coverImage: w.coverImage,
        category: w.category,
        tags: w.tags,
        facultyId: w.facultyId,
        capacity: w.capacity,
        rsvpCount: w._count.rsvps,
        attendanceCount: w._count.attendances,
        seatsLeft: seatsLeft(w.capacity, w._count.rsvps),
        endsAt: w.endsAt,
        speakerBio: w.speakerBio,
        hostOrganization: w.hostOrganization,
        virtualLink: w.virtualLink,
        roomDetails: w.roomDetails,
        prerequisites: w.prerequisites,
        agenda: Array.isArray(w.agenda) ? w.agenda : [],
        learningOutcomes: w.learningOutcomes ?? [],
        registrationDeadline: w.registrationDeadline,
        // Never put the QR credential in the workshop catalogue response. A
        // separate authenticated print endpoint can be added when the staff
        // kiosk is connected; catalogue reads must remain safe to cache.
        qrCodeAvailable: actorCanReview(actor.role),
        rsvped: Array.isArray(w.rsvps) ? w.rsvps.length > 0 : false,
        attended: Array.isArray(w.attendances) ? w.attendances.length > 0 : false,
      })),
    });
  } catch (error) {
    return routeError(error);
  }
}

/** Publish a workshop to the database (CPDC staff / coordinators). */
export async function POST(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!actorCanPublishWorkshops(actor.role)) {
      return NextResponse.json(
        { error: 'Your role cannot publish workshops.', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    const body = await parseJsonBody(request);
    const data = publishSchema.parse(body);

    const startsAt = parseWorkshopStart(data.startsAt);
    const endsAt = data.endsAt ? parseWorkshopStart(data.endsAt) : null;
    const registrationDeadline = data.registrationDeadline ? parseWorkshopStart(data.registrationDeadline) : null;
    if (endsAt && endsAt <= startsAt) {
      return NextResponse.json({ error: 'endsAt must be after startsAt.', code: 'INVALID_WORKSHOP_TIME' }, { status: 400 });
    }
    if (registrationDeadline && registrationDeadline > startsAt) {
      return NextResponse.json({ error: 'registrationDeadline must be before startsAt.', code: 'INVALID_REGISTRATION_DEADLINE' }, { status: 400 });
    }
    const requestedFacultyId = data.facultyId?.trim() || null;
    if (requestedFacultyId && !(await prisma.faculty.count({ where: { id: requestedFacultyId } }))) {
      return NextResponse.json({ error: 'facultyId does not reference a known faculty.', code: 'INVALID_FACULTY' }, { status: 400 });
    }

    const allowedFaculties = await allowedPublisherFaculties(actor);
    let facultyId = requestedFacultyId;
    if (allowedFaculties) {
      if (!facultyId && allowedFaculties.size === 1) facultyId = [...allowedFaculties][0];
      if (!facultyId || !allowedFaculties.has(facultyId)) {
        return NextResponse.json({ error: 'You can only publish workshops inside your assigned faculty scope.', code: 'WORKSHOP_SCOPE_FORBIDDEN' }, { status: 403 });
      }
    }

    const workshop = await prisma.$transaction(async (tx) => {
      const created = await tx.workshop.create({
        data: {
          title: data.title,
          speaker: data.speaker || 'TBC',
          speakerBio: data.speakerBio ?? null,
          hostOrganization: data.hostOrganization ?? null,
          description: data.description ?? '',
          location: data.location || 'TBC',
          startsAt,
          endsAt,
          virtualLink: data.virtualLink || null,
          roomDetails: data.roomDetails ?? null,
          prerequisites: data.prerequisites ?? null,
          agenda: data.agenda ?? [],
          learningOutcomes: data.learningOutcomes ?? [],
          registrationDeadline,
          xpValue: data.xpValue ?? 150,
          coverImage: data.coverImage ?? null,
          category: data.category ?? null,
          tags: data.tags ?? [],
          capacity: data.capacity ?? null,
          facultyId,
          qrSecret: crypto.randomBytes(16).toString('hex'),
        },
      });

      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'WORKSHOP_PUBLISHED',
        resourceType: 'Workshop',
        resourceId: created.id,
        after: {
          title: created.title,
          startsAt: created.startsAt.toISOString(),
          facultyId: created.facultyId,
          capacity: created.capacity,
          xpValue: created.xpValue,
          hostOrganization: created.hostOrganization,
        },
        requestId: getRequestId(request),
      });

      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ workshop: { id: workshop.id, qrSecret: workshop.qrSecret } }, { status: 201 });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid workshop.' },
        { status: 400 },
      );
    }
    return routeError(error);
  }
}
