import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { requireStudentActor, resolveActor } from '@/lib/auth/actor';
import { createAuditEntry } from '@/lib/audit/index.js';
import { getRequestId, parseJsonBody, toIdentityRouteError } from '@/lib/auth/identity';
import { fetchGoogleDirectoryProfile } from '@/lib/integrations/google-directory';

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

    // Log the raw payload ONCE per student so the field mapping can be confirmed
    // against a real QIU directory record on first sign-in, then tightened.
    if (!actor.student.directorySyncedAt) {
      console.info('[directory-sync] first People API profile for student', actor.student.id, JSON.stringify(result.raw)?.slice(0, 4000));
    }

    const { email, employeeId, courseCode, employeeType } = result.data;
    const data = {
      directorySyncedAt: new Date(),
      ...(employeeId ? { employeeId } : {}),
      ...(courseCode ? { courseCode } : {}),
      ...(employeeType ? { employeeType } : {}),
    };

    await prisma.$transaction(async (tx) => {
      await tx.student.update({ where: { id: actor.student.id }, data });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'STUDENT_DIRECTORY_SYNCED',
        resourceType: 'Student',
        resourceId: actor.student.id,
        after: { employeeId: employeeId ?? null, courseCode: courseCode ?? null, employeeType: employeeType ?? null, email: email ?? null },
        requestId: getRequestId(request),
      });
    });

    return NextResponse.json({ synced: true, profile: { employeeId: employeeId ?? null, courseCode: courseCode ?? null, employeeType: employeeType ?? null } });
  } catch (error) {
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}
