<?php

declare(strict_types=1);

namespace Cpdc\Profile;

/**
 * A public LinkedIn profile URL in one canonical form: https://www.linkedin.com/in/<name>. Accepts what people
 * paste (no scheme, country subdomain, trailing slash, query string). Anything else is refused.
 */
final class LinkedInUrl
{
    public static function normalise(string $input): ?string
    {
        $value = trim($input);
        if ($value === '' || strlen($value) > 300) {
            return null;
        }
        if (preg_match('#^https?://#i', $value) !== 1) {
            $value = 'https://' . $value;
        }
        $parts = parse_url($value);
        if (!is_array($parts) || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) {
            return null;
        }
        $host = strtolower((string) ($parts['host'] ?? ''));
        if (preg_match('/^(?:(?:www|[a-z]{2,3})\.)?linkedin\.com$/D', $host) !== 1) {
            return null;
        }
        $path = rtrim((string) ($parts['path'] ?? ''), '/');
        if (preg_match('#^/in/([A-Za-z0-9\-_%]{3,100})$#D', $path, $m) !== 1) {
            return null;
        }

        return 'https://www.linkedin.com/in/' . $m[1];
    }
}
