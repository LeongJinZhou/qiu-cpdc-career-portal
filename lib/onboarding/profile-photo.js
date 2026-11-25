// Copy a LinkedIn profile photo into our own storage.
//
// LinkedIn's photo URLs are signed and expire after a few weeks, so linking to
// them would leave broken avatars. The URL comes from LinkedIn's userinfo API,
// but the server is still the one fetching it, so the fetch is locked down:
// https only, LinkedIn's media host only, no redirects, images only, small.

const ALLOWED_HOST = /(^|\.)licdn\.com$/i;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// LinkedIn profile photos are small (well under 100 KB). The copy is stored
// inline on the user row and sent in list responses, so it stays small.
const MAX_BYTES = 200 * 1024;

/** Read at most `max` bytes; null as soon as the body is bigger. */
async function readCapped(response, max) {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > max) return null;

  const reader = response.body?.getReader?.();
  if (!reader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length > max ? null : bytes;
  }
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
const TIMEOUT_MS = 8000;

function allowedPhotoUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' && ALLOWED_HOST.test(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<string|null>} a `data:image/...;base64,` URL, or null when
 *   the photo is missing, not allowed, or could not be fetched. Never throws.
 */
export async function fetchProfilePhotoDataUrl(value, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const url = allowedPhotoUrl(value);
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url.toString(), { redirect: 'error', signal: controller.signal });
    if (!response.ok) return null;

    const type = String(response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(type)) return null;

    const bytes = await readCapped(response, MAX_BYTES);
    if (!bytes || bytes.length === 0) return null;

    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
