import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody, getRequestId } from '@/lib/auth/identity';
import { createAuditEntry } from '@/lib/audit';
import { createNotification, createNotifications, userIdsForRoles } from '@/lib/notifications';
import { awardXpOnce } from '@/lib/xp-ledger';
import { XP_VALUES } from '@/lib/xp';
import { courseById } from '@/lib/data/courses';

const REVIEW_ROLES = new Set([
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'PLACEMENT_OFFICER',
  'CAREER_COUNSELOR',
  'CPDC_ADMIN',
  'SUPER_ADMIN',
]);

const submissionSchema = z.object({
  courseId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(240),
  provider: z.string().trim().max(120).optional().nullable(),
  skillTag: z.string().trim().max(160).optional().nullable(),
  evidenceUrl: z.string().trim().max(2000).optional().nullable(),
  evidenceName: z.string().trim().max(240).optional().nullable(),
  evidenceData: z.string().max(4_000_000, 'Certificate file is too large for standalone storage.').optional().nullable(),
});

const decisionSchema = z.object({
  enrolmentId: z.string().trim().min(1),
  decision: z.enum(['VERIFIED', 'RETURNED']),
  reviewNote: z.string().trim().max(2000).optional().nullable(),
});

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

function mapRecord(record) {
  return {
    id: record.id,
    courseId: record.courseId,
    title: record.title,
    provider: record.provider,
    skillTag: record.skillTag,
    status: record.verificationStatus,
    courseStatus: record.status,
    verificationStatus: record.verificationStatus,
    verified: record.verificationStatus === 'VERIFIED',
    evidence: record.evidenceUrl
      ? { type: 'link', value: record.evidenceUrl }
      : record.certificateUrl
        ? { type: 'link', value: record.certificateUrl }
        : record.evidenceData
          ? { type: 'file', value: record.evidenceName ?? 'certificate file', data: record.evidenceData }
        : record.evidenceName
          ? { type: 'file', value: record.evidenceName }
          : null,
    evidenceUrl: record.evidenceUrl,
    evidenceName: record.evidenceName,
    hasEvidenceFile: Boolean(record.evidenceData),
    evidenceType: record.evidenceUrl || record.certificateUrl ? 'link' : record.evidenceData || record.evidenceName ? 'file' : null,
    evidenceValue: record.evidenceUrl || record.certificateUrl || record.evidenceName || null,
    evidenceData: record.evidenceData ?? null,
    submittedAt: record.createdAt,
    completedAt: record.completedAt,
    verifiedAt: record.verifiedAt,
    verifiedByUserId: record.verifiedByUserId,
    studentId: record.student?.matricNo ?? null,
    studentName: record.student?.user?.name ?? null,
    programme: record.student?.programme?.name ?? null,
    facultyId: record.student?.facultyId ?? null,
  };
}

function canReview(actor, record) {
  if (!REVIEW_ROLES.has(actor.role)) return false;
  if (actor.demo) return true;
  if (actor.role === 'SUPER_ADMIN' || actor.role === 'CPDC_ADMIN' || actor.role === 'CAREER_COUNSELOR') return true;
  if (actor.role === 'FACULTY_COORDINATOR' || actor.role === 'PLACEMENT_OFFICER') {
    return Boolean(actor.identity?.assignments?.some((assignment) => (
      assignment.role === actor.role
      && assignment.scopeType === 'FACULTY'
      && assignment.scopeValue === record.student.facultyId
    )));
  }
  if (actor.role === 'HEAD_OF_PROGRAMME') {
    return Boolean(actor.identity?.assignments?.some((assignment) => (
      assignment.role === actor.role
      && assignment.scopeType === 'PROGRAMME'
      && assignment.scopeValue === record.student.programmeId
    )));
  }
  return false;
}

function reviewerWhere(actor) {
  const pending = { verificationStatus: 'PENDING' };
  if (actor.demo || actor.role === 'SUPER_ADMIN' || actor.role === 'CPDC_ADMIN' || actor.role === 'CAREER_COUNSELOR') {
    return pending;
  }

  const assignments = (actor.identity?.assignments ?? []).filter((assignment) => assignment.role === actor.role);
  const scoped = assignments.flatMap((assignment) => {
    if (assignment.scopeType === 'FACULTY') return [{ student: { facultyId: assignment.scopeValue } }];
    if (assignment.scopeType === 'PROGRAMME') return [{ student: { programmeId: assignment.scopeValue } }];
    if (assignment.scopeType === 'STUDENT') return [{ studentId: assignment.scopeValue }];
    if (assignment.scopeType === 'GLOBAL' && assignment.scopeValue === 'GLOBAL') return [pending];
    return [];
  });

  // An empty scope must return an empty queue, never the university-wide queue.
  return scoped.length ? { ...pending, OR: scoped } : { ...pending, id: '__no_course_review_scope__' };
}

export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const staff = REVIEW_ROLES.has(actor.role);
    if (!staff && actor.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Only students and authorised reviewers can access course records.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const where = staff
      ? reviewerWhere(actor)
      : { studentId: actor.student.id };
    const records = await prisma.courseEnrolment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            matricNo: true,
            facultyId: true,
            programmeId: true,
            user: { select: { name: true } },
            programme: { select: { name: true } },
          },
        },
      },
    });
    const mapped = records.map(mapRecord);
    return NextResponse.json({ records: mapped, submissions: mapped, source: 'database' });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const body = submissionSchema.parse(await parseJsonBody(request));
    const now = new Date();
    const record = await prisma.$transaction(async (tx) => {
      const saved = await tx.courseEnrolment.upsert({
        where: { studentId_courseId: { studentId: actor.student.id, courseId: body.courseId } },
        update: {
          title: body.title,
          provider: body.provider ?? null,
          skillTag: body.skillTag ?? courseById(body.courseId)?.skillBadge ?? null,
          status: 'COMPLETED',
          certificateUrl: body.evidenceUrl ?? null,
          evidenceUrl: body.evidenceUrl ?? null,
          evidenceName: body.evidenceName ?? null,
          evidenceData: body.evidenceData ?? null,
          verificationStatus: 'PENDING',
          verifiedByUserId: null,
          verifiedAt: null,
          completedAt: now,
        },
        create: {
          studentId: actor.student.id,
          courseId: body.courseId,
          title: body.title,
          provider: body.provider ?? null,
          skillTag: body.skillTag ?? courseById(body.courseId)?.skillBadge ?? null,
          status: 'COMPLETED',
          certificateUrl: body.evidenceUrl ?? null,
          evidenceUrl: body.evidenceUrl ?? null,
          evidenceName: body.evidenceName ?? null,
          evidenceData: body.evidenceData ?? null,
          verificationStatus: 'PENDING',
          completedAt: now,
        },
      });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'COURSE_COMPLETION_SUBMITTED',
        resourceType: 'CourseEnrolment',
        resourceId: saved.id,
        after: { courseId: saved.courseId, verificationStatus: saved.verificationStatus },
        requestId: getRequestId(request),
      });
      const reviewerIds = (await userIdsForRoles(tx, [...REVIEW_ROLES]))
        .filter((userId) => userId !== actor.user.id);
      await createNotifications(tx, {
        recipientUserIds: reviewerIds,
        actorUserId: actor.user.id,
        type: 'COURSE_COMPLETION_SUBMITTED',
        title: 'Course evidence needs review',
        body: `${actor.user.name} submitted “${saved.title}” for verification.`,
        href: '/learning',
        resourceType: 'CourseEnrolment',
        resourceId: saved.id,
        dedupeKey: `course.submitted:${saved.id}`,
      });
      return saved;
    });
    return NextResponse.json({ record: mapRecord(record) }, { status: 201 });
  } catch (error) {
    if (error?.name === 'ZodError') return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid submission.' }, { status: 400 });
    return routeError(error);
  }
}

export async function PATCH(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const body = decisionSchema.parse(await parseJsonBody(request));
    const existing = await prisma.courseEnrolment.findUnique({
      where: { id: body.enrolmentId },
      include: {
        student: {
          select: {
            id: true,
            matricNo: true,
            facultyId: true,
            programmeId: true,
            userId: true,
            skillTags: true,
            user: { select: { name: true } },
            programme: { select: { name: true } },
          },
        },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Course submission not found.' }, { status: 404 });
    if (!canReview(actor, existing)) return NextResponse.json({ error: 'You are not allowed to review this course submission.' }, { status: 403 });

    const result = await prisma.$transaction(async (tx) => {
      const before = { verificationStatus: existing.verificationStatus };
      const saved = await tx.courseEnrolment.update({
        where: { id: existing.id },
        data: body.decision === 'VERIFIED'
          ? {
            status: 'COMPLETED',
            verificationStatus: 'VERIFIED',
            verifiedByUserId: actor.user.id,
            verifiedAt: new Date(),
            completedAt: existing.completedAt ?? new Date(),
          }
          : {
            verificationStatus: 'RETURNED',
            verifiedByUserId: null,
            verifiedAt: null,
          },
        include: { student: { select: { matricNo: true, user: { select: { name: true } }, programme: { select: { name: true } }, facultyId: true } } },
      });

      if (body.decision === 'VERIFIED') {
        const course = courseById(existing.courseId);
        const skillTag = existing.skillTag ?? course?.skillBadge ?? existing.title;
        const amount = Number(course?.xp) || XP_VALUES.COURSE_COMPLETION;
        await tx.student.update({
          where: { id: existing.student.id },
          data: { skillTags: { set: [...new Set([...(existing.student.skillTags ?? []), skillTag])] } },
        });
        await awardXpOnce({
          studentId: existing.student.id,
          amount,
          source: 'COURSE_COMPLETION',
          note: existing.title,
          dedupeKey: `course-completion:${existing.student.id}:${existing.courseId}`,
        }, tx);
        const badge = await tx.badge.upsert({
          where: { studentId_title: { studentId: existing.student.id, title: skillTag } },
          update: { category: 'Online Certificate', icon: 'Award', xp: amount },
          create: { studentId: existing.student.id, title: skillTag, category: 'Online Certificate', icon: 'Award', xp: amount },
        });
        const eventPayload = { enrolmentId: existing.id, studentId: existing.student.id, courseId: existing.courseId, skillTag, amount };
        await tx.automationEvent.upsert({
          where: { dedupeKey: `course.verified:${existing.id}` },
          update: { payload: eventPayload, status: 'RECORDED' },
          create: { type: 'COURSE_VERIFIED', status: 'RECORDED', dedupeKey: `course.verified:${existing.id}`, payload: eventPayload, studentId: existing.student.id },
        });
        await tx.outboxEvent.upsert({
          where: { dedupeKey: `course.verified:${existing.id}` },
          update: { payload: eventPayload, lastError: null },
          create: { topic: 'learning.course.verified', aggregateType: 'CourseEnrolment', aggregateId: existing.id, payload: eventPayload, dedupeKey: `course.verified:${existing.id}` },
        });
        await createNotification(tx, {
          recipientUserId: existing.student.userId,
          actorUserId: actor.user.id,
          type: 'COURSE_COMPLETION_VERIFIED',
          title: 'Course evidence verified',
          body: `Your course evidence for “${existing.title}” was verified. ${skillTag} was added to your QIU profile.`,
          href: '/learning',
          resourceType: 'CourseEnrolment',
          resourceId: existing.id,
          dedupeKey: `course.verified.notification:${existing.id}`,
        });
        await createAuditEntry({
          tx,
          actorUserId: actor.user.id,
          action: 'COURSE_COMPLETION_VERIFIED',
          resourceType: 'CourseEnrolment',
          resourceId: existing.id,
          before,
          after: { verificationStatus: 'VERIFIED', badgeId: badge.id, skillTag, amount },
          requestId: getRequestId(request),
        });
      } else {
        await createNotification(tx, {
          recipientUserId: existing.student.userId,
          actorUserId: actor.user.id,
          type: 'COURSE_COMPLETION_RETURNED',
          title: 'Course evidence needs an update',
          body: `Please review the note on your submission for “${existing.title}” and upload clearer evidence if needed.${body.reviewNote ? ` Note: ${body.reviewNote}` : ''}`,
          href: '/learning',
          resourceType: 'CourseEnrolment',
          resourceId: existing.id,
          dedupeKey: `course.returned.notification:${existing.id}:${existing.updatedAt.toISOString()}`,
        });
        await createAuditEntry({
          tx,
          actorUserId: actor.user.id,
          action: 'COURSE_COMPLETION_RETURNED',
          resourceType: 'CourseEnrolment',
          resourceId: existing.id,
          before,
          after: { verificationStatus: 'RETURNED', reviewNote: body.reviewNote ?? null },
          requestId: getRequestId(request),
        });
      }
      return saved;
    });

    return NextResponse.json({ record: mapRecord(result), decision: body.decision });
  } catch (error) {
    if (error?.name === 'ZodError') return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid review.' }, { status: 400 });
    return routeError(error);
  }
}
