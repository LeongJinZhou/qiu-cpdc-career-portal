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

export function getFirebaseClientConfig({ env = process.env } = {}) {
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

export function hasFirebaseClientConfig({ env = process.env } = {}) {
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
