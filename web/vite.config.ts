import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  // pdf.js is imported only when a PDF is shown; pre-bundled at start so the first PDF does not reload the page in dev.
  optimizeDeps: { include: ['pdfjs-dist'] },
  server: {
    host: '127.0.0.1',
    // E2E_*_PORT let a second checkout run its own stack beside the default one (playwright.config.ts).
    port: Number(process.env.E2E_WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8080}` },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/testSetup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.test.{ts,tsx}'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
