<?php

declare(strict_types=1);

namespace Cpdc\Auth;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\HandlerStack;
use Cpdc\Env;

/**
 * Google OIDC authorization-code flow (PKCE) and the People API call. Discovery and JWKS are cached in
 * storage and honour max-age. Only verified claims leave this class; raw tokens never do.
 */
final class GoogleOidc
{
    /**
     * user.organization.read: department and title from people/me. directory.readonly (founder approved
     * 2026-11-18): the admin-set Employee ID only comes back from the directory search, which the app runs for the
     * signed-in user's own email only.
     */
    public const SCOPE = 'openid email profile https://www.googleapis.com/auth/user.organization.read'
        . ' https://www.googleapis.com/auth/directory.readonly';

    /** TLS verified, short timeouts, no redirects, never through an environment proxy. */
    public const HTTP_OPTIONS = [
        'verify' => true,
        'timeout' => 8,
        'connect_timeout' => 4,
        'allow_redirects' => false,
        'http_errors' => false,
        'proxy' => ['no' => ['*']],
    ];

    private const LEEWAY_SECONDS = 60;
    private const JWKS_REFETCH_SECONDS = 60;
    private const MAX_CACHE_SECONDS = 86400;

    /** @param \Closure(): int $clock unix time */
    public function __construct(
        private readonly ClientInterface $http,
        private readonly string $base,
        private readonly string $peopleBase,
        private readonly string $clientId,
        #[\SensitiveParameter] private readonly string $clientSecret,
        private readonly string $redirectUri,
        private readonly string $cacheDir,
        private readonly \Closure $clock
    ) {
    }

    /** @param callable|null $handler Guzzle handler; tests pass the in-process fake */
    public static function httpClient(?callable $handler = null): Client
    {
        $stack = $handler === null ? [] : ['handler' => HandlerStack::create($handler)];

        return new Client(self::HTTP_OPTIONS + $stack);
    }

    /** Redirect URI comes from APP_URL, never from the request's Host header. */
    public static function fromEnv(string $appUrl, string $storageDir): self
    {
        return new self(
            self::httpClient(),
            rtrim(Env::get('GOOGLE_OIDC_BASE'), '/'),
            rtrim(Env::get('GOOGLE_PEOPLE_BASE'), '/'),
            Env::get('GOOGLE_CLIENT_ID'),
            Env::get('GOOGLE_CLIENT_SECRET'),
            rtrim($appUrl, '/') . '/api/auth/google/callback',
            $storageDir . '/google',
            time(...)
        );
    }

    /** An empty $hostedDomain leaves out the hd hint, so Google's account chooser shows every account. */
    public function authorizationUrl(string $state, string $nonce, string $challenge, string $hostedDomain): string
    {
        return $this->endpoint('authorization_endpoint') . '?' . http_build_query(array_filter([
            'response_type' => 'code',
            'client_id' => $this->clientId,
            'redirect_uri' => $this->redirectUri,
            'scope' => self::SCOPE,
            'state' => $state,
            'nonce' => $nonce,
            'code_challenge' => $challenge,
            'code_challenge_method' => 'S256',
            'prompt' => 'select_account', // after sign-out, the user can pick another Google account
            'hd' => $hostedDomain, // a hint only; verify() checks the hd claim
        ], static fn (string $v): bool => $v !== ''), '', '&', PHP_QUERY_RFC3986);
    }

    /** @return array{id_token: string, access_token: string} */
    public function exchange(string $code, #[\SensitiveParameter] string $verifier): array
    {
        try {
            $res = $this->http->request('POST', $this->endpoint('token_endpoint'), ['form_params' => [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'code_verifier' => $verifier,
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'redirect_uri' => $this->redirectUri,
            ]]);
        } catch (GuzzleException) {
            throw new LoginRefused('upstream_error');
        }
        $status = $res->getStatusCode();
        if ($status >= 400 && $status < 500) {
            throw new LoginRefused('token_invalid'); // bad, used or expired code, or wrong verifier
        }
        $body = $status === 200 ? json_decode((string) $res->getBody(), true) : null;
        if (!is_array($body) || !is_string($body['id_token'] ?? null) || !is_string($body['access_token'] ?? null)) {
            throw new LoginRefused('upstream_error');
        }

        return ['id_token' => $body['id_token'], 'access_token' => $body['access_token']];
    }

    /**
     * The hd claim and the email's domain must both be one of $hostedDomains (setting google_hosted_domains).
     *
     * @param list<string> $hostedDomains
     * @return array{sub: string, email: string, name: string|null}
     */
    public function verify(#[\SensitiveParameter] string $idToken, string $nonce, array $hostedDomains): array
    {
        $claims = $this->decode($idToken);
        $host = (string) parse_url($this->base, PHP_URL_HOST);
        $sub = $claims['sub'] ?? null;
        $email = $claims['email'] ?? null;
        $valid = in_array($claims['iss'] ?? null, [$this->base, $host], true)
            && ($claims['aud'] ?? null) === $this->clientId
            && isset($claims['exp'])
            && is_string($claims['nonce'] ?? null) && hash_equals($nonce, $claims['nonce'])
            && is_string($sub) && $sub !== '' && strlen($sub) <= 64
            && is_string($email) && str_contains($email, '@') && strlen($email) <= 254;
        if (!$valid) {
            throw new LoginRefused('token_invalid');
        }
        if (($claims['email_verified'] ?? null) !== true) {
            throw new LoginRefused('unverified'); // an unverified email is not logged (only verified emails are)
        }
        $email = strtolower($email);
        $domains = array_map('strtolower', $hostedDomains);
        $emailDomain = substr($email, strrpos($email, '@') + 1);
        $hd = is_string($claims['hd'] ?? null) ? strtolower($claims['hd']) : null;
        $inDomain = $hd !== null && $hd === $emailDomain && in_array($hd, $domains, true);
        if (!$inDomain) {
            throw new LoginRefused('domain', $email);
        }
        $name = $claims['name'] ?? null;

        return ['sub' => $sub, 'email' => $email, 'name' => is_string($name) ? $name : null];
    }

    /**
     * The user's own directory profile, fixed field list only. Phone, location and managers are never asked for.
     *
     * @return array<mixed>
     */
    public function person(#[\SensitiveParameter] string $accessToken): array
    {
        $url = $this->peopleBase . '/v1/people/me?personFields=' . DirectoryProfile::FIELDS;
        try {
            $res = $this->http->request('GET', $url, ['headers' => ['Authorization' => 'Bearer ' . $accessToken]]);
        } catch (GuzzleException) {
            throw new LoginRefused('upstream_error');
        }
        $body = $res->getStatusCode() === 200 ? json_decode((string) $res->getBody(), true) : null;

        return is_array($body) ? $body : throw new LoginRefused('upstream_error');
    }

    /**
     * The signed-in user's own entry in the Workspace directory (domain profile), found by their verified email:
     * the admin-set Employee ID (externalIds) and organisation. Fixed read mask; the search is for that one email
     * and only an entry carrying exactly that email is returned. Null when the call fails or finds nothing: the
     * login goes on with people/me alone (rule 4 then flags a missing ID).
     *
     * @return array<mixed>|null
     */
    public function directoryEntry(#[\SensitiveParameter] string $accessToken, string $email): ?array
    {
        $url = $this->peopleBase . '/v1/people:searchDirectoryPeople?' . http_build_query([
            'query' => $email,
            'readMask' => DirectoryProfile::DIRECTORY_FIELDS,
            'sources' => 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE',
            'pageSize' => 5,
        ], '', '&', PHP_QUERY_RFC3986);
        try {
            $res = $this->http->request('GET', $url, ['headers' => ['Authorization' => 'Bearer ' . $accessToken]]);
        } catch (GuzzleException) {
            return null;
        }
        if ($res->getStatusCode() !== 200) { // the status only: why no Employee ID arrived (e.g. 403 scope)
            error_log('login: directory search returned HTTP ' . $res->getStatusCode());

            return null;
        }
        $body = json_decode((string) $res->getBody(), true);
        $people = is_array($body) && is_array($body['people'] ?? null) ? $body['people'] : [];
        foreach ($people as $person) {
            if (is_array($person) && DirectoryProfile::hasEmail($person, $email)) {
                return $person;
            }
        }

        return null;
    }

    /** @return array<string, mixed> */
    private function decode(string $idToken): array
    {
        $parts = explode('.', $idToken);
        try {
            $header = count($parts) === 3 ? json_decode(JWT::urlsafeB64Decode($parts[0]), true) : null;
        } catch (\Throwable) {
            $header = null;
        }
        $kid = is_array($header) ? ($header['kid'] ?? null) : null;
        if (!is_string($kid)) {
            throw new LoginRefused('token_invalid');
        }
        $keys = $this->keys(false);
        if (!isset($keys[$kid])) {
            $keys = $this->keys(true); // Google rotated its keys
        }
        if (!isset($keys[$kid])) {
            throw new LoginRefused('token_invalid');
        }
        [$leeway, $timestamp] = [JWT::$leeway, JWT::$timestamp]; // php-jwt globals: restore what we found
        JWT::$leeway = self::LEEWAY_SECONDS;
        JWT::$timestamp = ($this->clock)();
        try {
            // One Key with alg RS256: php-jwt refuses any header alg that differs (none, HS256, ...).
            return (array) JWT::decode($idToken, $keys[$kid]);
        } catch (\Throwable) {
            throw new LoginRefused('token_invalid');
        } finally {
            [JWT::$leeway, JWT::$timestamp] = [$leeway, $timestamp];
        }
    }

    /** @return array<string, Key> kid => RS256 key */
    private function keys(bool $unknownKid): array
    {
        $cache = $this->cached('jwks');
        $now = ($this->clock)();
        $refetch = $unknownKid && $cache !== null && $now - $cache['fetched_at'] >= self::JWKS_REFETCH_SECONDS;
        if ($cache === null || $cache['expires'] <= $now || $refetch) {
            $cache = $this->fetch('jwks', $this->endpoint('jwks_uri'));
        }
        $keys = [];
        foreach (is_array($cache['doc']['keys'] ?? null) ? $cache['doc']['keys'] : [] as $jwk) {
            $usable = is_array($jwk) && ($jwk['kty'] ?? null) === 'RSA' && is_string($jwk['kid'] ?? null)
                && ($jwk['alg'] ?? 'RS256') === 'RS256' && ($jwk['use'] ?? 'sig') === 'sig';
            if ($usable) {
                try {
                    $key = JWK::parseKey($jwk, 'RS256');
                } catch (\Throwable) {
                    continue; // one bad key must not block the others
                }
                if ($key !== null) {
                    $keys[$jwk['kid']] = $key;
                }
            }
        }

        return $keys;
    }

    /**
     * One URL from Google's discovery document (cached), e.g. token_endpoint; also used by the Gmail connect.
     *
     * @throws LoginRefused upstream_error when discovery is unreachable or has no such URL
     */
    public function endpoint(string $name): string
    {
        $cache = $this->cached('discovery');
        if ($cache === null || $cache['expires'] <= ($this->clock)()) {
            $cache = $this->fetch('discovery', $this->base . '/.well-known/openid-configuration');
        }
        $url = $cache['doc'][$name] ?? null;

        return is_string($url) && $url !== '' ? $url : throw new LoginRefused('upstream_error');
    }

    /** @return array{doc: array<mixed>, expires: int, fetched_at: int}|null */
    private function cached(string $name): ?array
    {
        $raw = @file_get_contents($this->cacheDir . "/$name.json");
        $cache = $raw === false ? null : json_decode($raw, true);
        $ok = is_array($cache) && is_array($cache['doc'] ?? null)
            && is_int($cache['expires'] ?? null) && is_int($cache['fetched_at'] ?? null);

        /** @var array{doc: array<mixed>, expires: int, fetched_at: int}|null */
        return $ok ? $cache : null;
    }

    /** @return array{doc: array<mixed>, expires: int, fetched_at: int} */
    private function fetch(string $name, string $url): array
    {
        try {
            $res = $this->http->request('GET', $url);
        } catch (GuzzleException) {
            throw new LoginRefused('upstream_error');
        }
        $doc = $res->getStatusCode() === 200 ? json_decode((string) $res->getBody(), true) : null;
        if (!is_array($doc)) {
            throw new LoginRefused('upstream_error');
        }
        $maxAge = preg_match('/max-age=(\d+)/', $res->getHeaderLine('Cache-Control'), $m) === 1 ? (int) $m[1] : 0;
        $now = ($this->clock)();
        $cache = ['doc' => $doc, 'expires' => $now + min($maxAge, self::MAX_CACHE_SECONDS), 'fetched_at' => $now];
        if (!is_dir($this->cacheDir)) {
            @mkdir($this->cacheDir, 0700, true);
        }
        $tmp = $this->cacheDir . "/$name." . bin2hex(random_bytes(4));
        if (@file_put_contents($tmp, json_encode($cache, JSON_THROW_ON_ERROR)) !== false) {
            @rename($tmp, $this->cacheDir . "/$name.json"); // best effort; a failed write only costs a fetch
        }

        return $cache;
    }
}
