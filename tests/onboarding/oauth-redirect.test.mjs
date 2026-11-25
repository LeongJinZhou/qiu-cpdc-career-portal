import test from 'node:test';
import assert from 'node:assert/strict';

import { redirectUri } from '../../lib/onboarding/oauth.js';

// The redirect URI must match what is registered with LinkedIn and GitHub
// exactly. APP_BASE_URL pins it (needed once a custom domain is added);
// otherwise the public request origin is used.

const request = { url: 'https://cpdc.onrender.com/api/onboarding/oauth/github/start' };

function withAppBaseUrl(value, fn) {
  const saved = process.env.APP_BASE_URL;
  if (value === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = value;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = saved;
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
