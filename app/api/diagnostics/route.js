import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody } from '@/lib/auth/identity';
import { awardXpOnce, sumStudentXp } from '@/lib/xp-ledger';
import { XP_VALUES } from '@/lib/xp';
import {
  diagnosticById,
  scoreDiagnostic,
  assessmentIdFromTestId,
  assessmentToTest,
} from '@/lib/data/diagnostics';
import { studentListWhere } from './assessment-scope';

/**
 * Resolve the question bank an attempt must be scored against.
 *
 * Built-in diagnostics are looked up by their *test* id; staff-authored ones by
 * the `assessment:<id>` form, and only when they are published into the acting
 * student's own faculty/programme — so a student cannot sit (or be scored on)
 * another programme's assessment by guessing its id. Returns null for anything
 * unknown; the caller must refuse rather than fall back to a different test.
 */
async function resolveTest(testId, student) {
  const builtIn = diagnosticById(testId);
  if (builtIn) return builtIn;

  const assessmentId = assessmentIdFromTestId(testId);
  if (!assessmentId) return null;

  const record = await prisma.assessment.findFirst({
    where: { id: assessmentId, ...studentListWhere(student) },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  return record ? assessmentToTest(record) : null;
}

function routeError(error) {
  const e = toIdentityRouteError(error);
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
}

const saveSchema = z.object({
  testId: z.string().trim().min(1),
  // The browser submits answers only. Score, pass state and gap tags are
  // recomputed from the server's question bank so a student cannot send
  // score: 0 / passed: true and mint a reward.
  answers: z.record(z.string(), z.coerce.number().int().min(0).max(20)),
});

function serialize(r) {
  return {
    id: r.id,
    testId: r.testId,
    score: r.score,
    passed: r.passed,
    gapTags: r.gapTags,
    breakdown: r.breakdown,
    createdAt: r.createdAt,
  };
}

/** History of the acting student's diagnostic attempts, newest first. */
export async function GET(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const results = await prisma.diagnosticResult.findMany({
      where: { studentId: actor.student.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({
      results: results.map(serialize),
      latest: results[0] ? serialize(results[0]) : null,
      // First-ever attempt = the Year-1 baseline for the longitudinal overlay.
      baseline: results.length ? serialize(results[results.length - 1]) : null,
    });
  } catch (error) {
    return routeError(error);
  }
}

/**
 * Record a diagnostic attempt (Module 7). Every attempt is stored so the score
 * history builds over time; the Diagnostic XP + badge is awarded only on the
 * first pass, via an idempotent ledger entry.
 */
export async function POST(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const body = await parseJsonBody(request);
    const data = saveSchema.parse(body);
    const studentId = actor.student.id;
    const test = await resolveTest(data.testId, actor.student);
    if (!test) {
      return NextResponse.json(
        { error: 'That skills test is not available for your account.', code: 'DIAGNOSTIC_NOT_FOUND' },
        { status: 404 },
      );
    }
    const questionIds = test.questions.map((question) => question.id);
    const submittedIds = Object.keys(data.answers);
    if (submittedIds.length !== questionIds.length || questionIds.some((id) => !Object.prototype.hasOwnProperty.call(data.answers, id))) {
      return NextResponse.json({ error: 'Every diagnostic question must be answered.', code: 'INCOMPLETE_DIAGNOSTIC' }, { status: 400 });
    }
    const scored = scoreDiagnostic(test, data.answers);

    const result = await prisma.diagnosticResult.create({
      data: {
        studentId,
        testId: data.testId,
        score: scored.ratio,
        passed: scored.passed,
        gapTags: scored.gapTags,
        breakdown: scored.breakdown.map(({ name, ratio, strong }) => ({ name, ratio, strong })),
      },
    });

    let awarded = false;
    if (scored.passed) {
      ({ awarded } = await awardXpOnce({
        studentId,
        amount: XP_VALUES.DIAGNOSTIC_PASSED,
        source: 'DIAGNOSTIC_PASSED',
        note: 'Skills Diagnostic Cleared',
        dedupeKey: `diagnostic:${studentId}`,
      }));
      if (awarded) {
        // Mirror the reward as a badge, matching the seed's badge/XP pairing.
        await prisma.badge.upsert({
          where: { studentId_title: { studentId, title: 'Skills Diagnostic Cleared' } },
          update: {},
          create: {
            studentId,
            title: 'Skills Diagnostic Cleared',
            category: 'Assessment',
            icon: 'Brain',
            xp: XP_VALUES.DIAGNOSTIC_PASSED,
          },
        });
      }
    }

    const xp = await sumStudentXp(studentId);
    return NextResponse.json({ result: serialize(result), awarded, xp }, { status: 201 });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.issues?.[0]?.message ?? 'Invalid diagnostic result.' },
        { status: 400 },
      );
    }
    return routeError(error);
  }
}
