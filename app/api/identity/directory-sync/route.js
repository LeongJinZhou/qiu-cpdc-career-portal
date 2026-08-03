import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { requireStudentActor, resolveActor } from '@/lib/auth/actor';
import { createAuditEntry } from '@/lib/audit/index.js';
import { getRequestId, parseJsonBody, toIdentityRouteError } from '@/lib/auth/identity';
import { directoryIdentityMatches, fetchGoogleDirectoryProfile } from '@/lib/integrations/google-directory';
import { matchProgrammeByCourseCode } from '@/lib/data/programme-codes';

/**
 * Enrich the signed-in student's record from the QIU Google Workspace directory
 * (Module 16). Called by the login page right AFTER the session cookie is set,
 * with the Google OAuth access token from sign-in. Deliberately separate from
 * the session-establishment path so a directory hiccup can never block login.
 *
 * Reads Employee ID, course code and employee type via the People API and stores
 * them on the Student row. Demo mode has no Google token, so it no-ops cleanly.
 */

const bodySchema = z.object({ accessToken: z.string().trim().min(1) });

export async function POST(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));

    if (actor.demo) {
      // Dev-only demo actor: no real Google session to read from.
      return NextResponse.json({ synced: false, reason: 'DEMO_MODE' });
    }

    const parsed = bodySchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ synced: false, reason: 'NO_ACCESS_TOKEN' });
    }

    const result = await fetchGoogleDirectoryProfile({ accessToken: parsed.data.accessToken });
    if (!result.ok) {
      // Never a hard failure — the student is already signed in.
      return NextResponse.json({ synced: false, reason: result.error?.code ?? 'LOOKUP_FAILED' });
    }

    const { email, employeeId, courseCode, employeeType } = result.data;
    if (!directoryIdentityMatches(actor.user.email, email)) {
      await prisma.$transaction(async (tx) => {
        await createAuditEntry({
          tx,
          actorUserId: actor.user.id,
          action: 'STUDENT_DIRECTORY_SYNC_REJECTED',
          resourceType: 'Student',
          resourceId: actor.student.id,
          metadata: { reason: 'IDENTITY_MISMATCH', directoryEmailPresent: Boolean(email) },
          requestId: getRequestId(request),
        });
      });
      return NextResponse.json({ synced: false, reason: 'IDENTITY_MISMATCH' });
    }
    // Auto-resolve programme + faculty from the course code (e.g. "BCS" ->
    // Bachelor of Computer Science in Computing & Engineering). Only applied
    // when the code maps to exactly one programme; an ambiguous code leaves the
    // existing programme/faculty untouched rather than guessing wrong.
    let resolvedProgramme = null;
    if (courseCode) {
      const programmes = await prisma.programme.findMany({ select: { id: true, name: true, code: true, facultyId: true } });
      resolvedProgramme = matchProgrammeByCourseCode(courseCode, programmes);
    }

    const data = {
      directorySyncedAt: new Date(),
      ...(employeeId ? { employeeId } : {}),
      ...(courseCode ? { courseCode } : {}),
      ...(employeeType ? { employeeType } : {}),
      ...(resolvedProgramme ? { programmeId: resolvedProgramme.id, facultyId: resolvedProgramme.facultyId } : {}),
    };

    await prisma.$transaction(async (tx) => {
      await tx.student.update({ where: { id: actor.student.id }, data });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'STUDENT_DIRECTORY_SYNCED',
        resourceType: 'Student',
        resourceId: actor.student.id,
        after: {
          employeeId: employeeId ?? null,
          courseCode: courseCode ?? null,
          employeeType: employeeType ?? null,
          email: email ?? null,
          programmeId: resolvedProgramme?.id ?? null,
          facultyId: resolvedProgramme?.facultyId ?? null,
        },
        requestId: getRequestId(request),
      });
    });

    return NextResponse.json({
      synced: true,
      profile: {
        employeeId: employeeId ?? null,
        courseCode: courseCode ?? null,
        employeeType: employeeType ?? null,
        programme: resolvedProgramme ? { id: resolvedProgramme.id, name: resolvedProgramme.name, facultyId: resolvedProgramme.facultyId } : null,
      },
    });
  } catch (error) {
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}
