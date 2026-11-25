<?php

declare(strict_types=1);

namespace Cpdc\Http;

/** Turns any exception into the one error shape. Internals go only to storage/logs, without personal data. */
final class ErrorHandler
{
    public function __construct(private readonly string $logDir)
    {
    }

    public function handle(\Throwable $e, ?Request $req = null): Response
    {
        if ($e instanceof ApiError) {
            if ($req !== null && in_array($e->status, [401, 403, 429], true)) {
                $this->denied($e, $req);
            }

            return Response::error($e->status, $e->errorCode, $e->getMessage(), $e->details);
        }
        $this->log($e);

        return Response::error(500, 'INTERNAL', 'Something went wrong. Please try again later.');
    }

    /** Security log of refusals: who and where only. Never tokens, cookies, query strings or bodies. */
    private function denied(ApiError $e, Request $req): void
    {
        $this->write('security.log', [
            'time' => gmdate('Y-m-d\TH:i:s\Z'),
            'code' => $e->errorCode,
            'method' => $req->method,
            // A calendar subscribe link carries its secret in the path: keep it out of the log.
            'route' => (string) preg_replace('#^/api/calendar/feed/[^/]+$#', '/api/calendar/feed/[token]', $req->path),
            'user_id' => $req->user['id'] ?? null,
            'ip' => $req->remoteAddr,
        ]);
    }

    /** Internal error detail for the server log only (also used where the user gets a redirect, not a 500). */
    public function log(\Throwable $e): void
    {
        $frames = array_map(
            fn (array $f) => ($f['file'] ?? '?') . ':' . ($f['line'] ?? 0) . ' '
                . ($f['class'] ?? '') . $f['function'],
            array_slice($e->getTrace(), 0, 20)
        );
        $this->write('error.log', [
            'time' => gmdate('Y-m-d\TH:i:s\Z'),
            'type' => $e::class,
            'code' => $e->getCode(),
            // Quoted literals and emails in messages (e.g. SQL duplicate-key errors) can hold personal data.
            'message' => preg_replace(
                ['/\'[^\']*\'/', '/"[^"]*"/', '/\S+@\S+/'],
                ["'?'", '"?"', '?@?'],
                $e->getMessage()
            ),
            'at' => $e->getFile() . ':' . $e->getLine(),
            'trace' => $frames,
        ]);
    }

    /** @param array<string, mixed> $entry */
    private function write(string $file, array $entry): void
    {
        $line = json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        if (!is_dir($this->logDir)) {
            @mkdir($this->logDir, 0700, true);
        }
        // Logging must never break the error response itself.
        @file_put_contents($this->logDir . '/' . $file, $line . "\n", FILE_APPEND | LOCK_EX);
        // LOG_MIRROR (e.g. php://stderr on Render, whose disk is lost on restart) gets the same scrubbed line.
        $mirror = getenv('LOG_MIRROR');
        if ($mirror !== false && $mirror !== '') {
            @file_put_contents($mirror, $file . ' ' . $line . "\n", FILE_APPEND);
        }
    }
}
