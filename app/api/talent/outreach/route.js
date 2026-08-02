import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { getRequestId, parseJsonBody, toIdentityRouteError } from '@/lib/auth/identity';
import { createAuditEntry } from '@/lib/audit';

const OUTREACH_ROLES = new Set(['EMPLOYER', 'ALUMNI', 'CPDC_ADMIN', 'SUPER_ADMIN']);
const schema = z.object({
  projectId: z.string().trim().min(1),
  kind: z.enum(['INTERVIEW', 'COFFEE']),
  message: z.string().trim().max(2000).optional().nullable(),
});

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

function serialize(outreach) {
  return {
    id: outreach.id,
    kind: outreach.kind,
    message: outreach.message,
    status: outreach.status,
    createdAt: outreach.createdAt,
    projectId: outreach.projectId,
    targetStudent: outreach.targetStudent
      ? { name: outreach.targetStudent.user?.name ?? 'Student', matricNo: outreach.targetStudent.matricNo }
      : null,
  };
}

const includeTarget = {
  targetStudent: { select: { matricNo: true, user: { select: { name: true } } } },
};

export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!OUTREACH_ROLES.has(actor.role)) {
      return NextResponse.json({ error: 'Your role cannot access talent outreach.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const where = actor.role === 'CPDC_ADMIN' || actor.role === 'SUPER_ADMIN'
      ? {}
      : {
        OR: [
          { senderUserId: actor.user.id },
          ...(actor.student ? [{ targetStudentId: actor.student.id }] : []),
        ],
      };
    const rows = await prisma.talentOutreach.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100, include: includeTarget });
    return NextResponse.json({ outreach: rows.map(serialize), source: 'database' });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!OUTREACH_ROLES.has(actor.role)) {
      return NextResponse.json({ error: 'Your role cannot contact talent.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const body = schema.parse(await parseJsonBody(request));
    const project = await prisma.fYPProject.findUnique({
      where: { id: body.projectId },
      select: {
        id: true,
        title: true,
        status: true,
        publicOptIn: true,
        studentId: true,
        student: { select: { matricNo: true, user: { select: { name: true } } } },
      },
    });
    if (!project || project.status !== 'APPROVED' || !project.publicOptIn) {
      return NextResponse.json({ error: 'That project is no longer available for outreach.', code: 'TALENT_NOT_AVAILABLE' }, { status: 404 });
    }

    const outreach = await prisma.$transaction(async (tx) => {
      const saved = await tx.talentOutreach.create({
        data: {
          kind: body.kind,
          message: body.message ?? null,
          senderUserId: actor.user.id,
          targetStudentId: project.studentId,
          projectId: project.id,
        },
        include: includeTarget,
      });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'TALENT_OUTREACH_CREATED',
        resourceType: 'TalentOutreach',
        resourceId: saved.id,
        after: { kind: saved.kind, projectId: project.id, targetStudentId: project.studentId, status: saved.status },
        requestId: getRequestId(request),
      });
      return saved;
    });

    return NextResponse.json({ outreach: serialize(outreach), delivery: { status: 'RECORDED', provider: 'standalone-outbox' } }, { status: 201 });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid outreach request.' }, { status: 400 });
    }
    return routeError(error);
  }
}
