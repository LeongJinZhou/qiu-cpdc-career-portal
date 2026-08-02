import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody, getRequestId } from '@/lib/auth/identity';
import { createAuditEntry } from '@/lib/audit';
import { createNotification, createNotifications, userIdsForRoles } from '@/lib/notifications';

const STAFF_ROLES = new Set(['CPDC_ADMIN', 'SUPER_ADMIN']);
const schema = z.object({
  title: z.string().trim().min(1, 'Session title is required.').max(160),
  preferredDate: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().min(1, 'Tell CPDC what students will learn.').max(5000),
});
const decisionSchema = z.object({
  status: z.enum(['APPROVED', 'RETURNED', 'DECLINED']),
  reviewNote: z.string().trim().max(2000).optional().nullable(),
});

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

function serialize(request) {
  return {
    id: request.id,
    title: request.title,
    preferredDate: request.preferredDate,
    description: request.description,
    status: request.status,
    reviewNote: request.reviewNote,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    requester: request.requester
      ? { id: request.requester.id, name: request.requester.name, email: request.requester.email }
      : null,
  };
}

const includeRequester = { requester: { select: { id: true, name: true, email: true } } };

export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!STAFF_ROLES.has(actor.role) && actor.role !== 'EMPLOYER') {
      return NextResponse.json({ error: 'Your role cannot view workshop requests.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const where = STAFF_ROLES.has(actor.role) ? {} : { requesterUserId: actor.user.id };
    const requests = await prisma.workshopRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: includeRequester,
    });
    return NextResponse.json({ requests: requests.map(serialize), source: 'database' });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (actor.role !== 'EMPLOYER') {
      return NextResponse.json({ error: 'Only verified employers can submit a host request.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const body = schema.parse(await parseJsonBody(request));
    const saved = await prisma.$transaction(async (tx) => {
      const created = await tx.workshopRequest.create({
        data: {
          title: body.title,
          preferredDate: body.preferredDate || null,
          description: body.description,
          requesterUserId: actor.user.id,
        },
        include: includeRequester,
      });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'WORKSHOP_REQUEST_CREATED',
        resourceType: 'WorkshopRequest',
        resourceId: created.id,
        after: { title: created.title, preferredDate: created.preferredDate, status: created.status },
        requestId: getRequestId(request),
      });
      await createNotifications(tx, {
        recipientUserIds: (await userIdsForRoles(tx)).filter((userId) => userId !== actor.user.id),
        actorUserId: actor.user.id,
        type: 'WORKSHOP_HOST_REQUEST_RECEIVED',
        title: 'Workshop host request received',
        body: `${actor.user.name} proposed “${created.title}”. Review the event brief and preferred date before scheduling it.`,
        href: '/workshops',
        resourceType: 'WorkshopRequest',
        resourceId: created.id,
        dedupeKey: `workshop.request.created:${created.id}`,
      });
      return created;
    });
    return NextResponse.json({ request: serialize(saved), delivery: { status: 'RECORDED', provider: 'standalone-outbox' } }, { status: 201 });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid workshop request.' }, { status: 400 });
    }
    return routeError(error);
  }
}

export async function PATCH(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!STAFF_ROLES.has(actor.role)) {
      return NextResponse.json({ error: 'Only CPDC or Super Admin can review host requests.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const body = await parseJsonBody(request);
    const requestId = String(body?.requestId ?? '').trim();
    if (!requestId) return NextResponse.json({ error: 'requestId is required.' }, { status: 400 });
    const decision = decisionSchema.parse(body);
    const existing = await prisma.workshopRequest.findUnique({ where: { id: requestId }, include: includeRequester });
    if (!existing) return NextResponse.json({ error: 'Workshop request not found.', code: 'NOT_FOUND' }, { status: 404 });
    const saved = await prisma.$transaction(async (tx) => {
      const updated = await tx.workshopRequest.update({
        where: { id: requestId },
        data: { status: decision.status, reviewNote: decision.reviewNote || null },
        include: includeRequester,
      });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'WORKSHOP_REQUEST_REVIEWED',
        resourceType: 'WorkshopRequest',
        resourceId: requestId,
        before: { status: existing.status, reviewNote: existing.reviewNote },
        after: { status: updated.status, reviewNote: updated.reviewNote },
        requestId: getRequestId(request),
      });
      await createNotification(tx, {
        recipientUserId: updated.requesterUserId,
        actorUserId: actor.user.id,
        type: 'WORKSHOP_HOST_REQUEST_REVIEWED',
        title: `Workshop request ${updated.status.toLowerCase()}`,
        body: `Your proposal “${updated.title}” was ${updated.status.toLowerCase()} by ${actor.user.name}.${updated.reviewNote ? ` Note: ${updated.reviewNote}` : ''}`,
        href: '/workshops',
        resourceType: 'WorkshopRequest',
        resourceId: requestId,
        dedupeKey: `workshop.request.reviewed:${requestId}:${updated.status}:${updated.updatedAt.toISOString()}`,
      });
      return updated;
    });
    return NextResponse.json({ request: serialize(saved) });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid workshop decision.' }, { status: 400 });
    }
    return routeError(error);
  }
}
