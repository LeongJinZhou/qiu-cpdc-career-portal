import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveActor } from '@/lib/auth/actor';
import {
  loadManualCv,
  loadStudentProfile,
  toIdentityRouteError,
} from '@/lib/auth/identity';
import { sumStudentXp } from '@/lib/xp-ledger';
import { tierFor } from '@/lib/xp';

/**
 * Live CV source data for the acting student (Module 8): the CV must be built
 * from real database records — approved logbook hours, earned badges, the
 * approved FYP and skill tags — not the fixture arrays it used to read.
 */
export async function GET(request) {
  try {
    const actor = await resolveActor(request);
    const studentId = actor.student.id;

    const [logbook, badges, fyp, xp, courses, profile, manualSections] = await Promise.all([
      prisma.logbookEntry.findMany({
        where: { studentId },
        orderBy: { entryDate: 'desc' },
        include: { approval: { select: { supervisorName: true, decision: true } } },
      }),
      prisma.badge.findMany({ where: { studentId }, orderBy: { awardedAt: 'desc' } }),
      prisma.fYPProject.findUnique({ where: { studentId } }),
      sumStudentXp(studentId),
      prisma.courseEnrolment.findMany({
        where: { studentId, verificationStatus: 'VERIFIED' },
        orderBy: { verifiedAt: 'desc' },
        select: { id: true, title: true, provider: true, skillTag: true, verifiedAt: true, certificateUrl: true },
      }),
      loadStudentProfile(studentId),
      loadManualCv(studentId),
    ]);

    // Only verified (approved) fieldwork counts toward the ATS hours total.
    const verified = logbook.filter(
      (e) => e.status === 'APPROVED' || e.approval?.decision === 'APPROVED',
    );
    const hours = verified.reduce((sum, e) => sum + Number(e.hours || 0), 0);

    return NextResponse.json({
      xp,
      tier: tierFor(xp).name,
      hours,
      skills: actor.student.skillTags ?? [],
      logbookEntries: logbook.map((e) => ({
        id: e.id,
        title: e.title,
        hours: e.hours,
        date: e.entryDate,
        status: e.status,
        supervisor: e.approval?.supervisorName ?? null,
        verified: e.status === 'APPROVED' || e.approval?.decision === 'APPROVED',
      })),
      verifiedLogbookEntries: verified.map((e) => ({
        id: e.id,
        title: e.title,
        details: e.details,
        hours: e.hours,
        date: e.entryDate,
        status: e.status,
        supervisor: e.approval?.supervisorName ?? null,
        verified: true,
      })),
      pendingLogbookEntries: logbook.filter((e) => !verified.includes(e)).map((e) => ({
        id: e.id,
        title: e.title,
        hours: e.hours,
        date: e.entryDate,
        status: e.status,
      })),
      badges: badges.map((b) => ({ id: b.id, title: b.title, category: b.category, xp: b.xp })),
      certifications: courses.map((course) => ({
        id: course.id,
        title: course.title,
        provider: course.provider,
        skillTag: course.skillTag,
        verifiedAt: course.verifiedAt,
        certificateUrl: course.certificateUrl,
      })),
      profile: {
        phone: profile.phone || actor.student.phone || '',
        bio: profile.bio || actor.student.bio || '',
        resumeSummary: profile.resumeSummary || actor.student.resumeSummary || '',
        careerTargets: profile.careerTargets || actor.student.careerTargets || '',
        industries: profile.industries || actor.student.industries || '',
        portfolioUrl: profile.portfolioUrl || actor.student.portfolioUrl || '',
        githubUrl: profile.githubUrl || actor.student.githubUrl || '',
        linkedinUrl: profile.linkedinUrl || actor.student.linkedinUrl || '',
      },
      manualSections,
      fyp: fyp && fyp.status === 'APPROVED'
        ? { title: fyp.title, abstract: fyp.abstract, supervisorName: fyp.supervisorName, status: fyp.status }
        : fyp
          ? { title: fyp.title, status: fyp.status }
          : null,
    });
  } catch (error) {
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}
