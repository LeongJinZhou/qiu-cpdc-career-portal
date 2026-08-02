import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { parseJsonBody, toIdentityRouteError } from '@/lib/auth/identity';

const updateSchema = z.object({
  notificationId: z.string().trim().min(1).optional(),
  markAllRead: z.boolean().optional(),
}).refine((value) => value.notificationId || value.markAllRead, {
  message: 'Choose a notification or mark all notifications as read.',
});

function safeNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    resourceType: notification.resourceType,
    resourceId: notification.resourceId,
    readAt: notification.readAt,
    emailStatus: notification.emailStatus,
    createdAt: notification.createdAt,
    actor: notification.actor
      ? { name: notification.actor.name, avatarUrl: notification.actor.avatarUrl ?? null }
      : null,
  };
}

export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unread') === '1';
    const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '25', 10) || 25));
    const where = {
      recipientUserId: actor.user.id,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { actor: { select: { name: true, avatarUrl: true } } },
      }),
      prisma.notification.count({ where: { recipientUserId: actor.user.id, readAt: null } }),
    ]);

    return NextResponse.json({
      notifications: notifications.map(safeNotification),
      unreadCount,
    });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
  }
}

export async function PATCH(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const body = updateSchema.parse(await parseJsonBody(request));
    const where = { recipientUserId: actor.user.id, readAt: null };

    if (body.markAllRead) {
      const result = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
      return NextResponse.json({ updated: result.count });
    }

    const result = await prisma.notification.updateMany({
      where: { ...where, id: body.notificationId },
      data: { readAt: new Date() },
    });
    if (!result.count) {
      return NextResponse.json({ error: 'Notification not found or already read.', code: 'NOTIFICATION_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid notification update.' }, { status: 400 });
    }
    const routeError = toIdentityRouteError(error);
    return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
  }
}

