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
provider.setCustomParameters({ prompt: 'select_account' });

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
    return { redirected: false, result };
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
  return getRedirectResult(auth);
}

/** End the Firebase browser session as well as the QIU server session. */
export async function signOutGoogle() {
  return firebaseSignOut(getFirebaseBrowserAuth());
}
