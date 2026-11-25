import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Three servers, no helper scripts: PHP API, fake Google/OpenAI, Vite (proxies /api to the PHP API).
// E2E_API_PORT, E2E_FAKES_PORT and E2E_WEB_PORT move them, so a second checkout can run beside the default stack;
// then also set APP_URL and the GOOGLE_* and OPENAI_BASE URLs to those ports.
const api = process.env.E2E_API_PORT ?? '8080';
const fakes = process.env.E2E_FAKES_PORT ?? '8081';
const web = process.env.E2E_WEB_PORT ?? '5173';
// The mail sink (api/tests/fakes/smtp-sink.php): the API sends its email there; e2e/mail.ts reads what arrived.
const smtp = process.env.E2E_SMTP_PORT ?? '2525';

// The local .env as KEY=value pairs (the real environment wins, as in api/src/Env.php).
const dotenv: Record<string, string> = existsSync('.env')
  ? Object.fromEntries(
      readFileSync('.env', 'utf8')
        .split(/\r?\n/)
        .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => [m[1], m[2]]),
    )
  : {};
const envOf = (name: string): string | undefined => process.env[name] ?? dotenv[name];

// The people source e2e reads the fake university tables that api/bin/seed.php writes (api/tests/FakePeopleSource.php):
// PEOPLE_DB_* when set, else the app's own test database and user, as FakePeopleSource::configure() does. No real
// credentials: only what .env (or the CI copy of .env.example) already holds for the test database.
const FAKE_PEOPLE_MAP = {
  students: { table: 'ext_students', email: 'email_addr', name: 'full_name', matric_no: 'student_no', programme: 'programme_name', mentor: 'advisor_email', where: { status: 'active' } },
  staff: { table: 'ext_staff', email: 'email_addr', name: 'full_name', employee_id: 'staff_no', department: 'dept', job_title: 'title' },
  mentor_match: 'email',
};
const peopleSource: Record<string, string> = { PEOPLE_DB_MAP: JSON.stringify(FAKE_PEOPLE_MAP) };
for (const part of ['HOST', 'PORT', 'NAME', 'USER', 'PASSWORD']) {
  const value = envOf(`PEOPLE_DB_${part}`) ?? envOf(`DB_${part}`);
  if (value !== undefined) peopleSource[`PEOPLE_DB_${part}`] = value;
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // shortcut: parallel browsers hang the local Windows dev stack (cause unknown), so local runs are serial; CI (Linux) stays parallel.
  workers: process.env.CI ? undefined : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${web}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: `php -S 127.0.0.1:${api} -t api/public api/public/index.php`,
      url: `http://127.0.0.1:${api}/api/health`,
      reuseExistingServer: !process.env.CI,
      // The AI features talk to the fake OpenAI (E2E_FAKES_PORT) with a fake key; the real environment wins over .env.
      env: {
        OPENAI_BASE: `http://127.0.0.1:${fakes}/openai`,
        OPENAI_API_KEY: 'fake-e2e-key',
        ...peopleSource,
        // Email on, into the local sink only (no login: the sink is a test fake on 127.0.0.1).
        MAILER_DSN: `smtp://127.0.0.1:${smtp}`,
        MAIL_FROM: 'orientation@example.test',
        MAIL_FROM_NAME: 'QIU Student Life',
        // Connecting a Google account for mail (round 8): the fake Google's Gmail, and a key for tests only.
        GOOGLE_GMAIL_BASE: `http://127.0.0.1:${fakes}/google/gmail`,
        MAIL_TOKEN_KEY: Buffer.from('e2e-only key, not a real secret!').toString('base64'),
      },
    },
    {
      command: `php api/tests/fakes/smtp-sink.php ${smtp}`,
      port: Number(smtp),
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `php -S 127.0.0.1:${fakes} api/tests/fakes/server.php`,
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
