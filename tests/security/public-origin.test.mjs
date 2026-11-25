import test from 'node:test';
import assert from 'node:assert/strict';

import { publicOrigin } from '../../lib/http/public-origin.js';

// Behind Render's proxy, request.url carries the internal address
// (https://localhost:10000). Links sent to browsers, email and OAuth
// providers must use the public origin instead. Seen live on 2026-11-25.

const internal = { url: 'https://localhost:10000/api/auth/linkedin/start' };

function withEnv(env, fn) {
  const keys = ['APP_BASE_URL', 'RENDER_EXTERNAL_URL'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('APP_BASE_URL wins (custom domain), without a trailing slash', () => {
  withEnv({ APP_BASE_URL: 'https://careers.qiu.edu.my/', RENDER_EXTERNAL_URL: 'https://x.onrender.com' }, () => {
    assert.equal(publicOrigin(internal), 'https://careers.qiu.edu.my');
  });
});

test('on Render, the public onrender.com address replaces the internal one', () => {
  withEnv({ RENDER_EXTERNAL_URL: 'https://qiu-cpdc-career-portal.onrender.com' }, () => {
    assert.equal(publicOrigin(internal), 'https://qiu-cpdc-career-portal.onrender.com');
  });
});

test('local development falls back to the request origin', () => {
  withEnv({}, () => {
    assert.equal(publicOrigin({ url: 'http://localhost:3000/login' }), 'http://localhost:3000');
  });
});
