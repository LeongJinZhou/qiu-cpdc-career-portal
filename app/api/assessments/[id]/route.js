import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { createAuditEntry } from '@/lib/audit/index.js';
import { getRequestId, parseJsonBody, toIdentityRouteError } from '@/lib/auth/identity';
import { canAuthorAssessments, canReadAssessments, publicQuestion, scoreAssessment } from '@/lib/assessment';

const updateSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  instructions: z.string().trim().max(2000).nullable().optional(),
  passMark: z.coerce.number().min(0.01).max(1).optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(600).nullable().optional(),
  // A draft may be corrected after import. The server accepts only an existing
  // question id and a concrete option index; it never lets a browser invent a
  // new answer key or modify a published assessment.
  questionEdits: z.array(z.object({
    id: z.string().trim().min(1),
    correctOptionIndex: z.coerce.number().int().min(0).max(20),
  })).max(200).optional(),
});

const attemptSchema = z.object({
  action: z.enum(['start', 'submit']).optional().default('submit'),
  attemptId: z.string().trim().min(1).optional(),
  answers: z.record(z.string(), z.coerce.number().int().min(0).max(20)).default({}),
});

function errorResponse(error) {
  const routeError = toIdentityRouteError(error);
  return NextResponse.json({ error: routeError.message, code: routeError.code, details: error?.details ?? undefined }, { status: routeError.status });
}

function forbidden(message = 'You do not have access to this assessment.') {
  const error = new Error(message);
  error.status = 403;
  error.code = 'ASSESSMENT_FORBIDDEN';
  return error;
}

function serialize(record, includeAnswers) {
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
    questions: (record.questions ?? []).map((question) => includeAnswers ? question : publicQuestion(question)),
    attempts: (record.attempts ?? []).map((attempt) => ({
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
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
  };
}

const include = {
  faculty: { select: { id: true, name: true, code: true } },
  programme: { select: { id: true, name: true } },
  questions: { orderBy: { order: 'asc' } },
  attempts: {
    orderBy: { startedAt: 'desc' },
    take: 100,
    include: { student: { select: { matricNo: true, user: { select: { name: true } } } } },
  },
};

async function loadAssessment(id) {
  return prisma.assessment.findUnique({ where: { id }, include });
}

function matchesStudent(record, student) {
  return record.status === 'PUBLISHED'
    && (!record.facultyId || record.facultyId === student.facultyId)
    && (!record.programmeId || record.programmeId === student.programmeId);
}

function canManage(record, actor) {
  if (actor.role === 'CPDC_ADMIN' || actor.role === 'SUPER_ADMIN') return true;
  if (actor.demo && actor.student) {
    return record.facultyId === actor.student.facultyId || record.programmeId === actor.student.programmeId;
  }
  const assignments = (actor.identity?.assignments ?? []).filter((assignment) => assignment.role === actor.role);
  return assignments.some((assignment) => (
    (assignment.scopeType === 'FACULTY' && assignment.scopeValue === record.facultyId)
      || (assignment.scopeType === 'PROGRAMME' && assignment.scopeValue === record.programmeId)
  ));
}

export async function GET(request, { params }) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!canReadAssessments(actor.role)) throw forbidden();
    const { id } = await params;
    const assessment = await loadAssessment(id);
    if (!assessment) return NextResponse.json({ error: 'Assessment not found.', code: 'ASSESSMENT_NOT_FOUND' }, { status: 404 });
    const staff = canAuthorAssessments(actor.role);
    if (staff ? !canManage(assessment, actor) : !matchesStudent(assessment, actor.student)) throw forbidden();
    const visibleAssessment = staff
      ? assessment
      : { ...assessment, attempts: assessment.attempts.filter((attempt) => attempt.studentId === actor.student.id) };
    return NextResponse.json({ assessment: serialize(visibleAssessment, staff) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    if (!canAuthorAssessments(actor.role)) throw forbidden('Only lecturers and CPDC officers can manage assessments.');
    const { id } = await params;
    const current = await loadAssessment(id);
    if (!current) return NextResponse.json({ error: 'Assessment not found.', code: 'ASSESSMENT_NOT_FOUND' }, { status: 404 });
    if (!canManage(current, actor)) throw forbidden('This assessment is outside your assigned scope.');
    const input = updateSchema.parse(await parseJsonBody(request));
    if (current.status === 'PUBLISHED' && Object.keys(input).some((key) => key !== 'status')) {
      return NextResponse.json({ error: 'Published assessments are locked. Create a new import for a revised version.', code: 'ASSESSMENT_PUBLISHED_LOCKED' }, { status: 409 });
    }
    const effectiveQuestions = current.questions.map((question) => {
      const edit = input.questionEdits?.find((candidate) => candidate.id === question.id);
      return edit ? { ...question, correctOptionIndexes: [edit.correctOptionIndex] } : question;
    });
    if (input.questionEdits?.some((edit) => !current.questions.some((question) => question.id === edit.id))) {
      return NextResponse.json({ error: 'One of the questions no longer belongs to this assessment. Refresh and try again.', code: 'ASSESSMENT_QUESTION_NOT_FOUND' }, { status: 400 });
    }
    if (input.questionEdits?.some((edit) => {
      const question = current.questions.find((candidate) => candidate.id === edit.id);
      return !question || edit.correctOptionIndex >= question.options.length;
    })) {
      return NextResponse.json({ error: 'Choose an answer that exists in the question options.', code: 'ASSESSMENT_ANSWER_KEY_INVALID' }, { status: 400 });
    }
    if (input.status === 'PUBLISHED' && (!effectiveQuestions.length || effectiveQuestions.some((question) => question.correctOptionIndexes.length === 0))) {
      return NextResponse.json({ error: 'Every question must have an answer before publishing.', code: 'ASSESSMENT_NOT_READY' }, { status: 400 });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const { questionEdits, ...assessmentFields } = input;
      const record = await tx.assessment.update({
        where: { id },
        data: {
          ...assessmentFields,
          publishedAt: assessmentFields.status === 'PUBLISHED' ? new Date() : assessmentFields.status ? null : undefined,
        },
        include,
      });
      if (questionEdits?.length) {
        await Promise.all(questionEdits.map((edit) => tx.assessmentQuestion.update({
          where: { id: edit.id },
          data: { correctOptionIndexes: [edit.correctOptionIndex] },
        })));
      }
      const finalRecord = questionEdits?.length
        ? await tx.assessment.findUnique({ where: { id }, include })
        : record;
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: input.status === 'PUBLISHED' ? 'ASSESSMENT_PUBLISHED' : 'ASSESSMENT_DRAFT_UPDATED',
        resourceType: 'Assessment',
        resourceId: id,
        before: { status: current.status, title: current.title },
        after: { status: finalRecord.status, title: finalRecord.title, questionCount: finalRecord.questions.length, answerKeysUpdated: questionEdits?.length ?? 0 },
        requestId: getRequestId(request),
      });
      return finalRecord;
    });
    return NextResponse.json({ assessment: serialize(updated, true) });
  } catch (error) {
    if (error?.name === 'ZodError') return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid assessment update.', code: 'INVALID_ASSESSMENT' }, { status: 400 });
    return errorResponse(error);
  }
}

export async function POST(request, { params }) {
  try {
    const actor = await resolveActor(request);
    if (actor.role !== 'STUDENT') throw forbidden('Only students can submit an assessment attempt.');
    const { id } = await params;
    const assessment = await loadAssessment(id);
    if (!assessment || !matchesStudent(assessment, actor.student)) return NextResponse.json({ error: 'Published assessment not found.', code: 'ASSESSMENT_NOT_FOUND' }, { status: 404 });
    const input = attemptSchema.parse(await parseJsonBody(request));
    const questionIds = assessment.questions.map((question) => question.id);
    if (input.action === 'start') {
      const active = await prisma.assessmentAttempt.findFirst({
        where: { assessmentId: id, studentId: actor.student.id, submittedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (active && (!active.expiresAt || active.expiresAt > new Date())) {
        return NextResponse.json({ attempt: { id: active.id, startedAt: active.startedAt, expiresAt: active.expiresAt } });
      }

      // An abandoned timed attempt is closed as a zero-score submission before
      // a new one can start. This keeps the attempt history honest and prevents
      // a student from opening unlimited overlapping attempts.
      if (active) {
        const expiredScore = scoreAssessment(assessment.questions, {});
        await prisma.assessmentAttempt.update({
          where: { id: active.id },
          data: { answers: {}, breakdown: expiredScore.breakdown, score: expiredScore.score, passed: false, submittedAt: new Date() },
        });
      }

      const expiresAt = assessment.timeLimitMinutes
        ? new Date(Date.now() + assessment.timeLimitMinutes * 60 * 1000)
        : null;
      const attempt = await prisma.$transaction(async (tx) => {
        const created = await tx.assessmentAttempt.create({
          data: { assessmentId: id, studentId: actor.student.id, answers: {}, breakdown: null, score: null, passed: null, expiresAt },
        });
        await createAuditEntry({
          tx,
          actorUserId: actor.user.id,
          action: 'ASSESSMENT_ATTEMPT_STARTED',
          resourceType: 'AssessmentAttempt',
          resourceId: created.id,
          after: { assessmentId: id, expiresAt },
          requestId: getRequestId(request),
        });
        return created;
      });
      return NextResponse.json({ attempt: { id: attempt.id, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt } }, { status: 201 });
    }

    if (Object.keys(input.answers).length !== questionIds.length || questionIds.some((questionId) => !(questionId in input.answers))) {
      const expiredAttempt = input.attemptId
        ? await prisma.assessmentAttempt.findFirst({ where: { id: input.attemptId, assessmentId: id, studentId: actor.student.id, submittedAt: null } })
        : null;
      if (!expiredAttempt?.expiresAt || expiredAttempt.expiresAt > new Date()) {
        return NextResponse.json({ error: 'Please answer every question before submitting.', code: 'ASSESSMENT_INCOMPLETE' }, { status: 400 });
      }
    }

    if (!input.attemptId) {
      return NextResponse.json({ error: 'Start the assessment again so the platform can record its attempt time.', code: 'ASSESSMENT_ATTEMPT_REQUIRED' }, { status: 400 });
    }

    const attemptBeforeSubmit = await prisma.assessmentAttempt.findFirst({
      where: { id: input.attemptId, assessmentId: id, studentId: actor.student.id },
    });
    if (!attemptBeforeSubmit) return NextResponse.json({ error: 'Assessment attempt not found.', code: 'ASSESSMENT_ATTEMPT_NOT_FOUND' }, { status: 404 });
    if (attemptBeforeSubmit.submittedAt) {
      return NextResponse.json({ error: 'This attempt has already been submitted.', code: 'ASSESSMENT_ALREADY_SUBMITTED' }, { status: 409 });
    }

    const expired = Boolean(attemptBeforeSubmit.expiresAt && attemptBeforeSubmit.expiresAt <= new Date());
    if (expired && Object.keys(input.answers).length !== questionIds.length) {
      // The server closes a timed-out attempt with the answers received so far;
      // unanswered questions remain incorrect in the objective score.
    }
    const score = scoreAssessment(assessment.questions, input.answers);
    const passed = score.score >= assessment.passMark;
    const attempt = await prisma.$transaction(async (tx) => {
      const updatedCount = await tx.assessmentAttempt.updateMany({
        where: { id: input.attemptId, studentId: actor.student.id, submittedAt: null },
        data: { answers: input.answers, breakdown: score.breakdown, score: score.score, passed, submittedAt: new Date() },
      });
      if (updatedCount.count !== 1) {
        throw Object.assign(new Error('This attempt has already been submitted.'), { status: 409, code: 'ASSESSMENT_ALREADY_SUBMITTED' });
      }
      const created = await tx.assessmentAttempt.findUnique({ where: { id: input.attemptId } });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'ASSESSMENT_SUBMITTED',
        resourceType: 'AssessmentAttempt',
        resourceId: created.id,
        after: { assessmentId: id, score: score.score, passed, timedOut: expired },
        requestId: getRequestId(request),
      });
      return created;
    });
    return NextResponse.json({ attempt: { id: attempt.id, score: attempt.score, passed: attempt.passed, submittedAt: attempt.submittedAt, breakdown: attempt.breakdown, timedOut: expired } }, { status: 200 });
  } catch (error) {
    if (error?.name === 'ZodError') return NextResponse.json({ error: error.issues?.[0]?.message ?? 'Invalid answers.', code: 'INVALID_ASSESSMENT_ANSWERS' }, { status: 400 });
    return errorResponse(error);
  }
}
