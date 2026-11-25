import { NextResponse } from 'next/server';

import { requireStudentActor, resolveActor } from '@/lib/auth/actor';
import { requireCapability } from '@/lib/auth/permissions';
import { toIdentityRouteError } from '@/lib/auth/identity';
import { readBodyWithLimit } from '@/lib/http/read-body';
import { parseLinkedInPdfIsolated } from '@/lib/profile/linkedin-pdf-isolated';
import { createRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;
const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

/**
 * POST /api/profile/linkedin-import  (body: the raw PDF, Content-Type application/pdf)
 *
 * Reads the student's own LinkedIn "Save to PDF" export and returns a preview
 * of the fields found. NOTHING is saved here: the student reviews the preview
 * and saves through the normal profile and CV endpoints, which apply their own
 * validation. The file is read in memory, parsed in a capped worker thread,
 * and never stored or logged.
 */
function fail(status, code, message, headers) {
  return NextResponse.json({ error: message, code }, { status, headers });
}

export async function POST(request) {
  try {
    const actor = await resolveActor(request);
    requireStudentActor(actor);
    if (!actor.demo) {
      requireCapability(actor.identity, 'identity.update.self', { userId: actor.user.id });
    }

    const limit = limiter.check(actor.user.id);
    if (!limit.allowed) {
      return fail(429, 'RATE_LIMITED', 'Too many uploads. Wait a minute and try again.', {
        'retry-after': String(Math.ceil(limit.retryAfterMs / 1000)),
      });
    }

    let buffer;
    try {
      buffer = await readBodyWithLimit(request, MAX_BYTES);
    } catch (error) {
      if (error?.status === 413) {
        return fail(413, 'FILE_TOO_LARGE', 'That file is too large. A LinkedIn profile PDF is usually under 1 MB.');
      }
      throw error;
    }
    if (!buffer.length) {
      return fail(400, 'FILE_REQUIRED', 'Choose your LinkedIn profile PDF first.');
    }
    // Check the content, not the name or the browser's claimed type.
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return fail(415, 'NOT_A_PDF', 'That is not a PDF. On LinkedIn, open your profile, choose More, then Save to PDF.');
    }

    let parsed;
    try {
      parsed = await parseLinkedInPdfIsolated(buffer);
    } catch (error) {
      if (error?.code === 'PARSER_BUSY') {
        return fail(503, 'PARSER_BUSY', 'Many students are importing right now. Try again in a few seconds.', { 'retry-after': '5' });
      }
      // The library's message only; never the file's contents.
      console.warn('[linkedin-import] could not read PDF:', error?.message ?? 'Error');
      return fail(422, 'UNREADABLE_PDF', 'We could not read that PDF. Download it again from LinkedIn and try once more.');
    }

    if (!parsed.looksLikeLinkedIn) {
      return fail(422, 'NOT_LINKEDIN_PDF', 'This does not look like a LinkedIn profile PDF. On LinkedIn, open your profile, choose More, then Save to PDF.');
    }

    const { looksLikeLinkedIn, ...preview } = parsed;
    return NextResponse.json({ preview });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json({ error: routeError.message, code: routeError.code }, { status: routeError.status });
  }
}
