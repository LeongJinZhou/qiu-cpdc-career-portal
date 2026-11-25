// Runs in a worker thread (see linkedin-pdf-isolated.js) so a hostile PDF can
// only exhaust this thread's capped memory or be killed on timeout; the web
// server's own thread keeps serving other users.
import { parentPort, workerData } from 'node:worker_threads';

import { extractLinkedInLines, parseLinkedInLines } from './linkedin-pdf.js';

try {
  const lines = await extractLinkedInLines(Buffer.from(workerData));
  parentPort.postMessage({ ok: true, parsed: parseLinkedInLines(lines) });
} catch (error) {
  parentPort.postMessage({ ok: false, message: String(error?.message ?? 'PDF could not be read') });
}
