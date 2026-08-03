'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signOut as firebaseSignOut,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';

import { getFirebaseClientConfig, hasFirebaseClientConfig } from './config.js';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account', hd: 'qiu.edu.my' });
// Read-only directory scope so we can enrich the student record with their QIU
// Employee ID and course after sign-in (Module 16 / People API). The student
// consents once; if they decline, login still works and enrichment is skipped.
provider.addScope('https://www.googleapis.com/auth/directory.readonly');

/** The Google OAuth access token from a sign-in result, if Google returned one. */
function accessTokenFromResult(result) {
  try {
    return GoogleAuthProvider.credentialFromResult(result)?.accessToken ?? null;
  } catch {
    return null;
  }
}

function getFirebaseClientApp() {
  if (!hasFirebaseClientConfig()) {
    throw new Error('Firebase client configuration is missing.');
  }

  if (getApps().length) {
    return getApp();
  }

  return initializeApp(getFirebaseClientConfig());
}

export function getFirebaseBrowserAuth() {
  return getAuth(getFirebaseClientApp());
}

export async function signInWithGoogle() {
  const auth = getFirebaseBrowserAuth();

  try {
    const result = await signInWithPopup(auth, provider);
    return { redirected: false, result, accessToken: accessTokenFromResult(result) };
  } catch (error) {
    const shouldRedirect = ['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/operation-not-supported-in-this-environment']
      .includes(error?.code);

    if (!shouldRedirect) {
      throw error;
    }

    await signInWithRedirect(auth, provider);
    return { redirected: true, result: null };
  }
}

export async function completeGoogleRedirectSignIn() {
  const auth = getFirebaseBrowserAuth();
  const result = await getRedirectResult(auth);
  if (result) result.directoryAccessToken = accessTokenFromResult(result);
  return result;
}

/** End the Firebase browser session as well as the QIU server session. */
export async function signOutGoogle() {
  return firebaseSignOut(getFirebaseBrowserAuth());
}
