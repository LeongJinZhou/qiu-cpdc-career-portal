import { createHmac, timingSafeEqual } from 'node:crypto';

import { createAuditEntry } from '../audit/index.js';

import { getSessionSecret, isProduction } from './config.js';
import { verifyGoogleIdToken as defaultVerifyGoogleIdToken } from './firebase-admin.js';

export const AUTH_SESSION_COOKIE = 'qiu_auth_session';
const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function normalizeEmail(email) {
  const trimmed = typeof email === 'string' ? email.trim() : '';
  return trimmed ? trimmed.toLowerCase() : null;
}

function createAuthError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function signPayload(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function parseSignedCookie(value, secret) {
  if (typeof value !== 'string' || !value) {
    return null;
  }

  const [encodedPayload, signature] = value.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }
}

function createSignedCookie(payload, secret) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function buildSafeSessionUser(user) {
  const customPhoto = user.avatarSource === 'CUSTOM' ? (user.avatarUrl ?? null) : null;
  const googlePhoto = user.googleAvatarUrl ?? (user.avatarSource === 'CUSTOM' ? null : user.avatarUrl ?? null);
  return {
    id: user.id,
    email: user.email,
    normalizedEmail: user.normalizedEmail,
    name: user.name,
    role: user.role,
    avatarUrl: customPhoto ?? googlePhoto,
    customAvatarUrl: customPhoto,
    googleAvatarUrl: googlePhoto,
    student: user.student
      ? {
        id: user.student.id,
        facultyId: user.student.facultyId,
        programmeId: user.student.programmeId,
        matricNo: user.student.matricNo,
      }
      : null,
  };
}

function assertSessionEligibleUser(user) {
  if (!user || user.loginAllowed !== true) {
    throw createAuthError(403, 'This Google account is not authorized to access QIU Career Hub.');
  }

  if (user.accountStatus === 'SUSPENDED') {
    throw createAuthError(403, 'This account is suspended.');
  }

  if (!['ACTIVE', 'INVITED'].includes(user.accountStatus)) {
    throw createAuthError(403, 'This account is not active.');
  }
}

export async function authorizeSessionUser({
  prisma,
  verifiedIdentity,
  now = new Date(),
  requestId = null,
}) {
  if (!prisma?.$transaction) {
    throw new TypeError('authorizeSessionUser requires Prisma $transaction access.');
  }

  const normalizedEmail = normalizeEmail(verifiedIdentity?.email);
  if (!verifiedIdentity?.firebaseUid || !normalizedEmail) {
    throw createAuthError(401, 'A verified Firebase identity is required.');
  }

  return prisma.$transaction(async (tx) => {
    const userByFirebase = await tx.user.findUnique({
      where: { firebaseUid: verifiedIdentity.firebaseUid },
      include: {
        student: {
          select: {
            id: true,
            facultyId: true,
            programmeId: true,
            matricNo: true,
          },
        },
      },
    });

    const userByEmail = await tx.user.findUnique({
      where: { normalizedEmail },
      include: {
        student: {
          select: {
            id: true,
            facultyId: true,
            programmeId: true,
            matricNo: true,
          },
        },
      },
    });

    if (userByFirebase && userByEmail && userByFirebase.id !== userByEmail.id) {
      throw createAuthError(409, 'This Google identity conflicts with two QIU records. Ask a Super-Admin to merge the records before signing in.');
    }

    const user = userByFirebase ?? userByEmail;
    if (userByFirebase && userByFirebase.normalizedEmail && userByFirebase.normalizedEmail !== normalizedEmail) {
      throw createAuthError(403, 'This Google email does not match the QIU account linked to it. Ask CPDC to update the allowlisted email.');
    }
    if (userByEmail?.firebaseUid && userByEmail.firebaseUid !== verifiedIdentity.firebaseUid) {
      throw createAuthError(409, 'This QIU email is already linked to a different Google identity. Ask a Super-Admin to review the account link.');
    }

    assertSessionEligibleUser(user);

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        firebaseUid: verifiedIdentity.firebaseUid,
        normalizedEmail,
        lastSignInAt: now,
        identitySource: 'FIREBASE',
        // Keep a user-selected photo across Google sign-ins. The provider
        // photo is refreshed separately and becomes the fallback when the
        // custom photo is cleared in Profile settings.
        googleAvatarUrl: verifiedIdentity.avatarUrl ?? user.googleAvatarUrl ?? null,
        avatarUrl: user.avatarSource === 'CUSTOM' ? user.avatarUrl : null,
        avatarSource: user.avatarSource === 'CUSTOM' ? 'CUSTOM' : 'GOOGLE',
        name: verifiedIdentity.name?.trim() || user.name,
      },
      include: {
        student: {
          select: {
            id: true,
            facultyId: true,
            programmeId: true,
            matricNo: true,
          },
        },
      },
    });

    await createAuditEntry({
      tx,
      actorUserId: user.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'User',
      resourceId: user.id,
      after: {
        firebaseUid: verifiedIdentity.firebaseUid,
        normalizedEmail,
        lastSignInAt: now.toISOString(),
      },
      requestId,
      metadata: {
        source: 'FIREBASE',
      },
    });

    return buildSafeSessionUser(updatedUser);
  });
}

export async function createSessionCookie(idToken, {
  prisma = null,
  secret = getSessionSecret(),
  now = new Date(),
  maxAgeSeconds = DEFAULT_SESSION_MAX_AGE_SECONDS,
  verifyGoogleIdToken = defaultVerifyGoogleIdToken,
  authorizeSessionUser: authorizeSessionUserOverride = authorizeSessionUser,
  requestId = null,
  env = process.env,
} = {}) {
  const verifiedIdentity = await verifyGoogleIdToken(idToken, { env });
  const user = await authorizeSessionUserOverride({
    prisma,
    verifiedIdentity,
    now,
    requestId,
  });

  const expiresAt = new Date(now.getTime() + maxAgeSeconds * 1000).toISOString();
  const payload = {
    user,
    issuedAt: now.toISOString(),
    expiresAt,
  };

  return {
    name: AUTH_SESSION_COOKIE,
    value: createSignedCookie(payload, secret),
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(env),
      path: '/',
      maxAge: maxAgeSeconds,
    },
    user,
  };
}

export async function readSessionCookie(value, {
  secret = getSessionSecret(),
  now = new Date(),
  prisma = null,
} = {}) {
  const payload = parseSignedCookie(value, secret);
  if (!payload) {
    return null;
  }

  const expiresAt = new Date(payload.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
    return null;
  }

  let user = payload.user;

  if (prisma) {
    const currentUser = await prisma.user.findUnique({
      where: { id: payload.user?.id },
      include: {
        student: {
          select: {
            id: true,
            facultyId: true,
            programmeId: true,
            matricNo: true,
          },
        },
      },
    });

    try {
      assertSessionEligibleUser(currentUser);
    } catch {
      return null;
    }

    user = buildSafeSessionUser(currentUser);
  }

  return {
    user,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

export function clearSessionCookie(env = process.env) {
  return {
    name: AUTH_SESSION_COOKIE,
    value: '',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(env),
      path: '/',
      maxAge: 0,
    },
  };
}
