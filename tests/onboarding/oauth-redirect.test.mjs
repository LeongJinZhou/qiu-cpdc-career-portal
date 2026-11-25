import test from 'node:test';
import assert from 'node:assert/strict';

import { alumniContactEmail, redirectUri } from '../../lib/onboarding/oauth.js';

test('the alumni contact email is a LinkedIn-verified, non-QIU address', () => {
  assert.equal(alumniContactEmail({ email: ' Aina@Gmail.com ', email_verified: true }), 'aina@gmail.com');
  // Closes at graduation: never kept as the personal email.
  assert.equal(alumniContactEmail({ email: 'aina@qiu.edu.my', email_verified: true }), null);
  assert.equal(alumniContactEmail({ email: 'aina@student.qiu.edu.my', email_verified: true }), null);
  // Not verified by LinkedIn, or missing.
  assert.equal(alumniContactEmail({ email: 'aina@gmail.com', email_verified: false }), null);
  assert.equal(alumniContactEmail({ email_verified: true }), null);
  assert.equal(alumniContactEmail(null), null);
});

// The redirect URI must match what is registered with LinkedIn and GitHub
// exactly. APP_BASE_URL pins it (needed once a custom domain is added);
// otherwise the public request origin is used.

const request = { url: 'https://cpdc.onrender.com/api/onboarding/oauth/github/start' };

// RENDER_EXTERNAL_URL is cleared too, so the test means the same on a Render
// or CI shell as on a laptop.
function withAppBaseUrl(value, fn) {
  const saved = { app: process.env.APP_BASE_URL, render: process.env.RENDER_EXTERNAL_URL };
  delete process.env.RENDER_EXTERNAL_URL;
  if (value === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = value;
  try {
    fn();
  } finally {
    if (saved.app === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = saved.app;
    if (saved.render !== undefined) process.env.RENDER_EXTERNAL_URL = saved.render;
  }
}

test('APP_BASE_URL wins over the request origin and loses its trailing slash', () => {
  withAppBaseUrl('https://careers.qiu.edu.my/', () => {
    assert.equal(
      redirectUri('LINKEDIN', request),
      'https://careers.qiu.edu.my/api/onboarding/oauth/linkedin/callback',
    );
  });
});

test('uses the request origin when APP_BASE_URL is not set', () => {
  withAppBaseUrl(undefined, () => {
    assert.equal(
      redirectUri('GITHUB', request),
      'https://cpdc.onrender.com/api/onboarding/oauth/github/callback',
    );
  });
});
