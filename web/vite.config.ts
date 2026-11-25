import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    // E2E_*_PORT let a second checkout run its own stack beside the default one (playwright.config.ts).
    port: Number(process.env.E2E_WEB_PORT ?? 5183),
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8090}` },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.test.{ts,tsx}'],
    },
  },
});
