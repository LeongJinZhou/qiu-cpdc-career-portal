import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';

import { createRateLimiter } from '../../lib/rate-limit.js';
import { readBodyWithLimit } from '../../lib/http/read-body.js';
import { parseLinkedInPdfIsolated } from '../../lib/profile/linkedin-pdf-isolated.js';

// ---- rate limiter -------------------------------------------------------

test('allows up to the limit per key, then refuses with a retry time', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
  assert.equal(limiter.check('u1', 0).allowed, true);
  assert.equal(limiter.check('u1', 1).allowed, true);
  const third = limiter.check('u1', 2);
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterMs, 59_998);
  // Another user is not affected.
  assert.equal(limiter.check('u2', 2).allowed, true);
});

test('the window slides: old hits stop counting', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
  assert.equal(limiter.check('u1', 0).allowed, true);
  assert.equal(limiter.check('u1', 999).allowed, false);
  assert.equal(limiter.check('u1', 1000).allowed, true);
});

test('memory stays bounded under many keys', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 100 });
  for (let i = 0; i < 1000; i += 1) limiter.check(`k${i}`, i);
  assert.ok(limiter.size() <= 100);
});

// ---- capped body read -------------------------------------------------------

function streamRequest(chunks, headers = {}) {
  let index = 0;
  let pulled = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulled += 1;
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
  });
  const request = new Request('http://localhost/x', { method: 'POST', body, headers, duplex: 'half' });
  return { request, pulled: () => pulled };
}

test('reads a body under the limit', async () => {
  const { request } = streamRequest([new Uint8Array([1, 2]), new Uint8Array([3])]);
  assert.deepEqual([...await readBodyWithLimit(request, 10)], [1, 2, 3]);
});

test('stops reading as soon as the body passes the limit (no content-length needed)', async () => {
  const chunks = Array.from({ length: 100 }, () => new Uint8Array(1024));
  const { request, pulled } = streamRequest(chunks);
  await assert.rejects(readBodyWithLimit(request, 4096), (error) => error.status === 413);
  assert.ok(pulled() < 10, `pulled ${pulled()} chunks`);
});

test('refuses a declared content-length over the limit without reading', async () => {
  const { request, pulled } = streamRequest([new Uint8Array(1)], { 'content-length': '999999' });
  await assert.rejects(readBodyWithLimit(request, 10), (error) => error.status === 413);
  // A ReadableStream pulls once on creation to fill its queue; no more after.
  assert.ok(pulled() <= 1, `pulled ${pulled()} chunks`);
});

// ---- isolated PDF parsing ------------------------------------------------

function tinyProfilePdf() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFontSize(26); doc.text('Aina Rahman', 220, 60);
  doc.setFontSize(16); doc.text('Summary', 220, 100);
  doc.setFontSize(10.5); doc.text('I build data tools.', 220, 125);
  return Buffer.from(doc.output('arraybuffer'));
}

test('parses a PDF in a separate worker thread', async () => {
  const parsed = await parseLinkedInPdfIsolated(tinyProfilePdf());
  assert.equal(parsed.name, 'Aina Rahman');
  assert.equal(parsed.summary, 'I build data tools.');
});

test('a parse that runs too long is stopped', async () => {
  await assert.rejects(parseLinkedInPdfIsolated(tinyProfilePdf(), { timeoutMs: 1 }), /timed out/i);
});

test('only two parses run at once across the server; a third is refused as busy', async () => {
  const pdf = tinyProfilePdf();
  const results = await Promise.allSettled([
    parseLinkedInPdfIsolated(pdf),
    parseLinkedInPdfIsolated(pdf),
    parseLinkedInPdfIsolated(pdf),
  ]);
  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'fulfilled', 'rejected']);
  assert.equal(results[2].reason.code, 'PARSER_BUSY');
  // Slots are released afterwards.
  assert.equal((await parseLinkedInPdfIsolated(pdf)).name, 'Aina Rahman');
});

test('garbage input is rejected, not crashed on', async () => {
  await assert.rejects(parseLinkedInPdfIsolated(Buffer.from('%PDF-1.4 not really a pdf')));
});
