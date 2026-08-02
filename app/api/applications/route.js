import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody } from '@/lib/auth/identity';

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
            user: { select: { name: true, email: true } },
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

    const job = await prisma.jobPosting.findUnique({ where: { id: jobPostingId }, select: { id: true, status: true } });
    if (!job || job.status !== 'OPEN') {
      return NextResponse.json({ error: 'This vacancy is not open.' }, { status: 404 });
    }

    const application = await prisma.application.upsert({
      where: { jobPostingId_studentId: { jobPostingId, studentId: actor.student.id } },
      update: {},
      create: { jobPostingId, studentId: actor.student.id },
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

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: { stage },
    });

    return NextResponse.json({ application: { id: updated.id, stage: updated.stage } });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid stage update.' }, { status: 400 });
    }
    return routeError(error);
  }
}
