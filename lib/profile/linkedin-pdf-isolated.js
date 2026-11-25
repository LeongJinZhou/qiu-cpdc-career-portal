import { fork } from 'node:child_process';
import path from 'node:path';

// The parser file is loaded from the project folder at runtime, not bundled:
// Next runs from the repo root (`next start`), so process.cwd() points there.
// If the app ever moves to output: 'standalone' (or a host that ships only
// .next), copy lib/profile/ into the output or this path will not exist.
const WORKER_PATH = path.join(process.cwd(), 'lib', 'profile', 'linkedin-pdf-worker.mjs');

// Each parse is its own process with a capped heap. Only a few run at once,
// because each one costs memory on a small server.
const MAX_CONCURRENT = 2;
const MAX_HEAP_MB = 192;
let running = 0;

/** How many reader processes are alive right now. */
export function activeParses() {
  return running;
}

function busyError() {
  const error = new Error('The PDF reader is busy.');
  error.code = 'PARSER_BUSY';
  return error;
}

/**
 * Parse an untrusted LinkedIn PDF in a separate, memory-capped process with a
 * hard timeout. Resolves with the parsed profile; rejects on any failure, and
 * with code PARSER_BUSY when MAX_CONCURRENT parses are already running.
 */
export function parseLinkedInPdfIsolated(buffer, { timeoutMs = 15_000 } = {}) {
  if (running >= MAX_CONCURRENT) return Promise.reject(busyError());
  running += 1;
  return runChild(buffer, timeoutMs);
}

function runChild(buffer, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = fork(WORKER_PATH, [], {
      execArgv: [`--max-old-space-size=${MAX_HEAP_MB}`],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      serialization: 'advanced',
      // The reader handles untrusted files: it gets none of the server's
      // secrets (session key, database URL, OAuth keys). SystemRoot is needed
      // for Node to start on Windows.
      env: {
        NODE_ENV: process.env.NODE_ENV ?? 'production',
        PATH: process.env.PATH ?? '',
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      },
    });

    // Free the slot exactly once, whether the process exits or never starts
    // ('exit' may not fire after a launch 'error').
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      running -= 1;
    };

    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(reject, new Error('PDF parsing timed out.'));
    }, timeoutMs);

    // The slot is freed only when the process is really gone.
    child.once('exit', (code, signal) => {
      release();
      settle(reject, new Error(`PDF reader stopped (${signal ?? `exit ${code}`}).`));
    });
    child.once('error', (error) => {
      child.kill('SIGKILL');
      release();
      settle(reject, error);
    });
    child.once('message', (message) => (message?.ok
      ? settle(resolve, message.parsed)
      : settle(reject, new Error(message?.message ?? 'PDF could not be read.'))));

    child.send({ pdf: buffer });
  });
}
