import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { getRequestId, toIdentityRouteError, parseJsonBody } from '@/lib/auth/identity';
import { createNotification } from '@/lib/notifications';
import { createAuditEntry } from '@/lib/audit';

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

function canManage(role) {
  return role === 'EMPLOYER' || role === 'CPDC_ADMIN' || role === 'SUPER_ADMIN';
}

function canManageJob(actor, job) {
  if (actor.role === 'CPDC_ADMIN' || actor.role === 'SUPER_ADMIN') return true;
  return actor.role === 'EMPLOYER' && job?.company?.ownerUserId === actor.user.id;
}

const STAGES = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'REJECTED'];

const applySchema = z.object({ jobPostingId: z.string().trim().min(1) });
const stageSchema = z.object({
  applicationId: z.string().trim().min(1),
  stage: z.enum(STAGES),
});

/**
 * Applicants for a job (employer view, ?jobPostingId=) — the ATS pipeline
 * (Module 11). Students never call this; they see only their own stage via the
 * jobs list.
 */
export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!canManage(actor.role)) {
      return NextResponse.json({ error: 'Employers only.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const jobPostingId = new URL(request.url).searchParams.get('jobPostingId');
    if (!jobPostingId) {
      return NextResponse.json({ error: 'jobPostingId is required' }, { status: 400 });
    }

    const job = await prisma.jobPosting.findUnique({
      where: { id: jobPostingId },
      include: { company: { select: { ownerUserId: true } } },
    });
    if (!job) return NextResponse.json({ error: 'Job not found.', code: 'JOB_NOT_FOUND' }, { status: 404 });
    if (!canManageJob(actor, job)) {
      return NextResponse.json({ error: 'You cannot view another company\'s applicants.', code: 'JOB_SCOPE_FORBIDDEN' }, { status: 403 });
    }

    const applications = await prisma.application.findMany({
      where: { jobPostingId },
      orderBy: { createdAt: 'asc' },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true, avatarUrl: true, googleAvatarUrl: true, avatarSource: true } },
            programme: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      applications: applications.map((a) => ({
        id: a.id,
        stage: a.stage,
        studentName: a.student.user.name,
        studentEmail: a.student.user.email,
        studentAvatar: a.student.user.avatarSource === 'CUSTOM'
          ? a.student.user.avatarUrl
          : (a.student.user.googleAvatarUrl ?? a.student.user.avatarUrl ?? null),
        programme: a.student.programme?.name ?? null,
        skills: a.student.skillTags ?? [],
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    return routeError(error);
  }
}

/** Student applies to a job (idempotent per job+student). */
export async function POST(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const body = await parseJsonBody(request);
    const { jobPostingId } = applySchema.parse(body);

    const job = await prisma.jobPosting.findUnique({
      where: { id: jobPostingId },
      select: { id: true, title: true, status: true, company: { select: { name: true, ownerUserId: true } } },
    });
    if (!job || job.status !== 'OPEN') {
      return NextResponse.json({ error: 'This vacancy is not open.' }, { status: 404 });
    }

    const application = await prisma.$transaction(async (tx) => {
      const saved = await tx.application.upsert({
        where: { jobPostingId_studentId: { jobPostingId, studentId: actor.student.id } },
        update: {},
        create: { jobPostingId, studentId: actor.student.id },
      });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'JOB_APPLICATION_CREATED',
        resourceType: 'Application',
        resourceId: saved.id,
        after: { jobPostingId, studentId: actor.student.id, stage: saved.stage },
        requestId: getRequestId(request),
      });
      await createNotification(tx, {
        recipientUserId: actor.user.id,
        actorUserId: actor.user.id,
        type: 'JOB_APPLICATION_RECEIVED',
        title: 'Application submitted',
        body: `Your application for “${job.title}” at ${job.company.name} is recorded.`,
        href: '/employers',
        resourceType: 'Application',
        resourceId: saved.id,
        dedupeKey: `job.application.student:${saved.id}`,
      });
      if (job.company.ownerUserId && job.company.ownerUserId !== actor.user.id) {
        await createNotification(tx, {
          recipientUserId: job.company.ownerUserId,
          actorUserId: actor.user.id,
          type: 'JOB_APPLICATION_RECEIVED',
          title: 'New job application',
          body: `${actor.user.name} applied for “${job.title}”. Open the employer workspace to review the candidate.`,
          href: '/employers',
          resourceType: 'Application',
          resourceId: saved.id,
          dedupeKey: `job.application.employer:${saved.id}`,
        });
      }
      return saved;
    });

    return NextResponse.json({ application: { id: application.id, stage: application.stage } }, { status: 201 });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid application.' }, { status: 400 });
    }
    return routeError(error);
  }
}

/** Employer advances an application through the ATS stages. */
export async function PATCH(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!canManage(actor.role)) {
      return NextResponse.json({ error: 'Employers only.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const body = await parseJsonBody(request);
    const { applicationId, stage } = stageSchema.parse(body);

    const existing = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { jobPosting: { include: { company: { select: { ownerUserId: true } } } } },
    });
    if (!existing) return NextResponse.json({ error: 'Application not found.', code: 'APPLICATION_NOT_FOUND' }, { status: 404 });
    if (!canManageJob(actor, existing.jobPosting)) {
      return NextResponse.json({ error: 'You cannot change another company\'s application.', code: 'JOB_SCOPE_FORBIDDEN' }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.application.update({
        where: { id: applicationId },
        data: { stage },
      });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'JOB_APPLICATION_STAGE_UPDATED',
        resourceType: 'Application',
        resourceId: applicationId,
        before: { stage: existing.stage },
        after: { stage: saved.stage },
        requestId: getRequestId(request),
      });
      await createNotification(tx, {
        recipientUserId: existing.student.userId,
        actorUserId: actor.user.id,
        type: 'JOB_APPLICATION_STAGE_UPDATED',
        title: 'Application status updated',
        body: `Your application for “${existing.jobPosting.title}” moved to ${stage.toLowerCase().replaceAll('_', ' ')}.`,
        href: '/employers',
        resourceType: 'Application',
        resourceId: applicationId,
        dedupeKey: `job.application.stage:${applicationId}:${stage}:${saved.updatedAt.toISOString()}`,
      });
      return saved;
    });

    return NextResponse.json({ application: { id: updated.id, stage: updated.stage } });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid stage update.' }, { status: 400 });
    }
    return routeError(error);
  }
}
