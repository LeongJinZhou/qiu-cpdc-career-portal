/**
 * The origin to put in any link a browser, an email or an OAuth provider will
 * follow. Behind Render's proxy request.url holds the internal address
 * (https://localhost:10000), so:
 *   1. APP_BASE_URL   -- set when a custom domain is added;
 *   2. RENDER_EXTERNAL_URL -- set by Render itself (https://<service>.onrender.com);
 *   3. the request's own origin -- local development.
 * Forwarded host headers are not used: the client can set them.
 */
export function publicOrigin(request) {
  const configured = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(request.url).origin;
}
