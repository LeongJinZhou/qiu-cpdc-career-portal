// Local development only: an HTTP server that runs every request through php-cgi (one process per request).
// Why: PHP's built-in server (php -S) on Windows stops accepting connections after a while (seen on this laptop in
// sld-orientation and here). One php-cgi per request cannot get stuck between requests. Never used in production
// (Apache there). Usage: node tools/php-dev-server.mjs <port> <script.php>
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';

const [port, script] = process.argv.slice(2);
if (!port || !script) {
  console.error('usage: node tools/php-dev-server.mjs <port> <script.php>');
  process.exit(1);
}
const scriptPath = resolve(script);
const phpCgi = process.env.PHP_CGI ?? 'php-cgi';
const MAX_BODY = 20 * 1024 * 1024;

createServer((req, res) => {
  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) req.destroy();
    else chunks.push(chunk);
  });
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    const env = {
      ...process.env,
      GATEWAY_INTERFACE: 'CGI/1.1',
      REDIRECT_STATUS: '200',
      SCRIPT_FILENAME: scriptPath,
      SCRIPT_NAME: '/index.php',
      REQUEST_METHOD: req.method ?? 'GET',
      REQUEST_URI: req.url ?? '/',
      QUERY_STRING: url.search.slice(1),
      CONTENT_LENGTH: String(body.length),
      CONTENT_TYPE: req.headers['content-type'] ?? '',
      REMOTE_ADDR: req.socket.remoteAddress?.replace('::ffff:', '') ?? '127.0.0.1',
      SERVER_NAME: '127.0.0.1',
      SERVER_PORT: String(port),
      SERVER_PROTOCOL: 'HTTP/1.1',
    };
    for (const [name, value] of Object.entries(req.headers)) {
      if (name === 'content-type' || name === 'content-length' || name === 'proxy') continue; // httpoxy
      env[`HTTP_${name.toUpperCase().replace(/-/g, '_')}`] = Array.isArray(value) ? value.join(', ') : String(value);
    }
    const php = spawn(phpCgi, ['-d', 'cgi.force_redirect=0', '-d', 'display_errors=0'], { env, cwd: dirname(scriptPath) });
    const out = [];
    php.stdout.on('data', (chunk) => out.push(chunk));
    php.stderr.on('data', (chunk) => process.stderr.write(chunk));
    php.on('error', (error) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`php-cgi failed to start: ${error.message}`);
    });
    php.on('close', () => {
      const raw = Buffer.concat(out);
      const split = raw.indexOf('\r\n\r\n');
      const headerText = split >= 0 ? raw.subarray(0, split).toString('latin1') : '';
      const payload = split >= 0 ? raw.subarray(split + 4) : raw;
      let status = 200;
      const headers = {};
      for (const line of headerText.split('\r\n')) {
        const colon = line.indexOf(':');
        if (colon < 0) continue;
        const name = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();
        if (name.toLowerCase() === 'status') status = Number.parseInt(value, 10) || 200;
        else (headers[name] ??= []).push(value);
      }
      if (headers.Location && status === 200) status = 302;
      res.writeHead(status, headers);
      res.end(payload);
      console.log(`${new Date().toISOString()} ${req.method} ${url.pathname} ${status}`);
    });
    php.stdin.end(body);
  });
}).listen(Number(port), '127.0.0.1', () => console.log(`php dev server on http://127.0.0.1:${port} -> ${scriptPath}`));
