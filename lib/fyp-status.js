import { prisma } from './prisma.js';
import { createAuditEntry } from './audit/index.js';
import { canReviewStudent } from './fyp-review.js';
import { canTransitionFypStatus } from './fyp-status-policy.js';

function createFypStatusError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

/** Update an FYP review state after enforcing the reviewer's scope. */
export async function updateFypStatus({
  projectId,
  status,
  reviewNote = null,
  actor,
  requestId = null,
  prismaClient = prisma,
}) {
  const project = await prismaClient.fYPProject.findUnique({
    where: { id: projectId },
    include: {
      student: { select: { id: true, matricNo: true, programmeId: true, facultyId: true } },
    },
  });

  if (!project) {
    throw createFypStatusError(404, 'FYP_NOT_FOUND', 'Project not found.');
  }
  if (!canReviewStudent(actor, project.student)) {
    throw createFypStatusError(403, 'FYP_REVIEW_SCOPE_FORBIDDEN', 'You are not allowed to review this project.');
  }
  if (!canTransitionFypStatus(project.status, status)) {
    throw createFypStatusError(409, 'INVALID_FYP_TRANSITION', `A project in ${project.status} cannot be moved to ${status}.`);
  }

  return prismaClient.$transaction(async (tx) => {
    const updated = await tx.fYPProject.update({
      where: { id: projectId },
      data: {
        status,
        reviewNote,
        reviewerName: actor.user.name,
        reviewedAt: new Date(),
      },
    });

    await createAuditEntry({
      tx,
      actorUserId: actor.user.id,
      action: 'FYP_STATUS_UPDATED',
      resourceType: 'FYPProject',
      resourceId: projectId,
      before: {
        status: project.status,
        reviewNote: project.reviewNote,
        studentId: project.studentId,
      },
      after: {
        status: updated.status,
        reviewNote: updated.reviewNote,
        studentId: updated.studentId,
        reviewerName: updated.reviewerName,
      },
      requestId,
      metadata: { studentMatricNo: project.student.matricNo },
    });

    return updated;
  });
}
