import { createAuditEntry } from './audit/index.js';

/**
 * The standalone build needs one explicit rule for deciding when an
 * internship is complete. ACMS/SIS can replace the source of approved hours
 * later without changing the lifecycle event contract.
 */
export const INTERNSHIP_HOURS_THRESHOLD = Math.max(
  1,
  Number(process.env.INTERNSHIP_HOURS_THRESHOLD) || 100,
);

export function lifecycleDecision({ approvedHours, lifecycleStatus }) {
  const hours = Number(approvedHours) || 0;
  const alreadyComplete = lifecycleStatus === 'INTERNSHIP_COMPLETE';
  return {
    approvedHours: hours,
    threshold: INTERNSHIP_HOURS_THRESHOLD,
    eligible: hours >= INTERNSHIP_HOURS_THRESHOLD,
    shouldTransition: hours >= INTERNSHIP_HOURS_THRESHOLD && !alreadyComplete,
  };
}

/**
 * Re-evaluate one student's verified fieldwork and record the transition once.
 * The caller supplies a transaction client so the student update, user-facing
 * automation record, outbox message, and audit trail commit together.
 */
export async function evaluateStudentLifecycle(
  studentId,
  { tx, actorUserId = null, requestId = null, trigger = 'SYSTEM' } = {},
) {
  if (!tx) throw new TypeError('evaluateStudentLifecycle requires a Prisma transaction client.');

  const student = await tx.student.findUnique({
    where: { id: studentId },
    select: { id: true, matricNo: true, lifecycleStatus: true, internshipCompletedAt: true },
  });
  if (!student) return { found: false, transitioned: false };

  const hoursResult = await tx.logbookEntry.aggregate({
    where: { studentId, status: 'APPROVED' },
    _sum: { hours: true },
  });
  const decision = lifecycleDecision({
    approvedHours: hoursResult._sum.hours,
    lifecycleStatus: student.lifecycleStatus,
  });

  if (!decision.shouldTransition) {
    return {
      found: true,
      transitioned: false,
      lifecycleStatus: student.lifecycleStatus,
      ...decision,
    };
  }

  const completedAt = new Date();
  const updated = await tx.student.updateMany({
    where: { id: studentId, lifecycleStatus: { not: 'INTERNSHIP_COMPLETE' } },
    data: {
      lifecycleStatus: 'INTERNSHIP_COMPLETE',
      internshipCompletedAt: completedAt,
      alumniEligibleAt: completedAt,
    },
  });

  // A concurrent approval may have performed the transition first. The
  // unique dedupe keys make this safe even if both transactions reach here.
  if (updated.count === 0) {
    return {
      found: true,
      transitioned: false,
      lifecycleStatus: 'INTERNSHIP_COMPLETE',
      ...decision,
    };
  }

  const dedupeKey = `student.lifecycle.internship_completed:${studentId}`;
  const payload = {
    studentId,
    matricNo: student.matricNo,
    approvedHours: decision.approvedHours,
    threshold: decision.threshold,
    trigger,
    completedAt: completedAt.toISOString(),
  };

  await tx.automationEvent.upsert({
    where: { dedupeKey },
    update: { payload, status: 'RECORDED' },
    create: {
      type: 'INTERNSHIP_COMPLETED',
      status: 'RECORDED',
      dedupeKey,
      payload,
      studentId,
    },
  });

  await tx.outboxEvent.upsert({
    where: { dedupeKey },
    update: { payload, lastError: null },
    create: {
      topic: 'student.lifecycle.internship_completed',
      aggregateType: 'Student',
      aggregateId: studentId,
      payload,
      dedupeKey,
    },
  });

  await createAuditEntry({
    tx,
    actorUserId,
    action: 'STUDENT_LIFECYCLE_AUTOMATED',
    resourceType: 'Student',
    resourceId: studentId,
    before: { lifecycleStatus: student.lifecycleStatus },
    after: { lifecycleStatus: 'INTERNSHIP_COMPLETE', approvedHours: decision.approvedHours },
    requestId,
    metadata: { trigger, threshold: decision.threshold },
  });

  return {
    found: true,
    transitioned: true,
    lifecycleStatus: 'INTERNSHIP_COMPLETE',
    ...decision,
  };
}
