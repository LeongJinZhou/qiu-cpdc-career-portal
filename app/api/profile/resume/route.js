import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { requireStudentActor, resolveActor } from '@/lib/auth/actor';
import { requireCapability } from '@/lib/auth/permissions';
import { createAuditEntry } from '@/lib/audit/index.js';
import { getRequestId, parseJsonBody, toIdentityRouteError } from '@/lib/auth/identity';

/**
 * A resume/CV document the student uploads themselves (PDF or Word).
 *
 * This is the student-ASSERTED document. It sits beside the verified auto-CV
 * from /api/cv (approved logbook hours, badges, the approved FYP), never merged
 * into it — an employer must always be able to tell which lines QIU verified.
 *
 * The file is stored inline as a data URL on the Student row (mirroring
 * FYPProject.posterData), so no separate object store is required. The browser
 * reads the file to a data URL and PUTs it here; GET returns metadata only (not
 * the bytes) so a profile page stays light, and DELETE removes it.
 */

// 5 MB of raw file; base64 inflates ~33%, so cap the encoded string accordingly.
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_FILE_BYTES * 4) / 3) + 128;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  fileType: z.string().trim().min(1).max(200),
  dataUrl: z
    .string()
    .trim()
    .min(1)
    .max(MAX_DATA_URL_LENGTH, 'That file is too large. Please upload a resume under 5 MB.')
    .refine((value) => value.startsWith('data:'), 'The uploaded file could not be read. Please choose the file again.'),
});

function authorizeSelfWrite(actor) {
  requireStudentActor(actor);
  if (actor.demo) return; // demo actor is the seeded student; dev-only, never prod
  requireCapability(actor.identity, 'identity.update.self', { userId: actor.user.id });
}

function resumeMeta(student) {
  if (!student?.resumeFileData) return null;
  return {
    fileName: student.resumeFileName,
    fileType: student.resumeFileType,
    // The bytes themselves are fetched only when the student clicks download.
    hasFile: true,
  };
}

export async function GET(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const student = await prisma.student.findUnique({
      where: { id: actor.student.id },
      select: { resumeFileData: true, resumeFileName: true, resumeFileType: true },
    });
    // A `download=1` query returns the raw data URL for the download link.
    const wantsFile = new URL(request.url).searchParams.get('download') === '1';
    if (wantsFile) {
      return NextResponse.json({
        resume: student?.resumeFileData
          ? { fileName: student.resumeFileName, fileType: student.resumeFileType, dataUrl: student.resumeFileData }
          : null,
      });
    }
    return NextResponse.json({ resume: resumeMeta(student) });
  } catch (error) {
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}

export async function PUT(request) {
  try {
    const actor = await resolveActor(request);
    authorizeSelfWrite(actor);

    const { fileName, fileType, dataUrl } = uploadSchema.parse(await parseJsonBody(request));
    if (!ALLOWED_MIME.has(fileType)) {
      return NextResponse.json(
        { error: 'Please upload a PDF or Word document (.doc/.docx).' },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: actor.student.id },
        data: { resumeFileData: dataUrl, resumeFileName: fileName.slice(0, 240), resumeFileType: fileType },
      });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'STUDENT_RESUME_UPLOADED',
        resourceType: 'Student',
        resourceId: actor.student.id,
        after: { fileName: fileName.slice(0, 240), fileType },
        requestId: getRequestId(request),
      });
    });

    return NextResponse.json({ saved: true, resume: { fileName, fileType, hasFile: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Please check the file and try again.' },
        { status: 400 },
      );
    }
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}

export async function DELETE(request) {
  try {
    const actor = await resolveActor(request);
    authorizeSelfWrite(actor);

    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: actor.student.id },
        data: { resumeFileData: null, resumeFileName: null, resumeFileType: null },
      });
      await createAuditEntry({
        tx,
        actorUserId: actor.user.id,
        action: 'STUDENT_RESUME_REMOVED',
        resourceType: 'Student',
        resourceId: actor.student.id,
        requestId: getRequestId(request),
      });
    });

    return NextResponse.json({ saved: true, resume: null });
  } catch (error) {
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}
