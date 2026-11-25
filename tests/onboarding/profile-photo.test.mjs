import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchProfilePhotoDataUrl } from '../../lib/onboarding/profile-photo.js';

// LinkedIn photo links expire after a few weeks, so the connect step stores a
// copy. The server fetches a URL that came from LinkedIn's API: it must only
// ever fetch LinkedIn's image host, only images, and only small ones.

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function fakeFetch({ status = 200, type = 'image/jpeg', body = JPEG } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    return {
      ok: status === 200,
      status,
      headers: new Headers({ 'content-type': type }),
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  };
  return { impl, calls };
}

test('copies a LinkedIn-hosted image into a data URL', async () => {
  const { impl, calls } = fakeFetch();
  const dataUrl = await fetchProfilePhotoDataUrl('https://media.licdn.com/dms/image/abc/profile.jpg', { fetchImpl: impl });
  assert.equal(dataUrl, `data:image/jpeg;base64,${JPEG.toString('base64')}`);
  assert.equal(calls[0].init.redirect, 'error');
});

test('refuses any host that is not LinkedIn media over https', async () => {
  const { impl, calls } = fakeFetch();
  for (const url of [
    'http://media.licdn.com/x.jpg',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/x.jpg',
    'https://media.licdn.com.evil.example/x.jpg',
    'not a url',
    null,
  ]) {
    assert.equal(await fetchProfilePhotoDataUrl(url, { fetchImpl: impl }), null, String(url));
  }
  assert.equal(calls.length, 0);
});

test('refuses non-images, failed responses and oversized files', async () => {
  assert.equal(await fetchProfilePhotoDataUrl('https://media.licdn.com/a.jpg', { fetchImpl: fakeFetch({ type: 'text/html' }).impl }), null);
  assert.equal(await fetchProfilePhotoDataUrl('https://media.licdn.com/a.jpg', { fetchImpl: fakeFetch({ type: 'image/svg+xml' }).impl }), null);
  assert.equal(await fetchProfilePhotoDataUrl('https://media.licdn.com/a.jpg', { fetchImpl: fakeFetch({ status: 404 }).impl }), null);
  const big = Buffer.alloc(600 * 1024, 1);
  assert.equal(await fetchProfilePhotoDataUrl('https://media.licdn.com/a.jpg', { fetchImpl: fakeFetch({ body: big }).impl }), null);
});

test('stops reading a streamed body as soon as it passes the cap', async () => {
  let pulled = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(64 * 1024));
      if (pulled > 50) controller.close();
    },
  });
  const impl = async () => new Response(body, { headers: { 'content-type': 'image/jpeg' } });
  assert.equal(await fetchProfilePhotoDataUrl('https://media.licdn.com/a.jpg', { fetchImpl: impl }), null);
  assert.ok(pulled < 10, `read ${pulled} chunks`);
});

test('refuses a declared content-length over the cap without reading', async () => {
  const impl = async () => new Response('x', { headers: { 'content-type': 'image/jpeg', 'content-length': String(5 * 1024 * 1024) } });
  assert.equal(await fetchProfilePhotoDataUrl('https://media.licdn.com/a.jpg', { fetchImpl: impl }), null);
});

test('a network error returns null instead of throwing', async () => {
  const impl = async () => { throw new Error('ECONNRESET'); };
  assert.equal(await fetchProfilePhotoDataUrl('https://media.licdn.com/a.jpg', { fetchImpl: impl }), null);
});
