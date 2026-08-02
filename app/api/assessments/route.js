import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { createAuditEntry } from '@/lib/audit/index.js';
import { getRequestId, toIdentityRouteError } from '@/lib/auth/identity';
import {
  AssessmentParseError,
  canAuthorAssessments,
  canReadAssessments,
  extractAssessmentText,
  parseAssessmentText,
  publicQuestion,
} from '@/lib/assessment';

export const runtime = 'nodejs';

const createFields = z.object({
  title: z.string().trim().max(180).optional().default(''),
  instructions: z.string().trim().max(2000).optional().default(''),
  passMark: z.coerce.number().min(0.01).max(1).optional().default(0.6),
  timeLimitMinutes: z.coerce.number().int().min(1).max(600).optional().nullable(),
  facultyId: z.string().trim().min(1).optional().nullable(),
  programmeId: z.string().trim().min(1).optional().nullable(),
});

function errorResponse(error) {
  const routeError = toIdentityRouteError(error);
  return NextResponse.json(
    { error: routeError.message, code: routeError.code, details: error?.details ?? undefined },
    { status: routeError.status },
  );
}

function forbidden(message = 'You do not have access to assessment tools.') {
  const error = new Error(message);
  error.status = 403;
  error.code = 'ASSESSMENT_FORBIDDEN';
  return error;
}

function scopeIds(actor, scopeType) {
  return (actor.identity?.assignments ?? [])
    .filter((assignment) => assignment.role === actor.role && assignment.scopeType === scopeType)
    .map((assignment) => assignment.scopeValue)
    .filter(Boolean);
}

function actorScope(actor) {
  if (actor.demo && actor.student) {
    if (actor.role === 'HEAD_OF_PROGRAMME') return { programmeId: actor.student.programmeId };
    if (actor.role === 'FACULTY_COORDINATOR' || actor.role === 'ACADEMIC_SUPERVISOR') return { facultyId: actor.student.facultyId };
  }
  if (['CPDC_ADMIN', 'SUPER_ADMIN'].includes(actor.role)) return {};
  const programmeIds = scopeIds(actor, 'PROGRAMME');
  const facultyIds = scopeIds(actor, 'FACULTY');
  if (actor.role === 'HEAD_OF_PROGRAMME' && programmeIds.length) return { programmeId: { in: programmeIds } };
  if (facultyIds.length) return { facultyId: { in: facultyIds } };
  return null;
}

function canManageScope(actor, { facultyId = null, programmeId = null } = {}) {
  if (['CPDC_ADMIN', 'SUPER_ADMIN'].includes(actor.role)) return true;
  const scope = actorScope(actor);
  if (!scope) return false;
  if (scope.programmeId) return !programmeId || (typeof scope.programmeId === 'string' ? scope.programmeId === programmeId : scope.programmeId.in.includes(programmeId));
  if (scope.facultyId) return !facultyId || (typeof scope.facultyId === 'string' ? scope.facultyId === facultyId : scope.facultyId.in.includes(facultyId));
  return false;
}

function publicAssessment(record, includeAnswers = false, studentId = null) {
  const attempts = (record.attempts ?? [])
    .filter((attempt) => includeAnswers || !studentId || attempt.studentId === studentId)
    .map((attempt) => ({
      id: attempt.id,
      studentId: includeAnswers ? attempt.studentId : undefined,
      student: includeAnswers && attempt.student
        ? { matricNo: attempt.student.matricNo, name: attempt.student.user?.name ?? 'Student' }
        : undefined,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      score: attempt.score,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
      breakdown: includeAnswers ? attempt.breakdown : undefined,
    }));
  return {
    id: record.id,
    title: record.title,
    instructions: record.instructions,
    status: record.status,
    passMark: record.passMark,
    timeLimitMinutes: record.timeLimitMinutes,
    sourceFileName: record.sourceFileName,
    sourceFileType: record.sourceFileType,
    faculty: record.faculty ? { id: record.faculty.id, name: record.faculty.name, code: record.faculty.code } : null,
    programme: record.programme ? { id: record.programme.id, name: record.programme.name } : null,
    questionCount: record.questions?.length ?? 0,
    questions: includeAnswers ? (record.questions ?? []) : (record.questions ?? []).map(publicQuestion),
    attempts,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
  };
}

const assessmentInclude = {
  faculty: { select: { id: true, name: true, code: true } },
  programme: { select: { id: true, name: true } },
  questions: { orderBy: { order: 'asc' } },
  attempts: {
    orderBy: { startedAt: 'desc' },
    take: 100,
    include: { student: { select: { matricNo: true, user: { select: { name: true } } } } },
  },
};

export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!canReadAssessments(actor.role)) throw forbidden();

    const where = actor.role === 'STUDENT'
      ? {
        status: 'PUBLISHED',
        OR: [
          { facultyId: null },
          { facultyId: actor.student.facultyId },
        ],
        AND: [{ OR: [{ programmeId: null }, { programmeId: actor.student.programmeId }] }],
      }
      : actorScope(actor);
    if (where == null) throw forbidden('Your lecturer role has no configured faculty or programme scope yet.');

    const assessments = await prisma.assessment.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
      include: assessmentInclude,
    });
    return NextResponse.json({ assessments: assessments.map((assessment) => publicAssessment(assessment, actor.role !== 'STUDENT', actor.student?.id ?? null)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!canAuthorAssessments(actor.role)) throw forbidden('Only lecturers, CPDC officers, and super-admins can create assessments.');

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') throw new AssessmentParseError('Choose a PDF, Word document, or text file before uploading.');
    const fields = createFields.parse({
      title: form.get('title') ?? '',
      instructions: form.get('instructions') ?? '',
      passMark: form.get('passMark') ?? 0.6,
      timeLimitMinutes: form.get('timeLimitMinutes') || null,
      facultyId: form.get('facultyId') || null,
      programmeId: form.get('programmeId') || null,
    });
    const extracted = await extractAssessmentText(file);
    const draft = parseAssessmentText(extracted.text, { fallbackTitle: fields.title || file.name });
    const facultyId = fields.facultyId || (actor.role !== 'HEAD_OF_PROGRAMME' ? actor.student?.facultyId : null);
    const programmeId = fields.programmeId || (actor.role === 'HEAD_OF_PROGRAMME' ? actor.student?.programmeId : null);
    if (!canManageScope(actor, { facultyId, programmeId })) throw forbidden('This assessment must stay inside your assigned faculty or programme scope.');
    if (programmeId && !facultyId) {
      const programme = await prisma.programme.findUnique({ where: { id: programmeId }, select: { facultyId: true } });
      if (!programme) throw new AssessmentParseError('The selected programme does not exist.');
    }

    const assessment = await prisma.$transaction(async (tx) => {
      const created = await tx.assessment.create({
        data: {
          title: fields.title || draft.title,
          instructions: fields.instructions || draft.instructions,
          passMark: fields.passMark ?? draft.passMark,
          timeLimitMinutes: fields.timeLimitMinutes ?? draft.timeLimitMinutes,
          facultyId,
          programmeId,
          sourceFileName: extracted.sourceFileName,
          sourceFileType: extracted.sourceFileType,
          sourceTextHash: extracted.sourceTextHash,
          createdByUserId: actor.user.id,
          questions: { create: draft.questions },
        },
        include: assessmentInclude,
      });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'ASSESSMENT_SOURCE_UPLOADED',
        resourceType: 'Assessment',
        resourceId: created.id,
        after: { title: created.title, sourceFileName: created.sourceFileName, sourceFileType: created.sourceFileType, questionCount: created.questions.length, status: created.status },
        requestId: getRequestId(request),
      });
      return created;
    });

    return NextResponse.json({ assessment: publicAssessment(assessment, true, null), warnings: [] }, { status: 201 });
  } catch (error) {
    if (error?.name === 'ZodError') return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid assessment details.', code: 'INVALID_ASSESSMENT' }, { status: 400 });
    return errorResponse(error);
  }
}
