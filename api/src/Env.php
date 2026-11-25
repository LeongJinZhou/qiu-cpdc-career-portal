<?php

declare(strict_types=1);

namespace Cpdc;

final class Env
{
    /** @return array<string, string> */
    public static function parse(string $contents): array
    {
        $vars = [];
        foreach (preg_split('/\R/', $contents) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $vars[trim($key)] = trim($value);
        }

        return $vars;
    }

    /** Loads a .env file if present. Variables already set in the real environment win. */
    public static function load(string $path): void
    {
        if (!is_readable($path)) {
            return;
        }
        foreach (self::parse((string) file_get_contents($path)) as $key => $value) {
            if (getenv($key) === false) {
                putenv($key . '=' . $value);
            }
        }
    }

    public static function get(string $key): string
    {
        $value = getenv($key);
        if ($value === false) {
            throw new \RuntimeException("Missing environment variable $key");
        }

        return $value;
    }

    /**
     * Boot check (fail closed): APP_ENV must be a known value. In production, Google settings are present and
     * every outbound base URL plus APP_URL is https on a public host. LinkedIn and GitHub bases are checked when set.
     */
    public static function assertProdUrls(): void
    {
        $env = getenv('APP_ENV');
        if (!in_array($env, ['production', 'local', 'development', 'test'], true)) {
            throw new \RuntimeException('APP_ENV must be production, local, development or test');
        }
        if ($env !== 'production') {
            return;
        }
        $required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APP_URL', 'GOOGLE_OIDC_BASE', 'GOOGLE_PEOPLE_BASE'];
        foreach ($required as $key) {
            if (trim((string) getenv($key)) === '') {
                throw new \RuntimeException("Missing environment variable $key");
            }
        }
        $bases = ['APP_URL', 'GOOGLE_OIDC_BASE', 'GOOGLE_PEOPLE_BASE', 'LINKEDIN_OAUTH_BASE', 'LINKEDIN_API_BASE',
            'GITHUB_OAUTH_BASE', 'GITHUB_API_BASE'];
        foreach ($bases as $key) {
            $value = (string) getenv($key);
            if ($value !== '' && !self::isPublicHttps($value)) {
                throw new \RuntimeException("$key must be an https URL on a non-local host in production");
            }
        }
    }

    private static function isPublicHttps(string $url): bool
    {
        $parts = parse_url($url);
        if (!is_array($parts) || strtolower($parts['scheme'] ?? '') !== 'https' || !isset($parts['host'])) {
            return false;
        }
        $host = rtrim(strtolower(trim($parts['host'], '[]')), '.');
        if ($host === '' || $host === 'localhost' || str_ends_with($host, '.localhost')) {
            return false;
        }
        if (filter_var($host, FILTER_VALIDATE_IP) === false) {
            // Digits-and-dots hosts that are not a dotted quad ("2130706433", "127.1") still resolve to IPs.
            return preg_match('/^[0-9.]+$/', $host) !== 1;
        }

        // Public addresses only: no loopback, RFC1918, 100.64/10, link-local, ULA, mapped or reserved ranges.
        return filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE) !== false;
    }

    /** STORAGE_DIR as an absolute path; a relative value is relative to the repository root. */
    public static function storageDir(): string
    {
        $dir = self::get('STORAGE_DIR');
        $absolute = str_starts_with($dir, '/') || preg_match('/^[A-Za-z]:[\\\\\/]/', $dir) === 1;

        return $absolute ? $dir : dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . $dir;
    }
}
