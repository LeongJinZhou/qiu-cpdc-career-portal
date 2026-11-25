import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import { createAuditEntry } from '@/lib/audit/index.js';
import { getRequestId, parseJsonBody, toIdentityRouteError } from '@/lib/auth/identity';
import { directoryIdentityMatches, fetchGoogleDirectoryProfile } from '@/lib/integrations/google-directory';
import { matchProgrammeByCourseCode } from '@/lib/data/programme-codes';
import { createRateLimiter } from '@/lib/rate-limit';

/**
 * Enrich the signed-in user's record from the QIU Google Workspace directory
 * (Module 16). Called by the login page right AFTER the session cookie is set,
 * with the Google OAuth access token from sign-in. Deliberately separate from
 * the session-establishment path so a directory hiccup can never block login.
 *
 * Every role is enriched (department, job title, Employee ID, employee type,
 * Google photo), matching sld-orientation. Students additionally get the
 * Student-row copy and the programme auto-resolve. The matric number is never
 * touched. Demo mode has no Google token, so it no-ops cleanly.
 */

const bodySchema = z.object({ accessToken: z.string().trim().min(1).max(4096) }).strict();
const limiter = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });

/** Only non-empty directory values overwrite what is stored. */
function nonEmpty(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value != null && value !== ''));
}

export async function POST(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });

    if (actor.demo) {
      // Dev-only demo actor: no real Google session to read from.
      return NextResponse.json({ synced: false, reason: 'DEMO_MODE' });
    }

    // Runs once per sign-in; anything more is not a person signing in.
    if (!limiter.check(actor.user.id).allowed) {
      return NextResponse.json({ synced: false, reason: 'RATE_LIMITED' }, { status: 429 });
    }

    const parsed = bodySchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ synced: false, reason: 'NO_ACCESS_TOKEN' });
    }

    const result = await fetchGoogleDirectoryProfile({
      accessToken: parsed.data.accessToken,
      email: actor.user.email,
    });
    if (!result.ok) {
      // Never a hard failure — the user is already signed in.
      return NextResponse.json({ synced: false, reason: result.error?.code ?? 'LOOKUP_FAILED' });
    }
    if (result.searchStatus && result.searchStatus !== 200) {
      console.warn(`[directory-sync] directory search returned HTTP ${result.searchStatus}`);
    }

    const {
      email, employeeId, courseCode, employeeType, department, jobTitle, photoUrl,
    } = result.data;

    if (!directoryIdentityMatches(actor.user.email, email)) {
      await prisma.$transaction(async (tx) => {
        await createAuditEntry({
          tx,
          actorUserId: actor.user.id,
          action: 'STUDENT_DIRECTORY_SYNC_REJECTED',
          resourceType: 'User',
          resourceId: actor.user.id,
          metadata: { reason: 'IDENTITY_MISMATCH', directoryEmailPresent: Boolean(email) },
          requestId: getRequestId(request),
        });
      });
      return NextResponse.json({ synced: false, reason: 'IDENTITY_MISMATCH' });
    }

    const userData = {
      directorySyncedAt: new Date(),
      ...nonEmpty({
        directoryEmployeeId: employeeId,
        directoryEmployeeType: employeeType,
        directoryDepartment: department,
        directoryJobTitle: jobTitle,
        googleAvatarUrl: photoUrl,
      }),
    };

    const isStudent = actor.role === 'STUDENT' && Boolean(actor.student);

    // Auto-resolve programme + faculty from the course code (e.g. "BCS" ->
    // Bachelor of Computer Science in Computing & Engineering). Only applied
    // when the code maps to exactly one programme; an ambiguous code leaves the
    // existing programme/faculty untouched rather than guessing wrong.
    let resolvedProgramme = null;
    if (isStudent && courseCode) {
      const programmes = await prisma.programme.findMany({ select: { id: true, name: true, code: true, facultyId: true } });
      resolvedProgramme = matchProgrammeByCourseCode(courseCode, programmes);
    }

    const studentData = isStudent
      ? {
        directorySyncedAt: new Date(),
        ...nonEmpty({ employeeId, courseCode, employeeType }),
        ...(resolvedProgramme ? { programmeId: resolvedProgramme.id, facultyId: resolvedProgramme.facultyId } : {}),
      }
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: actor.user.id }, data: userData });
      if (studentData) {
        await tx.student.update({ where: { id: actor.student.id }, data: studentData });
      }
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: isStudent ? 'STUDENT_DIRECTORY_SYNCED' : 'USER_DIRECTORY_SYNCED',
        resourceType: isStudent ? 'Student' : 'User',
        resourceId: isStudent ? actor.student.id : actor.user.id,
        // Field presence only: the audit log is not a second copy of the profile.
        after: {
          employeeId: Boolean(employeeId),
          courseCode: courseCode ?? null,
          employeeType: employeeType ?? null,
          department: Boolean(department),
          jobTitle: Boolean(jobTitle),
          photo: Boolean(photoUrl),
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
        department: department ?? null,
        jobTitle: jobTitle ?? null,
        programme: resolvedProgramme ? { id: resolvedProgramme.id, name: resolvedProgramme.name, facultyId: resolvedProgramme.facultyId } : null,
      },
    });
  } catch (error) {
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}
