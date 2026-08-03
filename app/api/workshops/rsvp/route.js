import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody, getRequestId } from '@/lib/auth/identity';
import { createAuditEntry } from '@/lib/audit';
import { isRegistrationOpen, seatsLeft } from '@/lib/workshop-policy';
import { createNotification, createNotifications, userIdsForWorkshopStaff } from '@/lib/notifications';

const rsvpSchema = z.object({
  workshopId: z.string().trim().min(1, 'workshopId is required'),
  going: z.boolean(),
});

/**
 * Reserve or release a seat for the acting student (Module 5). Capacity is
 * enforced inside a transaction so concurrent RSVPs can't oversubscribe a
 * capped workshop.
 */
export async function POST(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const body = await parseJsonBody(request);
    const { workshopId, going } = rsvpSchema.parse(body);
    const studentId = actor.student.id;

    const outcome = await prisma.$transaction(async (tx) => {
      const workshop = await tx.workshop.findUnique({
        where: { id: workshopId },
        select: { id: true, title: true, startsAt: true, registrationDeadline: true, capacity: true, facultyId: true },
      });
      if (!workshop) {
        return { error: { status: 404, message: 'Workshop not found.' } };
      }

      if (!going) {
        await tx.workshopRsvp.deleteMany({ where: { workshopId, studentId } });
      } else {
        if (!isRegistrationOpen({ registrationDeadline: workshop.registrationDeadline, startsAt: workshop.startsAt })) {
          return { error: { status: 409, message: 'Registration for this workshop is closed.' } };
        }
        const already = await tx.workshopRsvp.findUnique({
          where: { workshopId_studentId: { workshopId, studentId } },
          select: { id: true },
        });
        if (!already) {
          if (workshop.capacity != null) {
            const taken = await tx.workshopRsvp.count({ where: { workshopId } });
            if (taken >= workshop.capacity) {
              return { error: { status: 409, message: 'This workshop is full.' } };
            }
          }
          await tx.workshopRsvp.create({ data: { workshopId, studentId } });
        }
      }

      const rsvpCount = await tx.workshopRsvp.count({ where: { workshopId } });
      const remaining = seatsLeft(workshop.capacity, rsvpCount);

      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: going ? 'WORKSHOP_RSVP_CREATED' : 'WORKSHOP_RSVP_CANCELLED',
        resourceType: 'Workshop',
        resourceId: workshopId,
        after: { workshopId, studentId, rsvped: going, rsvpCount },
        requestId: getRequestId(request),
      });

      const staffRecipients = (await userIdsForWorkshopStaff(tx, {
        facultyId: workshop.facultyId,
        programmeId: actor.student.programmeId,
        studentId,
      })).filter((userId) => userId !== actor.user.id);
      const dateLabel = workshop.startsAt.toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kuala_Lumpur',
      });
      const actionLabel = going ? 'registered for' : 'cancelled their registration for';

      await createNotification(tx, {
        recipientUserId: actor.user.id,
        actorUserId: actor.user.id,
        type: going ? 'WORKSHOP_REGISTRATION_CONFIRMED' : 'WORKSHOP_REGISTRATION_CANCELLED',
        title: going ? 'Workshop registration confirmed' : 'Workshop registration cancelled',
        body: going
          ? `Your place for “${workshop.title}” is reserved for ${dateLabel}. Check in on the day to record attendance.`
          : `Your registration for “${workshop.title}” on ${dateLabel} has been cancelled.`,
        href: '/workshops',
        resourceType: 'Workshop',
        resourceId: workshopId,
        dedupeKey: `workshop.rsvp.student:${workshopId}:${studentId}:${going ? 'confirmed' : 'cancelled'}`,
      });

      if (staffRecipients.length) {
        await createNotifications(tx, {
          recipientUserIds: staffRecipients,
          actorUserId: actor.user.id,
          type: going ? 'WORKSHOP_REGISTRATION_RECEIVED' : 'WORKSHOP_REGISTRATION_CANCELLED',
          title: going ? 'New workshop registration' : 'Workshop registration cancelled',
          body: `${actor.user.name} ${actionLabel} “${workshop.title}” (${dateLabel}). ${rsvpCount} place${rsvpCount === 1 ? '' : 's'} currently reserved.`,
          href: '/workshops',
          resourceType: 'Workshop',
          resourceId: workshopId,
          dedupeKey: `workshop.rsvp.staff:${workshopId}:${studentId}:${going ? 'confirmed' : 'cancelled'}`,
        });
      }

      return { rsvped: going, rsvpCount, seatsLeft: remaining };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (outcome.error) {
      return NextResponse.json(
        { error: outcome.error.message },
        { status: outcome.error.status },
      );
    }

    return NextResponse.json(outcome);
  } catch (error) {
    if (error?.code === 'P2034') {
      return NextResponse.json(
        { error: 'The workshop changed while you were reserving a seat. Please try again.', code: 'RSVP_RETRY' },
        { status: 409 },
      );
    }
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid RSVP.' },
        { status: 400 },
      );
    }
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}
