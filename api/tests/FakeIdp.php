<?php

declare(strict_types=1);

namespace Cpdc\Tests;

use Cpdc\Auth\GoogleOidc;
use Cpdc\Auth\LinkedInOidc;
use GuzzleHttp\Client;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Promise\PromiseInterface;
use GuzzleHttp\Psr7\Response;
use Psr\Http\Message\RequestInterface;

/**
 * In-process access to api/tests/fakes/handler.php (fake Google and LinkedIn): the same fake as
 * `npm run dev:fakes`, no network.
 */
final class FakeIdp
{
    public const BASE = 'http://127.0.0.1:8091';
    public const GOOGLE_CLIENT = 'fake-google-client';
    public const GOOGLE_SECRET = 'fake-google-secret';
    public const LINKEDIN_CLIENT = 'fake-linkedin-client';
    public const LINKEDIN_SECRET = 'fake-linkedin-secret';
    public const SUPERADMIN = 'superadmin@example.test';

    /** @var list<string> "METHOD path" of every request the client sent */
    public array $requests = [];

    /**
     * Sets the env the fake and the app read; returns a closure that restores the old values.
     *
     * @param array<string, string> $extra
     */
    public static function useEnv(array $extra = []): \Closure
    {
        $vars = $extra + [
            'GOOGLE_OIDC_BASE' => self::BASE . '/google', 'GOOGLE_PEOPLE_BASE' => self::BASE . '/google',
            'GOOGLE_CLIENT_ID' => self::GOOGLE_CLIENT, 'GOOGLE_CLIENT_SECRET' => self::GOOGLE_SECRET,
            'LINKEDIN_CLIENT_ID' => self::LINKEDIN_CLIENT, 'LINKEDIN_CLIENT_SECRET' => self::LINKEDIN_SECRET,
            'LINKEDIN_OAUTH_BASE' => self::BASE . '/linkedin', 'LINKEDIN_API_BASE' => self::BASE . '/linkedin-api',
            'SUPERADMIN_EMAIL' => self::SUPERADMIN,
        ];
        $old = [];
        foreach ($vars as $key => $value) {
            $old[$key] = getenv($key);
            putenv("$key=$value");
        }

        return static function () use ($old): void {
            foreach ($old as $key => $value) {
                putenv($value === false ? $key : "$key=$value");
            }
        };
    }

    /**
     * @param array<mixed> $query
     * @param array<string, string> $headers
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    public static function handle(string $method, string $path, array $query = [], string $body = '', array $headers = []): array
    {
        $handler = require __DIR__ . '/fakes/handler.php';

        return $handler($method, $path, $query, $body, $headers);
    }

    /** Guzzle client with the production options, answered in-process by the fake. */
    public function client(): Client
    {
        return GoogleOidc::httpClient(function (RequestInterface $request): PromiseInterface {
            $this->requests[] = $request->getMethod() . ' ' . $request->getUri()->getPath();
            parse_str($request->getUri()->getQuery(), $query);
            $headers = array_map(fn (array $v) => implode(', ', $v), $request->getHeaders());
            $result = self::handle(
                $request->getMethod(),
                $request->getUri()->getPath(),
                $query,
                (string) $request->getBody(),
                $headers
            );

            return Create::promiseFor(new Response($result['status'], $result['headers'], $result['body']));
        });
    }

    public function google(string $appUrl, string $cacheDir): GoogleOidc
    {
        return new GoogleOidc(
            $this->client(),
            self::BASE . '/google',
            self::BASE . '/google',
            self::GOOGLE_CLIENT,
            self::GOOGLE_SECRET,
            rtrim($appUrl, '/') . '/api/auth/google/callback',
            $cacheDir,
            time(...)
        );
    }

    public function linkedIn(string $appUrl): LinkedInOidc
    {
        return new LinkedInOidc(
            $this->client(),
            self::BASE . '/linkedin',
            self::BASE . '/linkedin-api',
            self::LINKEDIN_CLIENT,
            self::LINKEDIN_SECRET,
            rtrim($appUrl, '/') . LinkedInOidc::CALLBACK_PATH
        );
    }

    /**
     * Follows an authorization URL through the fake with $persona; returns the callback query (code, state).
     *
     * @return array<string, string>
     */
    public static function authorize(string $authorizationUrl, string $persona): array
    {
        $parts = parse_url($authorizationUrl);
        parse_str((string) ($parts['query'] ?? ''), $query);
        $result = self::handle('GET', (string) ($parts['path'] ?? ''), ['persona' => $persona] + $query);
        $location = $result['headers']['Location'] ?? throw new \RuntimeException('fake did not redirect: ' . $result['body']);
        parse_str((string) parse_url($location, PHP_URL_QUERY), $back);

        /** @var array<string, string> $back */
        return $back;
    }
}
