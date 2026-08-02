import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveActor } from '@/lib/auth/actor';
import {
  getRequestId,
  loadStudentProfile,
  normalizeProfilePatch,
  normalizeStudentProfilePatch,
  parseProfilePatchBody,
  saveStudentProfile,
  toIdentityRouteError,
  updateOwnProfile,
  LOCKED_IDENTITY_FIELDS,
} from '@/lib/auth/identity';
import { requireCapability } from '@/lib/auth/permissions';

/**
 * Self-service personal details.
 *
 * Two storage layers sit behind one endpoint so the UI has a single save
 * button: the display name and photo live on the User row, and everything the
 * student writes about their career (bio, targets, industries, skills, links)
 * lives in the scoped profile document — see the STORAGE NOTE in
 * lib/auth/identity.js.
 *
 * Authorization is server-side and does not trust the client at all:
 *   - `resolveActor` yields the signed-in identity, or (local dev only, refused
 *     in production by getAuthMode) the seeded demo student.
 *   - `requireCapability(identity, 'identity.update.self', { userId })` proves
 *     the caller is writing their own record and nobody else's.
 *   - locked registry fields (faculty / programme / year / matric / email /
 *     role) are rejected with 403 before validation. Changing those is a
 *     SUPER_ADMIN action on app/api/admin/users, never a self-service one.
 */

function authorizeSelfWrite(actor) {
  if (actor.demo) {
    // Demo mode has no session cookie and therefore no capability set. It is
    // dev-only (getAuthMode throws for AUTH_MODE=demo outside development), and
    // the actor is always the seeded student, so a self-write is by definition
    // scoped to that same student.
    return;
  }

  requireCapability(actor.identity, 'identity.update.self', { userId: actor.user.id });
}

export async function GET(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    const profile = actor.student ? await loadStudentProfile(actor.student.id) : null;

    return NextResponse.json({
      user: {
        id: actor.user.id,
        name: actor.user.name,
        email: actor.user.email,
        role: actor.role,
        avatarUrl: actor.identity?.user?.avatarUrl ?? actor.user.avatarUrl ?? null,
        customAvatarUrl: actor.identity?.user?.customAvatarUrl ?? null,
        googleAvatarUrl: actor.identity?.user?.googleAvatarUrl ?? null,
      },
      student: actor.student
        ? {
          id: actor.student.id,
          matricNo: actor.student.matricNo,
          academicYear: actor.student.academicYear,
          faculty: actor.student.faculty?.name ?? null,
          facultyCode: actor.student.faculty?.code ?? null,
          programme: actor.student.programme?.name ?? null,
          verifiedSkillTags: actor.student.skillTags ?? [],
        }
        : null,
      profile,
      // Told to the UI so it can render these as read-only with an explanation
      // rather than letting a student type into a field that will be refused.
      lockedFields: LOCKED_IDENTITY_FIELDS,
      demo: actor.demo,
    });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}

export async function PATCH(request) {
  try {
    const actor = await resolveActor(request, { allowNonStudent: true });
    authorizeSelfWrite(actor);

    const body = await parseProfilePatchBody(request);
    const userPatch = normalizeProfilePatch(body);
    const profilePatch = normalizeStudentProfilePatch(body);
    const requestId = getRequestId(request);

    if (Object.keys(profilePatch).length > 0 && !actor.student) {
      return NextResponse.json(
        {
          error: 'Career profile details can only be saved on a student account.',
          code: 'STUDENT_CONTEXT_REQUIRED',
        },
        { status: 403 },
      );
    }

    let identity = actor.identity ?? null;
    if (Object.keys(userPatch).length > 0) {
      identity = await updateOwnProfile(actor.user.id, userPatch, { requestId });
    }

    const profile = actor.student
      ? Object.keys(profilePatch).length > 0
        ? await saveStudentProfile(actor.student.id, profilePatch, {
          actorUserId: actor.user.id,
          requestId,
        })
        : await loadStudentProfile(actor.student.id)
      : null;

    return NextResponse.json({
      saved: true,
      user: {
        id: actor.user.id,
        name: identity?.user?.name ?? userPatch.name ?? actor.user.name,
        email: actor.user.email,
        role: actor.role,
        avatarUrl: identity?.user?.avatarUrl ?? actor.user.avatarUrl ?? null,
        customAvatarUrl: identity?.user?.customAvatarUrl ?? null,
        googleAvatarUrl: identity?.user?.googleAvatarUrl ?? null,
      },
      profile,
      identity,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Please check the highlighted field and try again.' },
        { status: 400 },
      );
    }

    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}
