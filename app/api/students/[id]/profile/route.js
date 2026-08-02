import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import {
  getRequestId,
  loadManualCv,
  loadStudentProfile,
  toIdentityRouteError,
} from '@/lib/auth/identity';
import { requireCapability } from '@/lib/auth/permissions';
import { createAuditEntry } from '@/lib/audit/index.js';
import { layersForRole } from '@/lib/auth/student-profile-visibility';

import { resolveDirectoryIdentity } from '../../student-scope';
import { STUDENT_PROFILE_INCLUDE, buildStudentRecordResponse } from '../../profile-view';

/**
 * GET /api/students/[id]/profile — one student record, projected for the
 * acting role.
 *
 * Order matters and is deliberate:
 *   1. Load the student (404 if there is no such student at all).
 *   2. `requireCapability('student.read', { studentId, facultyId, programmeId })`
 *      — 403 if the actor's scope does not reach them.
 *   3. `buildStudentProfileView` decides which of the seven layers come back.
 *
 * Steps 2 and 3 are separate on purpose: (2) is "may you reach this student",
 * (3) is "which fields do you get". Collapsing them is how a surface ends up
 * picking its own field list and quietly widening access.
 */

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'A student id is required.', code: 'BAD_REQUEST' }, { status: 400 });
    }

    const actor = await resolveActor(request, { allowNonStudent: true });
    const identity = resolveDirectoryIdentity(actor);

    if (!identity) {
      return NextResponse.json(
        { error: 'Sign in to read a student record.', code: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    // Accept either the database id or the human-facing matric number, because
    // staff read matric numbers off paperwork and should not have to know the
    // difference.
    const student = await prisma.student.findFirst({
      where: { OR: [{ id }, { matricNo: id }] },
      include: STUDENT_PROFILE_INCLUDE,
    });

    if (!student) {
      return NextResponse.json(
        { error: 'No student matches that id or matric number.', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    requireCapability(identity, 'student.read', {
      studentId: student.id,
      facultyId: student.facultyId,
      programmeId: student.programmeId,
    });

    const [studentProfile, manualCv] = await Promise.all([
      loadStudentProfile(student.id),
      loadManualCv(student.id),
    ]);

    await prisma.$transaction(async (tx) => {
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'STUDENT_RECORD_VIEWED',
        resourceType: 'Student',
        resourceId: student.id,
        after: { role: actor.role, layers: layersForRole(actor.role) },
        requestId: getRequestId(request),
      });
    });

    const isSelf = identity?.student?.id === student.id;
    const payload = buildStudentRecordResponse(student, {
      role: actor.role,
      isSelf,
      studentProfile,
      manualCv,
    });

    return NextResponse.json({
      ...payload,
      // Context the directory row already showed, repeated so the record page
      // can render a header even for roles whose layer set is very small.
      header: {
        name: student.user?.name ?? 'Unnamed student',
        matricNo: student.matricNo,
        faculty: student.faculty?.name ?? null,
        facultyCode: student.faculty?.code ?? null,
        programme: student.programme?.name ?? null,
        year: student.academicYear,
      },
    });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
  }
}
