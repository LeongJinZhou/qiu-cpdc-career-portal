<?php

declare(strict_types=1);

namespace Cpdc\Http;

/**
 * Method + path to handler. "{name}" segments match positive integer ids only, except "{token}": a base64url
 * secret of 43 characters (a supervisor approval link).
 *
 * @phpstan-type Rate array{name: string, setting: string, by: 'ip'|'user', window?: int}
 * @phpstan-type Route array{handler: \Closure, public: bool, rate: Rate|null, beforeOnboarding: bool,
 *     params: array<string, string>}
 */
final class Router
{
    private const TOKEN = '[A-Za-z0-9_-]{43}';

    /**
     * @var list<array{method: string, regex: string, handler: \Closure, public: bool, rate: Rate|null,
     *     beforeOnboarding: bool}>
     */
    private array $routes = [];

    /**
     * @param bool $public true = no session needed (health, auth start/callback)
     * @param Rate|null $rate limit read from setting $rate['setting'], per minute unless `window` says otherwise
     * @param bool $beforeOnboarding true = open to a signed-in user who has not finished onboarding (SPEC rule 4)
     */
    public function add(
        string $method,
        string $pattern,
        \Closure $handler,
        bool $public = false,
        ?array $rate = null,
        bool $beforeOnboarding = false
    ): self {
        $regex = preg_replace_callback(
            '/\\\\\{([a-z_]+)\\\\\}/',
            static fn (array $m): string => $m[1] === 'token'
                ? '(?P<token>' . self::TOKEN . ')'
                : '(?P<' . $m[1] . '>[1-9][0-9]{0,18})',
            preg_quote($pattern, '#')
        );
        $this->routes[] = [
            'method' => $method,
            'regex' => '#^' . $regex . '$#D',
            'handler' => $handler,
            'public' => $public,
            'rate' => $rate,
            'beforeOnboarding' => $beforeOnboarding,
        ];

        return $this;
    }

    /** @return Route */
    public function match(string $method, string $path): array
    {
        foreach ($this->routes as $route) {
            $methodMatches = $route['method'] === $method || ($method === 'HEAD' && $route['method'] === 'GET');
            if ($methodMatches && preg_match($route['regex'], $path, $m) === 1) {
                $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);

                unset($route['method'], $route['regex']);

                return $route + ['params' => $params];
            }
        }
        throw new ApiError(404, 'NOT_FOUND', 'Not found.');
    }
}
