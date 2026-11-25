import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

// The worker file is loaded from the project folder at runtime, not bundled:
// Next runs from the repo root (`next start`), so process.cwd() points there.
// If the app ever moves to output: 'standalone' (or a host that ships only
// .next), copy lib/profile/ into the output or this path will not exist.
const WORKER_URL = pathToFileURL(path.join(process.cwd(), 'lib', 'profile', 'linkedin-pdf-worker.mjs'));

// resourceLimits cap only the JS heap; decompressed PDF data lives outside
// it. So the number of parses running at once is capped server-wide too.
const MAX_CONCURRENT = 2;
let running = 0;

function busyError() {
  const error = new Error('The PDF reader is busy.');
  error.code = 'PARSER_BUSY';
  return error;
}

/**
 * Parse an untrusted LinkedIn PDF in a worker thread with a memory cap and a
 * hard timeout. Resolves with the parsed profile; rejects on any failure, and
 * with code PARSER_BUSY when MAX_CONCURRENT parses are already running.
 */
export function parseLinkedInPdfIsolated(buffer, { timeoutMs = 15_000 } = {}) {
  if (running >= MAX_CONCURRENT) return Promise.reject(busyError());
  running += 1;
  return runWorker(buffer, timeoutMs).finally(() => { running -= 1; });
}

function runWorker(buffer, timeoutMs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, {
      workerData: buffer,
      resourceLimits: { maxOldGenerationSizeMb: 192, maxYoungGenerationSizeMb: 32 },
    });
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('PDF parsing timed out.')), timeoutMs);

    worker.once('message', (message) => (
      message?.ok ? finish(resolve, message.parsed) : finish(reject, new Error(message?.message ?? 'PDF could not be read.'))
    ));
    worker.once('error', (error) => finish(reject, error));
    worker.once('exit', (code) => finish(reject, new Error(`PDF worker stopped (exit ${code}).`)));
  });
}
