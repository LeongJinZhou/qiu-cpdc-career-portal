<?php

declare(strict_types=1);

namespace Cpdc\Http\Middleware;

use Cpdc\Http\ApiError;
use Cpdc\Http\Request;

/**
 * Non-GET requests need Origin == APP_URL (missing Origin is refused). Requests with a session also need
 * the session's X-CSRF-Token; public routes have no session, so only the Origin check applies.
 */
final class Csrf
{
    public static function check(Request $req, string $appUrl, bool $needsToken): void
    {
        $token = $req->header('x-csrf-token');
        $valid = $req->header('origin') === rtrim($appUrl, '/') && (!$needsToken || (
            $req->csrfToken !== null && $req->csrfToken !== ''
            && $token !== null && hash_equals($req->csrfToken, $token)
        ));
        if (!$valid) {
            throw new ApiError(403, 'CSRF', 'Request refused. Reload the page and try again.');
        }
    }
}
