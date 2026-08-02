import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody } from '@/lib/auth/identity';

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

// Roles allowed to publish vacancies. In demo the acting role comes from the
// x-demo-role header (the "View as" switcher).
function canPostJobs(role) {
  return role === 'EMPLOYER' || role === 'CPDC_ADMIN' || role === 'SUPER_ADMIN';
}

const postSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(160),
  description: z.string().trim().min(1, 'description is required').max(5000),
  location: z.string().trim().max(160).optional().nullable(),
  type: z.string().trim().max(60).optional().nullable(),
  skills: z.array(z.string().trim().max(40)).max(20).optional().default([]),
  company: z.object({
    name: z.string().trim().min(1, 'company.name is required').max(160),
    industry: z.string().trim().max(120).optional().nullable(),
    website: z.union([z.string().trim().url(), z.literal(''), z.null()]).optional(),
  }),
});

/**
 * List open vacancies (Module 11). Public to any resolved actor so students can
 * browse and apply; employers see the same board plus their own postings.
 */
export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const studentId = actor.student?.id ?? null;

    const jobs = await prisma.jobPosting.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { name: true, industry: true, website: true } },
        _count: { select: { applications: true } },
        applications: studentId ? { where: { studentId }, select: { id: true, stage: true } } : false,
      },
    });

    return NextResponse.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        description: j.description,
        location: j.location,
        type: j.type,
        skills: j.skills,
        company: j.company,
        applicantCount: j._count.applications,
        createdAt: j.createdAt,
        applied: Array.isArray(j.applications) && j.applications.length > 0,
        myStage: Array.isArray(j.applications) && j.applications[0] ? j.applications[0].stage : null,
      })),
    });
  } catch (error) {
    return routeError(error);
  }
}

/** Publish a vacancy (employer/admin). Reuses a company by name or creates one. */
export async function POST(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!canPostJobs(actor.role)) {
      return NextResponse.json(
        { error: 'Only employers can post vacancies.', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    const body = await parseJsonBody(request);
    const data = postSchema.parse(body);

    const company =
      (await prisma.company.findFirst({ where: { name: data.company.name } })) ??
      (await prisma.company.create({
        data: {
          name: data.company.name,
          industry: data.company.industry ?? null,
          website: data.company.website || null,
          ownerUserId: actor.role === 'EMPLOYER' ? actor.user.id : null,
        },
      }));

    if (actor.role === 'EMPLOYER' && company.ownerUserId && company.ownerUserId !== actor.user.id) {
      return NextResponse.json(
        { error: 'That company profile belongs to another employer account.', code: 'COMPANY_SCOPE_FORBIDDEN' },
        { status: 403 },
      );
    }

    const job = await prisma.jobPosting.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location ?? null,
        type: data.type ?? null,
        skills: data.skills ?? [],
        companyId: company.id,
      },
    });

    return NextResponse.json({ job: { id: job.id } }, { status: 201 });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid vacancy.' },
        { status: 400 },
      );
    }
    return routeError(error);
  }
}
