import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody, getRequestId } from '@/lib/auth/identity';
import { createAuditEntry } from '@/lib/audit';
import { sumStudentXp } from '@/lib/xp-ledger';
import { findMilestone } from '@/lib/data/roadmaps';

const toggleSchema = z.object({
  milestoneId: z.string().trim().min(1, 'milestoneId is required'),
  completed: z.boolean(),
});

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

/**
 * List the acting student's self-reported milestone ids.
 *
 * `completed` remains as a compatibility alias for existing clients. These
 * rows are planning evidence supplied by the student, not staff-verified
 * completions and never imply an XP award.
 */
export async function GET(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const completions = await prisma.milestoneCompletion.findMany({
      where: { studentId: actor.student.id },
      select: { milestoneId: true },
    });
    const selfReported = completions.map((c) => c.milestoneId);
    return NextResponse.json({ completed: selfReported, selfReported });
  } catch (error) {
    return routeError(error);
  }
}

/**
 * Record or clear a self-reported milestone for the acting student.
 *
 * MilestoneCompletion has no verification/approval state, so this student-only
 * endpoint deliberately records planning state and does not write XP. XP must
 * come from an evidence-backed or staff-approved workflow, not a checkbox.
 */
export async function POST(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const body = await parseJsonBody(request);
    const { milestoneId, completed } = toggleSchema.parse(body);

    const facultyId = actor.student.facultyId;
    const milestone = findMilestone(facultyId, milestoneId);
    if (!milestone) {
      return NextResponse.json(
        { error: 'Unknown milestone for this faculty.', code: 'UNKNOWN_MILESTONE' },
        { status: 400 },
      );
    }

    const awarded = false;
    await prisma.$transaction(async (tx) => {
      const before = await tx.milestoneCompletion.findUnique({
        where: { studentId_milestoneId: { studentId: actor.student.id, milestoneId } },
      });

      if (completed) {
        await tx.milestoneCompletion.upsert({
          where: { studentId_milestoneId: { studentId: actor.student.id, milestoneId } },
          update: {},
          create: {
            studentId: actor.student.id,
            milestoneId,
            facultyId,
            year: milestone.year,
            label: milestone.item.label,
          },
        });
      } else {
        await tx.milestoneCompletion.deleteMany({
          where: { studentId: actor.student.id, milestoneId },
        });
      }

      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: completed ? 'CAREER_MILESTONE_SELF_REPORTED' : 'CAREER_MILESTONE_SELF_REPORT_REMOVED',
        resourceType: 'MilestoneCompletion',
        resourceId: `${actor.student.id}:${milestoneId}`,
        before: before
          ? { milestoneId, completed: true, selfReported: true, label: before.label }
          : { milestoneId, completed: false, selfReported: false },
        after: {
          milestoneId,
          completed,
          selfReported: completed,
          label: milestone.item.label,
          awarded,
        },
        requestId: getRequestId(request),
        metadata: {
          source: 'STUDENT_SELF_REPORT',
          verificationStatus: completed ? 'SELF_REPORTED' : 'NOT_REPORTED',
          xpAwarded: false,
        },
      });
    });

    const xp = await sumStudentXp(actor.student.id);
    return NextResponse.json({
      milestoneId,
      completed,
      selfReported: completed,
      verificationStatus: completed ? 'SELF_REPORTED' : 'NOT_REPORTED',
      awarded,
      xp,
    });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      );
    }
    return routeError(error);
  }
}
