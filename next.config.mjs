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
};

export default nextConfig;
