// Runs as a separate child process (see linkedin-pdf-isolated.js) so a
// hostile PDF can only exhaust this process's capped memory or be killed on
// timeout; the web server keeps serving other users. A process (not a worker
// thread) because pdfjs loads a native module that can crash when worker
// threads stop.
import { extractLinkedInLines, parseLinkedInLines } from './linkedin-pdf.js';

process.once('message', async (message) => {
  let reply;
  try {
    const bytes = Buffer.from(message?.pdf ?? []);
    reply = { ok: true, parsed: parseLinkedInLines(await extractLinkedInLines(bytes)) };
  } catch (error) {
    reply = { ok: false, message: String(error?.message ?? 'PDF could not be read') };
  }
  process.send(reply, () => process.exit(0));
});
