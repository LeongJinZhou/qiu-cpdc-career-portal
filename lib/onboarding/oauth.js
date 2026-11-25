// Provider OAuth for the connect-your-professional-account step.
//
// Design note, and the reason this file is short: OAuth here is an UPGRADE, not
// a gate. The verified-URL path in connections.js already satisfies the
// university's requirement, so nothing in the student flow breaks while these
// credentials are absent. `isConfigured()` is what the UI asks before it offers
// a "Sign in with …" button, and every route below refuses cleanly when the
// answer is no. There is no half-working state.
//
// What each provider actually gives us differs, and the difference is not
// cosmetic:
//
//   GitHub  -- /user returns `html_url` and `login`, so an OAuth connection is
//              complete on its own: verified identity AND the public URL.
//   LinkedIn -- OpenID Connect userinfo returns only `sub`, `name`, `email`.
//              It proves the account belongs to this student, but LinkedIn does
//              not expose the public vanity URL through it at all. So a
//              LinkedIn OAuth connection is stored verified-but-URL-less, and
//              the flow still asks for the public link (now pre-verified as
//              theirs). Claiming otherwise would be inventing a capability.

import crypto from 'node:crypto';

export const OAUTH_PROVIDERS = Object.freeze({
  LINKEDIN: {
    id: 'LINKEDIN',
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile email',
    // LinkedIn cannot supply the public profile URL; the flow still collects it.
    yieldsProfileUrl: false,
  },
  GITHUB: {
    id: 'GITHUB',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    // read:user only. We never ask for repo scope: the platform reads a public
    // profile, it does not need access to a student's code.
    scope: 'read:user',
    yieldsProfileUrl: true,
  },
});

export function isConfigured(providerId) {
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider) return false;
  // SESSION_SECRET is part of being configured, not an afterthought: without it
  // the CSRF state cannot be signed, so offering the button would present a
  // student with a flow guaranteed to fail at the callback.
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  return Boolean(process.env[provider.clientIdEnv] && process.env[provider.clientSecretEnv]);
}

/** Which providers currently offer a real "Sign in with …" button. */
export function configuredProviders() {
  return Object.keys(OAUTH_PROVIDERS).filter(isConfigured);
}

export function redirectUri(providerId, request) {
  const base = process.env.APP_BASE_URL || new URL(request.url).origin;
  return `${base.replace(/\/$/, '')}/api/onboarding/oauth/${providerId.toLowerCase()}/callback`;
}

/**
 * The signing key for OAuth CSRF state, which is bound to the student id so a
 * callback cannot be replayed into a different student's account -- the classic
 * OAuth account-linking attack.
 *
 * This used to fall back to a hardcoded literal when SESSION_SECRET was unset,
 * which is worse than useless: the state token would still look signed while
 * being forgeable by anyone who has read this open-source file. A missing
 * secret must fail loudly at the point of use, not silently downgrade the
 * protection that stops one student's OAuth callback being replayed into
 * another student's account.
 */
function stateSigningKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be set (32+ chars) before OAuth account linking can be used. '
      + 'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return secret;
}

export function createState(studentId) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${studentId}.${Date.now()}.${nonce}`;
  const mac = crypto
    .createHmac('sha256', stateSigningKey())
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}.${mac}`).toString('base64url');
}

export function verifyState(state, studentId, { maxAgeMs = 10 * 60 * 1000 } = {}) {
  try {
    const decoded = Buffer.from(String(state), 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 4) return false;

    const [subject, issuedAt, nonce, mac] = parts;
    const expected = crypto
      .createHmac('sha256', stateSigningKey())
      .update(`${subject}.${issuedAt}.${nonce}`)
      .digest('hex');

    const macBuf = Buffer.from(mac, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf)) return false;
    if (subject !== studentId) return false;
    return Date.now() - Number(issuedAt) < maxAgeMs;
  } catch {
    return false;
  }
}

export function authorizeUrl(providerId, { state, request }) {
  const provider = OAUTH_PROVIDERS[providerId];
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', process.env[provider.clientIdEnv]);
  url.searchParams.set('redirect_uri', redirectUri(providerId, request));
  url.searchParams.set('scope', provider.scope);
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeCode(providerId, code, request) {
  const provider = OAUTH_PROVIDERS[providerId];
  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env[provider.clientIdEnv],
      client_secret: process.env[provider.clientSecretEnv],
      redirect_uri: redirectUri(providerId, request),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Token exchange failed');
  }
  return payload.access_token;
}

/**
 * Complete the flow and return a normalised profile.
 *
 * @returns {Promise<{providerUserId: string, handle: string|null,
 *                    profileUrl: string|null, name: string|null, raw: object}>}
 */
export async function fetchOAuthProfile(providerId, code, request) {
  const provider = OAUTH_PROVIDERS[providerId];
  const accessToken = await exchangeCode(providerId, code, request);

  const response = await fetch(provider.userInfoUrl, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: providerId === 'GITHUB' ? 'application/vnd.github+json' : 'application/json',
      'user-agent': 'QIU-CPDC-Platform/1.0',
    },
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(raw.message || `${provider.id} profile request failed`);
  }

  // `raw` keeps only the identity fields we use: the stored copy must not grow
  // into a second profile store.
  if (providerId === 'GITHUB') {
    return {
      providerUserId: raw.id != null ? String(raw.id) : null,
      handle: raw.login ?? null,
      profileUrl: raw.html_url ?? (raw.login ? `https://github.com/${raw.login}` : null),
      name: raw.name ?? raw.login ?? null,
      pictureUrl: null,
      raw: { id: raw.id ?? null, login: raw.login ?? null, name: raw.name ?? null, html_url: raw.html_url ?? null },
    };
  }

  // LinkedIn OpenID Connect: sub, name, email and photo only, by design.
  return {
    providerUserId: raw.sub ?? null,
    handle: null,
    profileUrl: null,
    name: raw.name ?? null,
    pictureUrl: raw.picture ?? null,
    raw: {
      sub: raw.sub ?? null,
      name: raw.name ?? null,
      given_name: raw.given_name ?? null,
      family_name: raw.family_name ?? null,
      email: raw.email ?? null,
      email_verified: raw.email_verified ?? null,
      locale: raw.locale ?? null,
    },
  };
}
