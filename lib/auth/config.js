const AUTH_MODE_FIREBASE = 'firebase-google';
const AUTH_MODE_DEMO = 'demo';

export const AUTH_MODES = [AUTH_MODE_FIREBASE, AUTH_MODE_DEMO];

export function isProduction(env = process.env) {
  return env.NODE_ENV === 'production';
}

export function getAuthMode({ env = process.env } = {}) {
  const configuredMode = env.AUTH_MODE?.trim() || AUTH_MODE_FIREBASE;

  if (!AUTH_MODES.includes(configuredMode)) {
    throw new Error(`Unsupported AUTH_MODE "${configuredMode}". Expected one of: ${AUTH_MODES.join(', ')}`);
  }

  const deployment = env.NODE_ENV?.trim();
  if (configuredMode === AUTH_MODE_DEMO && deployment && deployment !== 'development') {
    throw new Error('AUTH_MODE=demo is allowed only for local development.');
  }

  return configuredMode;
}

export function getPublicAuthMode(env) {
  // On the client, Next.js only inlines *direct* `process.env.NEXT_PUBLIC_*`
  // references — an aliased read (`env.NEXT_PUBLIC_AUTH_MODE` where
  // `env = process.env`) is NOT replaced and resolves to undefined in the
  // browser bundle. So when no explicit env is passed we read the public var
  // directly here; callers (and tests) can still inject an env object.
  const source = env ?? {
    NEXT_PUBLIC_AUTH_MODE: process.env.NEXT_PUBLIC_AUTH_MODE,
    AUTH_MODE: process.env.AUTH_MODE,
  };
  const configuredMode = source.NEXT_PUBLIC_AUTH_MODE?.trim();
  return configuredMode || source.AUTH_MODE?.trim() || AUTH_MODE_FIREBASE;
}

/**
 * Build-time snapshot of the public Firebase keys.
 *
 * This exists because of a subtle and total failure mode. Next.js inlines
 * `process.env.NEXT_PUBLIC_*` into the browser bundle ONLY when it appears as a
 * literal member expression. Reading it through a variable -- which is what
 * `getFirebaseClientConfig({ env = process.env })` did, via
 * `env.NEXT_PUBLIC_FIREBASE_API_KEY` -- is a dynamic lookup webpack cannot
 * statically replace. The keys were therefore never emitted into the client
 * bundle at all, every value read back `undefined`, and the login page reported
 * "Google sign-in is not switched on yet" no matter how correctly `.env` was
 * filled in. Server-side rendering worked, which is what made it so easy to
 * miss: the failure was browser-only and silent.
 *
 * Writing each key out literally is what makes the inlining happen. Do not
 * refactor this into a loop or a spread -- that would reintroduce the bug.
 */
const PUBLIC_FIREBASE_ENV = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

export function getFirebaseClientConfig({ env = PUBLIC_FIREBASE_ENV } = {}) {
  const config = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
  };

  return config;
}

export function hasFirebaseClientConfig({ env = PUBLIC_FIREBASE_ENV } = {}) {
  const config = getFirebaseClientConfig({ env });
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function getFirebaseAdminConfig({ env = process.env } = {}) {
  return {
    projectId: env.FIREBASE_PROJECT_ID?.trim() || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'qiu-cpdc-career-portal',
    clientEmail: env.FIREBASE_CLIENT_EMAIL?.trim() || null,
    privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')?.trim() || null,
  };
}

export function hasFirebaseAdminConfig({ env = process.env } = {}) {
  const config = getFirebaseAdminConfig({ env });
  return Boolean(config.projectId || (config.clientEmail && config.privateKey));
}

export function getSessionSecret({ env = process.env } = {}) {
  const secret = env.SESSION_SECRET?.trim();

  if (!secret) {
    const error = new Error('SESSION_SECRET is required for secure auth sessions.');
    error.status = 503;
    error.code = 'AUTH_CONFIGURATION_REQUIRED';
    throw error;
  }

  return secret;
}
