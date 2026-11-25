<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

use Cpdc\App;
use Cpdc\Http\Middleware\Session;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Router;
use Cpdc\Tests\FakeIdp;

/**
 * Drives the real App pipeline in-process, with the fake Google and LinkedIn answering in-process. Each test runs in
 * a rolled-back transaction (DbTestCase). Cookies are kept per test like a browser would.
 */
abstract class HttpTestCase extends DbTestCase
{
    protected const APP_URL = 'http://app.example.test';

    protected int $now = 1_800_000_000;
    protected string $storage;
    protected App $app;
    protected FakeIdp $idp;
    protected bool $linkedInOn = true;

    /** @var array<string, string> cookie name => value */
    protected array $jar = [];
    protected string $csrf = '';
    private \Closure $restoreEnv;

    protected function setUp(): void
    {
        parent::setUp();
        $this->restoreEnv = FakeIdp::useEnv();
        $this->storage = sys_get_temp_dir() . '/cpdc-test-' . bin2hex(random_bytes(4));
        $this->idp = new FakeIdp();
        $this->pdo->exec(
            "UPDATE setting SET value = '[\"qiu.edu.my\", \"example.test\"]' WHERE setting_key = 'google_hosted_domains'"
        );
        $this->app = new App(
            App::routes(new Router()),
            fn () => $this->pdo,
            self::APP_URL,
            $this->storage,
            1,
            fn () => $this->now,
            fn () => $this->idp->google(self::APP_URL, $this->storage . '/google'),
            fn () => $this->linkedInOn ? $this->idp->linkedIn(self::APP_URL) : null
        );
        $this->jar = [];
        $this->csrf = '';
    }

    protected function tearDown(): void
    {
        ($this->restoreEnv)();
        unset($this->app);
        parent::tearDown();
    }

    /** @param array<string, mixed> $query */
    protected function send(string $method, string $path, string $body = '', array $query = []): Response
    {
        $headers = ['origin' => self::APP_URL, 'x-csrf-token' => $this->csrf, 'content-type' => 'application/json'];
        $response = $this->app->handle(new Request($method, $path, $query, $headers, $body, '192.0.2.10', $this->jar));
        foreach ((array) ($response->headers['Set-Cookie'] ?? []) as $cookie) {
            if (preg_match('/^([^=]+)=([^;]*)/', $cookie, $m) === 1) {
                if ($m[2] === '') {
                    unset($this->jar[$m[1]]);
                } else {
                    $this->jar[$m[1]] = $m[2];
                }
            }
        }

        return $response;
    }

    /** @param array<string, mixed> $data */
    protected function json(string $method, string $path, array $data = []): Response
    {
        return $this->send($method, $path, (string) json_encode($data === [] ? new \stdClass() : $data));
    }

    /**
     * A full browser sign-in: start, the fake chooses $persona, callback. Returns the callback response.
     *
     * @param 'google'|'linkedin' $provider
     * @param array<string, string> $startQuery
     */
    protected function signIn(string $provider, string $persona, array $startQuery = []): Response
    {
        $start = $this->send('GET', "/api/auth/$provider/start", '', $startQuery);
        $location = $start->headers['Location'] ?? '';
        $this->assertSame(302, $start->status, $start->body);
        if (!is_string($location) || !str_starts_with($location, FakeIdp::BASE)) {
            return $start; // refused before leaving the portal
        }
        $back = FakeIdp::authorize($location, $persona);
        $callback = $this->send('GET', "/api/auth/$provider/callback", '', $back);
        $this->refreshCsrf();

        return $callback;
    }

    protected function refreshCsrf(): void
    {
        if (isset($this->jar[Session::COOKIE])) {
            $me = $this->send('GET', '/api/me');
            $this->csrf = $me->status === 200 ? (string) ($this->body($me)['csrf_token'] ?? '') : '';
        }
    }

    /** @return array<mixed> */
    protected function body(Response $response): array
    {
        return (array) json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);
    }

    protected function location(Response $response): string
    {
        $location = $response->headers['Location'] ?? '';

        return is_string($location) ? $location : '';
    }

    protected function assertError(Response $response, int $status, string $code): void
    {
        $this->assertSame($status, $response->status, $response->body);
        $this->assertSame($code, $this->body($response)['error']['code'] ?? null, $response->body);
    }
}
