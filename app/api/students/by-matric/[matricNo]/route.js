import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, toIdentityRouteError } from '@/lib/auth/identity';
import { requireCapability } from '@/lib/auth/permissions';

/**
 * Resolve a student's database id (plus faculty/programme) from their matric
 * number.
 *
 * The portal shell keeps the signed-in student's `id` in memory as the
 * human-facing matric string (see PortalProvider / DEFAULT_STUDENT), but
 * every other table keys students by their database cuid, which is only
 * assigned at insert time and changes on every reseed. This lookup is the
 * bridge between the two, so callers never have to hardcode a cuid.
 */
export async function GET(request, { params }) {
  let identity;
  try {
    identity = await getAuthenticatedIdentity(request);
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }

  const { matricNo } = await params;

  if (!matricNo) {
    return NextResponse.json({ error: 'matricNo is required' }, { status: 400 });
  }

  let student;
  try {
    student = await prisma.student.findUnique({
      where: { matricNo },
      include: { faculty: true, programme: true },
    });
  } catch {
    // Covers the database being unreachable rather than the record simply
    // not existing, so the client can tell the two apart and show a retry.
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  try {
    requireCapability(identity, 'student.read', {
      studentId: student.id,
      facultyId: student.facultyId,
      programmeId: student.programmeId,
    });
  } catch (error) {
    const routeError = toIdentityRouteError(error);
    return NextResponse.json(
      { error: routeError.message, code: routeError.code },
      { status: routeError.status },
    );
  }

  return NextResponse.json({
    id: student.id,
    matricNo: student.matricNo,
    academicYear: student.academicYear,
    faculty: {
      id: student.faculty.id,
      name: student.faculty.name,
      code: student.faculty.code,
    },
    programme: {
      id: student.programme.id,
      name: student.programme.name,
      level: student.programme.level,
    },
  });
}
