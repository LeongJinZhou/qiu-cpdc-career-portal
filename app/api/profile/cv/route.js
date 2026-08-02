import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireStudentActor, resolveActor } from '@/lib/auth/actor';
import {
  getRequestId,
  loadManualCv,
  parseManualCvBody,
  saveManualCv,
  toIdentityRouteError,
} from '@/lib/auth/identity';
import { requireCapability } from '@/lib/auth/permissions';

/**
 * The manual half of the CV: work experience, volunteering and achievements a
 * student types in themselves.
 *
 * The auto-populated half (approved logbook hours, earned badges, the approved
 * FYP, course-derived skill tags) comes from /api/cv and is deliberately NOT
 * writable here. That split is the trust mechanism the whole CV rests on: an
 * employer must be able to tell at a glance which lines QIU verified and which
 * the student asserted. Every entry stored here is stamped source: 'MANUAL' by
 * the server, and the flag is never read from the request body.
 */

function authorizeSelfCvWrite(actor) {
  requireStudentActor(actor);

  if (actor.demo) {
    // Dev-only path; the demo actor IS the seeded student, so the write is
    // already scoped to them. Demo mode cannot run in production.
    return;
  }

  requireCapability(actor.identity, 'identity.update.self', { userId: actor.user.id });
}

export async function GET(request) {
  try {
    const actor = await resolveActor(request);
    requireStudentActor(actor);

    return NextResponse.json({ sections: await loadManualCv(actor.student.id) });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }
}

export async function PUT(request) {
  try {
    const actor = await resolveActor(request);
    authorizeSelfCvWrite(actor);

    const sections = await parseManualCvBody(request);
    const saved = await saveManualCv(actor.student.id, sections, {
      actorUserId: actor.user.id,
      requestId: getRequestId(request),
    });

    return NextResponse.json({ saved: true, sections: saved });
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
