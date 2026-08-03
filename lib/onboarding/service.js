// Persistence for the first-login flow (Module 1).
//
// The rule this file exists to enforce: a student confirms their details ONCE.
// Every write here is audited, and every read returns the same policy verdict
// the UI and the portal gate use, so no caller can accidentally invent its own
// idea of "done".

import { prisma } from '../prisma.js';
import { createAuditEntry } from '../audit/index.js';
import { ConnectionError, normalizeProfileUrl, probeProfile } from './connections.js';
import {
  ONBOARDING_VERSION,
  PROVIDERS,
  canCompleteOnboarding,
  evaluateOnboarding,
  requiredProvidersFor,
  suggestedProvidersFor,
} from './policy.js';

/** Everything the policy needs, and nothing it does not. */
const ONBOARDING_SELECT = {
  id: true,
  matricNo: true,
  academicYear: true,
  courseCode: true,
  employeeId: true,
  facultyId: true,
  identityConfirmedAt: true,
  onboardingCompletedAt: true,
  onboardingVersion: true,
  faculty: { select: { id: true, name: true, code: true } },
  programme: { select: { id: true, name: true, code: true } },
  connectedAccounts: {
    select: {
      provider: true,
      profileUrl: true,
      handle: true,
      method: true,
      verifiedAt: true,
      brokenAt: true,
    },
  },
};

function describeProvider(id, { connected = null } = {}) {
  const meta = PROVIDERS[id];
  return {
    id,
    label: meta.label,
    reason: meta.reason,
    placeholder: meta.placeholder,
    signUpUrl: meta.signUpUrl,
    profileHelpUrl: meta.profileHelpUrl,
    connected: connected
      ? {
        profileUrl: connected.profileUrl,
        handle: connected.handle,
        method: connected.method,
        verifiedAt: connected.verifiedAt,
        broken: Boolean(connected.brokenAt),
      }
      : null,
  };
}

/**
 * Load the full onboarding state for a student.
 *
 * Returns the shape the onboarding page and the portal gate both consume.
 */
export async function loadOnboardingState(studentId, { prismaClient = prisma } = {}) {
  const student = await prismaClient.student.findUnique({
    where: { id: studentId },
    select: ONBOARDING_SELECT,
  });

  if (!student) return null;

  // The Google directory course code is the authoritative programme signal at
  // first login; fall back to the programme's own code once resolved.
  const programmeCode = student.courseCode ?? student.programme?.code ?? null;
  const verdict = evaluateOnboarding({ ...student, courseCode: programmeCode });
  const byProvider = new Map(student.connectedAccounts.map((a) => [a.provider, a]));

  return {
    student: {
      id: student.id,
      matricNo: student.matricNo,
      employeeId: student.employeeId,
      academicYear: student.academicYear,
      faculty: student.faculty?.name ?? null,
      facultyId: student.facultyId,
      programme: student.programme?.name ?? null,
      programmeCode,
    },
    identityConfirmed: verdict.identityConfirmed,
    complete: verdict.complete,
    needsOnboarding: verdict.needsOnboarding,
    reason: verdict.reason,
    version: ONBOARDING_VERSION,
    // Required first, in ask order; suggestions after. Both carry their current
    // connection so the UI never has to cross-reference two lists.
    required: verdict.required.map((id) => describeProvider(id, { connected: byProvider.get(id) })),
    suggested: suggestedProvidersFor({
      facultyId: student.facultyId,
      programmeCode,
    }).map((id) => describeProvider(id, { connected: byProvider.get(id) })),
    missingProviders: verdict.missingProviders,
    brokenProviders: verdict.brokenProviders,
    canComplete: canCompleteOnboarding({ ...student, courseCode: programmeCode }),
  };
}

/**
 * Record that the student reviewed and accepted their auto-detected identity.
 *
 * Idempotent: confirming twice keeps the ORIGINAL timestamp. That matters --
 * this value is the evidence that the student agreed to the record CPDC holds
 * about them, so it must not silently move.
 */
export async function confirmIdentity(studentId, { actorUserId = null, requestId = null } = {}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.student.findUnique({
      where: { id: studentId },
      select: { identityConfirmedAt: true },
    });

    if (before?.identityConfirmedAt) {
      return { confirmedAt: before.identityConfirmedAt, alreadyConfirmed: true };
    }

    const updated = await tx.student.update({
      where: { id: studentId },
      data: { identityConfirmedAt: new Date() },
      select: { identityConfirmedAt: true },
    });

    await createAuditEntry({
      tx,
      actorUserId,
      action: 'STUDENT_IDENTITY_CONFIRMED',
      resourceType: 'Student',
      resourceId: studentId,
      before: { identityConfirmedAt: null },
      after: { identityConfirmedAt: updated.identityConfirmedAt },
      requestId,
    });

    return { confirmedAt: updated.identityConfirmedAt, alreadyConfirmed: false };
  });
}

/**
 * Attach (or re-attach) a professional account via the verified-URL method.
 *
 * The reachability probe is advisory: a 404 is surfaced as a warning the UI
 * shows, but only an explicit provider rejection blocks. QIU's ability to reach
 * linkedin.com from a server must never decide whether a student can use the
 * portal.
 */
export async function connectAccountByUrl(studentId, providerId, rawUrl, {
  actorUserId = null,
  requestId = null,
  probe = true,
} = {}) {
  if (!PROVIDERS[providerId]) {
    throw new ConnectionError(`Unknown provider: ${providerId}`, 'UNKNOWN_PROVIDER');
  }

  const { profileUrl, handle } = normalizeProfileUrl(providerId, rawUrl);

  let warning = null;
  if (probe) {
    const result = await probeProfile(profileUrl);
    if (result.reachable === false) {
      throw new ConnectionError(
        `We could not find that ${PROVIDERS[providerId].label} profile — it returned "not found". Please check the link and try again.`,
        'PROFILE_NOT_FOUND',
      );
    }
    if (result.reachable === null) {
      warning = `We could not automatically verify the link (${result.note}), so we have saved it as you entered it.`;
    }
  }

  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.connectedAccount.findUnique({
      where: { studentId_provider: { studentId, provider: providerId } },
      select: { profileUrl: true, method: true },
    });

    const account = await tx.connectedAccount.upsert({
      where: { studentId_provider: { studentId, provider: providerId } },
      create: {
        studentId,
        provider: providerId,
        profileUrl,
        handle,
        method: 'VERIFIED_URL',
      },
      update: {
        profileUrl,
        handle,
        method: 'VERIFIED_URL',
        verifiedAt: new Date(),
        // Re-supplying a link clears a previous broken flag.
        brokenAt: null,
      },
    });

    // Keep the legacy Student.linkedinUrl / githubUrl columns in step. They
    // feed the CV, the talent cards and the employer projection, which read
    // those fields directly; letting them drift would mean an employer sees a
    // stale link the student already corrected.
    const mirrored = providerId === 'LINKEDIN'
      ? { linkedinUrl: profileUrl }
      : providerId === 'GITHUB'
        ? { githubUrl: profileUrl }
        : providerId === 'PORTFOLIO'
          ? { portfolioUrl: profileUrl }
          : null;

    if (mirrored) {
      await tx.student.update({ where: { id: studentId }, data: mirrored });
    }

    await createAuditEntry({
      tx,
      actorUserId,
      action: existing ? 'STUDENT_ACCOUNT_RECONNECTED' : 'STUDENT_ACCOUNT_CONNECTED',
      resourceType: 'ConnectedAccount',
      resourceId: account.id,
      before: existing ?? null,
      after: { provider: providerId, profileUrl, method: 'VERIFIED_URL' },
      requestId,
      metadata: { studentId },
    });

    return account;
  });

  return { account: saved, warning };
}

/**
 * Attach an account from a completed provider OAuth consent flow.
 *
 * Same table, stronger claim: `method: 'OAUTH'` and a provider-issued subject
 * id. Recorded distinctly so CPDC reporting can tell a proven connection from a
 * self-asserted one.
 */
export async function connectAccountByOAuth(studentId, providerId, {
  profileUrl,
  handle = null,
  providerUserId,
  rawProfile = null,
  actorUserId = null,
  requestId = null,
} = {}) {
  if (!PROVIDERS[providerId]) {
    throw new ConnectionError(`Unknown provider: ${providerId}`, 'UNKNOWN_PROVIDER');
  }
  if (!providerUserId) {
    throw new ConnectionError('The provider did not return an account id.', 'OAUTH_NO_SUBJECT');
  }

  // Still normalised: an OAuth-sourced URL goes through the same canonical form
  // so an OAuth connection and a pasted one never produce two different strings
  // for the same profile.
  const normalized = profileUrl ? normalizeProfileUrl(providerId, profileUrl) : null;

  return prisma.$transaction(async (tx) => {
    const account = await tx.connectedAccount.upsert({
      where: { studentId_provider: { studentId, provider: providerId } },
      create: {
        studentId,
        provider: providerId,
        profileUrl: normalized?.profileUrl ?? '',
        handle: normalized?.handle ?? handle,
        providerUserId,
        method: 'OAUTH',
        rawProfile,
      },
      update: {
        profileUrl: normalized?.profileUrl ?? '',
        handle: normalized?.handle ?? handle,
        providerUserId,
        method: 'OAUTH',
        rawProfile,
        verifiedAt: new Date(),
        brokenAt: null,
      },
    });

    if (normalized?.profileUrl) {
      const mirrored = providerId === 'LINKEDIN'
        ? { linkedinUrl: normalized.profileUrl }
        : providerId === 'GITHUB'
          ? { githubUrl: normalized.profileUrl }
          : null;
      if (mirrored) {
        await tx.student.update({ where: { id: studentId }, data: mirrored });
      }
    }

    await createAuditEntry({
      tx,
      actorUserId,
      action: 'STUDENT_ACCOUNT_CONNECTED_OAUTH',
      resourceType: 'ConnectedAccount',
      resourceId: account.id,
      after: { provider: providerId, method: 'OAUTH', handle: account.handle },
      requestId,
      metadata: { studentId },
    });

    return account;
  });
}

/**
 * Detach an optional account.
 *
 * A REQUIRED provider cannot be removed -- allowing it would leave the student
 * in a state the gate would immediately bounce them out of, which reads as a
 * bug rather than a policy.
 */
export async function disconnectAccount(studentId, providerId, {
  actorUserId = null,
  requestId = null,
} = {}) {
  const state = await loadOnboardingState(studentId);
  if (!state) throw new ConnectionError('Student not found.', 'NOT_FOUND');

  if (state.required.some((entry) => entry.id === providerId)) {
    throw new ConnectionError(
      `${PROVIDERS[providerId]?.label ?? providerId} is required for your programme, so it cannot be removed. You can replace it with a different profile link instead.`,
      'PROVIDER_REQUIRED',
    );
  }

  return prisma.$transaction(async (tx) => {
    const removed = await tx.connectedAccount.deleteMany({
      where: { studentId, provider: providerId },
    });

    if (removed.count > 0) {
      await createAuditEntry({
        tx,
        actorUserId,
        action: 'STUDENT_ACCOUNT_DISCONNECTED',
        resourceType: 'ConnectedAccount',
        resourceId: `${studentId}:${providerId}`,
        before: { provider: providerId },
        requestId,
        metadata: { studentId },
      });
    }

    return { removed: removed.count };
  });
}

/**
 * Finish onboarding.
 *
 * Refuses unless the policy says every requirement is met -- the server, not
 * the client, decides whether the Continue button was legitimate.
 */
export async function completeOnboarding(studentId, { actorUserId = null, requestId = null } = {}) {
  const state = await loadOnboardingState(studentId);
  if (!state) throw new ConnectionError('Student not found.', 'NOT_FOUND');

  if (!state.identityConfirmed) {
    throw new ConnectionError('Please confirm your profile details first.', 'IDENTITY_UNCONFIRMED');
  }

  if (state.missingProviders.length > 0) {
    const labels = state.missingProviders.map((id) => PROVIDERS[id]?.label ?? id).join(' and ');
    throw new ConnectionError(
      `Please connect your ${labels} account before continuing.`,
      'CONNECTIONS_REQUIRED',
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.student.update({
      where: { id: studentId },
      data: {
        onboardingCompletedAt: new Date(),
        onboardingVersion: ONBOARDING_VERSION,
      },
      select: { onboardingCompletedAt: true, onboardingVersion: true },
    });

    await createAuditEntry({
      tx,
      actorUserId,
      action: 'STUDENT_ONBOARDING_COMPLETED',
      resourceType: 'Student',
      resourceId: studentId,
      after: updated,
      requestId,
      metadata: { connectedProviders: state.required.map((entry) => entry.id) },
    });

    return updated;
  });
}

export { requiredProvidersFor, evaluateOnboarding, ONBOARDING_VERSION };
