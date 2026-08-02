import { prisma } from './prisma.js';

/**
 * Notification plumbing shared by domain routes.
 *
 * A notification is written in the same transaction as the action that caused
 * it. That means an RSVP cannot say "confirmed" while silently losing the
 * corresponding alert. The email provider is deliberately not called here:
 * the outbox record is the integration seam for Firebase Functions later.
 */

export const NOTIFICATION_STAFF_ROLES = Object.freeze([
  'CPDC_ADMIN',
  'SUPER_ADMIN',
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'PLACEMENT_OFFICER',
  'CAREER_COUNSELOR',
  'UNIVERSITY_REGISTRAR',
]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function userIdsForRoles(tx, roles = NOTIFICATION_STAFF_ROLES) {
  const users = await tx.user.findMany({
    where: {
      OR: [
        { role: { in: roles } },
        { roleAssignments: { some: { role: { in: roles } } } },
      ],
      accountStatus: { in: ['ACTIVE', 'INVITED'] },
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

export async function createNotification(tx, {
  recipientUserId,
  actorUserId = null,
  type,
  title,
  body,
  href = null,
  resourceType = null,
  resourceId = null,
  dedupeKey,
  emailStatus = 'QUEUED',
}) {
  if (!recipientUserId || !type || !title || !body || !dedupeKey) return null;

  const notification = await tx.notification.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      recipientUserId,
      actorUserId,
      type,
      title,
      body,
      href,
      resourceType,
      resourceId,
      emailStatus,
      dedupeKey,
    },
  });

  await tx.outboxEvent.upsert({
    where: { dedupeKey: `notification.email:${dedupeKey}` },
    update: {},
    create: {
      topic: 'notification.email.requested',
      aggregateType: 'Notification',
      aggregateId: notification.id,
      payload: {
        notificationId: notification.id,
        recipientUserId,
        type,
        title,
        body,
        href,
      },
      dedupeKey: `notification.email:${dedupeKey}`,
    },
  });

  return notification;
}

export async function createNotifications(tx, {
  recipientUserIds,
  ...notification
}) {
  const ids = unique(recipientUserIds ?? []);
  return Promise.all(ids.map((recipientUserId) => createNotification(tx, {
    ...notification,
    recipientUserId,
    dedupeKey: `${notification.dedupeKey}:${recipientUserId}`,
  })));
}

/** Convenience for routes that already have a transaction boundary elsewhere. */
export async function createStandaloneNotification(input) {
  return prisma.$transaction((tx) => createNotification(tx, input));
}

