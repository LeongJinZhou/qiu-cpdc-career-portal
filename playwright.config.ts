import { defineConfig } from '@playwright/test';

// Three servers: the PHP API and the fake Google/LinkedIn (both through tools/php-dev-server.mjs), and Vite, which
// proxies /api to the API. E2E_*_PORT move them so a second checkout can run beside the default stack.
const api = process.env.E2E_API_PORT ?? '8090';
const fakes = process.env.E2E_FAKES_PORT ?? '8091';
const web = process.env.E2E_WEB_PORT ?? '5183';

export default defineConfig({
  testDir: 'e2e',
  // One shared database: specs run one after another.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${web}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: `node tools/php-dev-server.mjs ${api} api/public/index.php`,
      url: `http://127.0.0.1:${api}/api/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node tools/php-dev-server.mjs ${fakes} api/tests/fakes/server.php`,
      url: `http://127.0.0.1:${fakes}/google/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev:web',
      url: `http://127.0.0.1:${web}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
