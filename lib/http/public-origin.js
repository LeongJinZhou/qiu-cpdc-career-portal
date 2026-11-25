/**
 * The origin to put in any link a browser, an email or an OAuth provider will
 * follow. Behind Render's proxy request.url holds the internal address
 * (https://localhost:10000), so:
 *   1. APP_BASE_URL   -- set when a custom domain is added;
 *   2. RENDER_EXTERNAL_URL -- set by Render itself (https://<service>.onrender.com);
 *   3. the request's own origin -- local development.
 * Forwarded host headers are not used: the client can set them.
 * A setting that is not a full http(s) URL is skipped with one log line,
 * rather than producing broken links everywhere.
 */
const warned = new Set();

function originOf(name) {
  const value = process.env[name]?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
  } catch {
    // fall through to the warning
  }
  if (!warned.has(name)) {
    warned.add(name);
    console.error(`[config] ${name} must be a full URL such as https://example.com; ignoring it.`);
  }
  return null;
}

export function publicOrigin(request) {
  return originOf('APP_BASE_URL') ?? originOf('RENDER_EXTERNAL_URL') ?? new URL(request.url).origin;
}
