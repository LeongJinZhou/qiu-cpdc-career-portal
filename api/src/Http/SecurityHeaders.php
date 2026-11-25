<?php

declare(strict_types=1);

namespace Cpdc\Http;

/** Headers on every API response, including 404 and 500. */
final class SecurityHeaders
{
    public static function apply(Response $response): Response
    {
        $response->headers = [
            'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
            'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'no-referrer',
        ] + $response->headers + [
            // Defaults a handler may override (ETag polling uses "private, no-cache").
            'Cache-Control' => 'no-store',
            'Content-Type' => 'application/json',
        ];

        return $response;
    }
}
