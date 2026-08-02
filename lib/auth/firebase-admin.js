import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import { getFirebaseAdminConfig, hasFirebaseAdminConfig } from './config.js';

function createAuthError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getFirebaseAdminApp({ env = process.env } = {}) {
  if (!hasFirebaseAdminConfig({ env })) {
    throw new Error('Firebase Admin credentials are not configured.');
  }

  if (getApps().length) {
    return getApp();
  }

  const config = getFirebaseAdminConfig({ env });

  return initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey,
    }),
  });
}

export function assertGoogleSignInProvider(decodedToken) {
  if (decodedToken?.firebase?.sign_in_provider !== 'google.com') {
    throw createAuthError(401, 'Only Google Firebase sign-in is allowed.');
  }
}

export async function verifyGoogleIdToken(idToken, { env = process.env } = {}) {
  if (typeof idToken !== 'string' || !idToken.trim()) {
    throw createAuthError(401, 'A Firebase ID token is required.');
  }

  try {
    const decodedToken = await getAuth(getFirebaseAdminApp({ env })).verifyIdToken(idToken, true);
    const email = decodedToken.email?.trim();
    assertGoogleSignInProvider(decodedToken);

    if (!decodedToken.uid || !email || decodedToken.email_verified !== true) {
      throw createAuthError(401, 'The Firebase identity token is missing a verified email.');
    }

    return {
      firebaseUid: decodedToken.uid,
      email,
      name: decodedToken.name?.trim() || email,
      avatarUrl: decodedToken.picture?.trim() || null,
    };
  } catch (error) {
    if (error?.status) {
      throw error;
    }

    const authError = new Error('Unable to verify the Firebase identity token.');
    authError.status = 401;
    authError.cause = error;
    throw authError;
  }
}
