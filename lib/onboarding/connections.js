// Validation and normalisation for student-supplied professional profile URLs.
//
// This is the half of the connect flow that works without any provider
// credentials. It is deliberately strict about SHAPE (it must be a personal
// profile on the right host) and honest about TRUST (it is student-asserted;
// the stored ConnectionMethod records that distinction).
//
// Pure functions only -- no network, no Prisma -- so every branch is unit
// testable. The optional reachability probe lives in `probeProfile` and is
// always best-effort: a network failure must never block a student from
// finishing onboarding, because that would make QIU's own uptime a precondition
// for a student using the portal.

import { PROVIDERS } from './policy.js';

export class ConnectionError extends Error {
  constructor(message, code = 'INVALID_PROFILE_URL') {
    super(message);
    this.name = 'ConnectionError';
    this.code = code;
  }
}

/** Strip the tracking noise LinkedIn/GitHub append to shared links. */
function stripTracking(url) {
  const drop = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'trk', 'trkInfo', 'originalSubdomain', 'miniProfileUrn', 'lipi', 'ref', 'ref_src',
  ];
  drop.forEach((key) => url.searchParams.delete(key));
  return url;
}

/**
 * Normalise a profile URL to one canonical form.
 *
 * Accepts what students actually paste: no scheme, a `www.` prefix, a country
 * subdomain (`my.linkedin.com`), a trailing slash, a share tracker. Rejects
 * anything that is not a personal profile on that provider's host.
 *
 * @param {string} providerId
 * @param {string} raw
 * @returns {{profileUrl: string, handle: string|null}}
 */
export function normalizeProfileUrl(providerId, raw) {
  const provider = PROVIDERS[providerId];
  if (!provider) {
    throw new ConnectionError(`Unknown provider: ${providerId}`, 'UNKNOWN_PROVIDER');
  }

  const input = typeof raw === 'string' ? raw.trim() : '';
  if (!input) {
    throw new ConnectionError(`Please paste your ${provider.label} profile link.`, 'EMPTY');
  }

  // Students paste "linkedin.com/in/x" far more often than a full URL.
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ConnectionError(
      `That does not look like a link. It should start with https:// — for example ${provider.placeholder}`,
    );
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ConnectionError('Only http and https links are accepted.');
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (provider.hostnames) {
    const allowed = provider.hostnames.map((h) => h.replace(/^www\./, ''));
    // Accept LinkedIn's country subdomains (my.linkedin.com, uk.linkedin.com)
    // by matching on the registrable suffix rather than the literal host.
    const matches = allowed.some((base) => host === base || host.endsWith(`.${base}`));
    if (!matches) {
      throw new ConnectionError(
        `That link is not on ${provider.label}. It should look like ${provider.placeholder}`,
        'WRONG_HOST',
      );
    }
    // Canonicalise the host so my.linkedin.com and www.linkedin.com are one row.
    // The FIRST entry in `hostnames` is the canonical form -- not "the www one",
    // because github.com and orcid.org canonicalise without the www prefix.
    url.hostname = provider.hostnames[0];
  }

  url.protocol = 'https:';
  url.hash = '';
  stripTracking(url);

  // Trailing slash off, so /in/name and /in/name/ do not become two accounts.
  let pathname = url.pathname.replace(/\/+$/, '') || '/';
  // LinkedIn localises the profile path (/in/x vs /mwlite/in/x on mobile share).
  pathname = pathname.replace(/^\/mwlite/, '');
  url.pathname = pathname;

  if (provider.pathPattern && !provider.pathPattern.test(pathname)) {
    throw new ConnectionError(
      providerId === 'LINKEDIN'
        ? 'That is not a personal LinkedIn profile link. Open your profile and copy the link that contains "/in/" — a company or school page will not work.'
        : providerId === 'GITHUB'
          ? 'That is not a GitHub profile link. Use your account page (github.com/your-username), not a repository link.'
          : `That does not look like a ${provider.label} profile link. It should look like ${provider.placeholder}`,
      'WRONG_PATH',
    );
  }

  const handle = pathname === '/' ? null : decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '') || null;

  return { profileUrl: url.toString().replace(/\/$/, ''), handle };
}

/**
 * Best-effort reachability check.
 *
 * Never throws and never blocks: it returns a verdict the caller may record and
 * show as a warning. LinkedIn in particular serves 999/403 to unauthenticated
 * automated requests, so a non-200 is explicitly NOT treated as "does not
 * exist" -- only an unambiguous 404/410 is.
 *
 * @returns {Promise<{reachable: boolean|null, status: number|null, note: string}>}
 */
export async function probeProfile(profileUrl, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(profileUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'QIU-CPDC-Platform/1.0 (profile link check)' },
    });

    if (response.status === 404 || response.status === 410) {
      return { reachable: false, status: response.status, note: 'Profile not found' };
    }
    if (response.ok) {
      return { reachable: true, status: response.status, note: 'OK' };
    }
    // 403/429/999: the provider is blocking the probe, not denying the profile.
    return {
      reachable: null,
      status: response.status,
      note: 'Provider blocked the check; link accepted on its shape',
    };
  } catch (error) {
    return {
      reachable: null,
      status: null,
      note: error?.name === 'AbortError' ? 'Check timed out' : 'Check failed',
    };
  } finally {
    clearTimeout(timer);
  }
}
