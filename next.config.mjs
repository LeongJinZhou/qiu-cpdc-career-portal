import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production';
const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'qiu-cpdc-career-portal.firebaseapp.com';

// Firebase Google sign-in needs: the gapi script (apis.google.com), the auth
// iframe on the Firebase auth domain, and token calls to Google APIs.
// 'unsafe-inline' scripts are required by Next's inline bootstrap without a
// nonce middleware; dev also needs 'unsafe-eval' and the HMR websocket.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://apis.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://${firebaseAuthDomain}${isDev ? ' ws:' : ''}`,
  `frame-src https://${firebaseAuthDomain} https://accounts.google.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  reactStrictMode: true,
  // Locally: bind tracing root to __dirname to avoid external parent directory lockfile scanning.
  // In Google Cloud Build (CI=true or Cloud Run): remove restriction to allow tracing across Cloud Native Buildpack layers (/layers/...).
  outputFileTracingRoot: process.env.CI || process.env.FIREBASE_APP_HOSTING ? undefined : __dirname,
  // A production build normally clears and rewrites `.next`, which corrupts any
  // `next dev` server sharing that directory -- chunks vanish mid-request and
  // the running app starts throwing "Cannot find module './1234.js'". Setting
  // NEXT_DIST_DIR lets a verification build write somewhere else entirely, so a
  // build and a dev server can coexist. Unset, behaviour is unchanged.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
