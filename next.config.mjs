import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
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
