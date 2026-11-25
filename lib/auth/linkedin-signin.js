// Alumni sign-in with LinkedIn.
//
// The QIU Google account closes after graduation; LinkedIn is the account
// graduates keep. During onboarding each student links LinkedIn by signing in
// to it while signed in with QIU Google, which stores LinkedIn's stable
// account id (ConnectedAccount.providerUserId, method OAUTH). That stored link
// is the ONLY way in here:
//   - LinkedIn never creates an account and never matches by email or name;
//   - only the Alumni role may use it (current students and staff use Google,
//     so a compromised LinkedIn cannot open a current account);
//   - the usual suspended / not-allowed checks still apply.

import { createAuditEntry } from '../audit/index.js';
import { assertSessionEligibleUser, buildSafeSessionUser } from './session.js';

const STUDENT_SELECT = { id: true, facultyId: true, programmeId: true, matricNo: true };

function signInError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

/**
 * @returns {Promise<object>} the safe session user for issueSessionCookie.
 * @throws {Error} with .status and .code (LINKEDIN_NOT_LINKED, LINKEDIN_NOT_ALUMNI, ...)
 */
export async function authorizeAlumniLinkedIn({
  prisma,
  linkedinId,
  verifiedEmail = null,
  now = new Date(),
  requestId = null,
}) {
  if (typeof linkedinId !== 'string' || !linkedinId.trim()) {
    throw signInError(401, 'LINKEDIN_NO_ID', 'LinkedIn did not identify the account.');
  }

  return prisma.$transaction(async (tx) => {
    const accounts = await tx.connectedAccount.findMany({
      where: { provider: 'LINKEDIN', providerUserId: linkedinId.trim(), method: 'OAUTH' },
      include: { student: { include: { user: { include: { student: { select: STUDENT_SELECT } } } } } },
      take: 2,
    });
    // Linking refuses duplicates; a duplicate from before that rule is never
    // guessed between.
    if (accounts.length > 1) {
      throw signInError(409, 'LINKEDIN_AMBIGUOUS', 'This LinkedIn account is linked to more than one QIU record. Please contact CPDC.');
    }

    const user = accounts[0]?.student?.user ?? null;
    if (!user) {
      throw signInError(403, 'LINKEDIN_NOT_LINKED', 'This LinkedIn account is not linked to a QIU Career Hub account.');
    }
    if (user.role !== 'ALUMNI') {
      throw signInError(403, 'LINKEDIN_NOT_ALUMNI', 'LinkedIn sign-in is for alumni. Please sign in with your QIU Google account.');
    }
    try {
      assertSessionEligibleUser(user);
    } catch (error) {
      throw signInError(403, 'LINKEDIN_ACCOUNT_BLOCKED', error.message);
    }

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        lastSignInAt: now,
        linkedinLastSeenAt: now,
        ...(verifiedEmail ? { personalEmail: verifiedEmail } : {}),
      },
      include: { student: { select: STUDENT_SELECT } },
    });

    await createAuditEntry({
      tx,
      actorUserId: user.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'User',
      resourceId: user.id,
      after: { lastSignInAt: now.toISOString() },
      requestId,
      metadata: { source: 'LINKEDIN' },
    });

    return buildSafeSessionUser(updated);
  });
}
