import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createAuditEntry } from '@/lib/audit/index.js';
import { getRequestId, parseJsonBody, toIdentityRouteError } from '@/lib/auth/identity';
import { requireStudentActor, resolveActor } from '@/lib/auth/actor';

const optionalText = (max) => z.string().trim().max(max).nullable().optional();
const optionalUrl = z.union([z.string().trim().url(), z.literal(''), z.null()]).optional();
const resumeDataSchema = z.object({
  template: z.string().trim().max(40).optional(),
  manualEntries: z.array(z.object({
    id: z.string().trim().max(120),
    section: z.string().trim().max(40),
    title: z.string().trim().max(180),
    organisation: z.string().trim().max(180),
    period: z.string().trim().max(120),
    bullets: z.array(z.string().trim().max(1000)).max(12),
  })).max(40).optional(),
}).nullable().optional();

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: optionalText(50),
  bio: optionalText(2000),
  careerTargets: optionalText(500),
  industries: optionalText(500),
  portfolioUrl: optionalUrl,
  githubUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  resumeSummary: optionalText(3000),
  resumeData: resumeDataSchema,
  skills: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
});

function errorResponse(error) {
  const routeError = toIdentityRouteError(error);
  return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
}

function serialize(actor) {
  const student = actor.student;
  return {
    user: { id: actor.user.id, name: actor.user.name, email: actor.user.email, avatarUrl: actor.user.avatarUrl ?? null },
    student: {
      id: student.id,
      matricNo: student.matricNo,
      phone: student.phone ?? '',
      bio: student.bio ?? '',
      careerTargets: student.careerTargets ?? '',
      industries: student.industries ?? '',
      portfolioUrl: student.portfolioUrl ?? '',
      githubUrl: student.githubUrl ?? '',
      linkedinUrl: student.linkedinUrl ?? '',
      resumeSummary: student.resumeSummary ?? '',
      resumeData: student.resumeData ?? null,
      skills: student.skillTags ?? [],
    },
  };
}

async function loadStudentActor(actor) {
  const student = await prisma.student.findUnique({
    where: { id: actor.student.id },
    include: { user: true },
  });
  return { ...actor, user: student.user, student };
}

export async function GET(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    return NextResponse.json(serialize(await loadStudentActor(actor)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const input = profileSchema.parse(await parseJsonBody(request));
    const current = await prisma.student.findUnique({ where: { id: actor.student.id }, include: { user: true } });
    if (!current) return NextResponse.json({ error: 'Student profile not found.', code: 'STUDENT_NOT_FOUND' }, { status: 404 });

    const userData = typeof input.name === 'undefined' ? undefined : { name: input.name };
    const studentData = Object.fromEntries(Object.entries({
      phone: input.phone,
      bio: input.bio,
      careerTargets: input.careerTargets,
      industries: input.industries,
      portfolioUrl: input.portfolioUrl === '' ? null : input.portfolioUrl,
      githubUrl: input.githubUrl === '' ? null : input.githubUrl,
      linkedinUrl: input.linkedinUrl === '' ? null : input.linkedinUrl,
      resumeSummary: input.resumeSummary,
      resumeData: input.resumeData,
      skillTags: input.skills,
    }).filter(([, value]) => typeof value !== 'undefined'));

    const updated = await prisma.$transaction(async (tx) => {
      if (userData) await tx.user.update({ where: { id: current.userId }, data: userData });
      if (Object.keys(studentData).length) await tx.student.update({ where: { id: current.id }, data: studentData });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'STUDENT_PROFILE_UPDATED',
        resourceType: 'Student',
        resourceId: current.id,
        before: { name: current.user.name, fields: Object.keys(studentData) },
        after: { name: input.name ?? current.user.name, fields: Object.keys(studentData) },
        requestId: getRequestId(request),
        metadata: { scope: 'student-self-service' },
      });
      return tx.student.findUnique({ where: { id: current.id }, include: { user: true } });
    });
    return NextResponse.json(serialize({ ...actor, user: updated.user, student: updated }));
  } catch (error) {
    if (error?.name === 'ZodError') return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid profile details.', code: 'INVALID_PROFILE' }, { status: 400 });
    return errorResponse(error);
  }
}
