<?php

declare(strict_types=1);

namespace Cpdc\Auth;

use Cpdc\Env;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;

/**
 * "Sign In with LinkedIn using OpenID Connect": authorization code, then the userinfo endpoint over TLS with the
 * access token. LinkedIn gives only sub, name, email, email_verified and picture (docs/SPEC.md rule 7); the
 * portal never asks for more and never stores the token.
 *
 * @phpstan-type LinkedInIdentity array{sub: string, name: string|null, email: string|null, picture: string|null}
 */
final class LinkedInOidc
{
    public const SCOPE = 'openid profile email';
    public const CALLBACK_PATH = '/api/auth/linkedin/callback';

    public function __construct(
        private readonly ClientInterface $http,
        private readonly string $oauthBase,
        private readonly string $apiBase,
        private readonly string $clientId,
        #[\SensitiveParameter] private readonly string $clientSecret,
        private readonly string $redirectUri
    ) {
    }

    /** Null when LinkedIn is not set up (no client id or secret): the screens then say so. */
    public static function fromEnv(string $appUrl): ?self
    {
        $id = trim((string) getenv('LINKEDIN_CLIENT_ID'));
        $secret = trim((string) getenv('LINKEDIN_CLIENT_SECRET'));
        if ($id === '' || $secret === '') {
            return null;
        }

        return new self(
            GoogleOidc::httpClient(),
            rtrim(Env::get('LINKEDIN_OAUTH_BASE'), '/'),
            rtrim(Env::get('LINKEDIN_API_BASE'), '/'),
            $id,
            $secret,
            rtrim($appUrl, '/') . self::CALLBACK_PATH
        );
    }

    public function authorizationUrl(string $state): string
    {
        return $this->oauthBase . '/oauth/v2/authorization?' . http_build_query([
            'response_type' => 'code',
            'client_id' => $this->clientId,
            'redirect_uri' => $this->redirectUri,
            'scope' => self::SCOPE,
            'state' => $state,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /** @return LinkedInIdentity */
    public function identity(string $code): array
    {
        try {
            $res = $this->http->request('POST', $this->oauthBase . '/oauth/v2/accessToken', ['form_params' => [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'redirect_uri' => $this->redirectUri,
            ]]);
        } catch (GuzzleException) {
            throw new LoginRefused('upstream_error');
        }
        $status = $res->getStatusCode();
        if ($status >= 400 && $status < 500) {
            throw new LoginRefused('token_invalid');
        }
        $token = $status === 200 ? json_decode((string) $res->getBody(), true) : null;
        $accessToken = is_array($token) && is_string($token['access_token'] ?? null) ? $token['access_token'] : null;
        if ($accessToken === null) {
            throw new LoginRefused('upstream_error');
        }
        unset($token);
        try {
            $res = $this->http->request('GET', $this->apiBase . '/v2/userinfo', [
                'headers' => ['Authorization' => 'Bearer ' . $accessToken, 'Accept' => 'application/json'],
            ]);
        } catch (GuzzleException) {
            throw new LoginRefused('upstream_error');
        }
        $info = $res->getStatusCode() === 200 ? json_decode((string) $res->getBody(), true) : null;

        return self::fromUserinfo(is_array($info) ? $info : []);
    }

    /**
     * The fields the portal keeps: the email only when LinkedIn verified it and it is not a QIU address (it closes
     * at graduation, SPEC rule 15), the photo only from LinkedIn's image host.
     *
     * @param array<mixed> $info decoded userinfo
     * @return LinkedInIdentity
     */
    public static function fromUserinfo(array $info): array
    {
        $sub = $info['sub'] ?? null;
        if (!is_string($sub) || $sub === '' || strlen($sub) > 64) {
            throw new LoginRefused('token_invalid');
        }
        $name = is_string($info['name'] ?? null) ? trim($info['name']) : '';
        $picture = is_string($info['picture'] ?? null) ? trim($info['picture']) : '';

        return [
            'sub' => $sub,
            'name' => $name === '' ? null : mb_substr($name, 0, 200),
            'email' => self::contactEmail($info),
            'picture' => self::photoAllowed($picture) ? $picture : null,
        ];
    }

    /** @param array<mixed> $info */
    public static function contactEmail(array $info): ?string
    {
        if (($info['email_verified'] ?? null) !== true || !is_string($info['email'] ?? null)) {
            return null;
        }
        $email = strtolower(trim($info['email']));
        $valid = filter_var($email, FILTER_VALIDATE_EMAIL) !== false && strlen($email) <= 254;

        return $valid && !QiuEmail::is($email) ? $email : null;
    }

    /** https on LinkedIn's image host, no userinfo or port, no quote, space or backslash. */
    public static function photoAllowed(string $url): bool
    {
        return strlen($url) <= 500
            && preg_match('#^https://media\.licdn\.com/[^\s"\'<>\\\\]*$#Di', $url) === 1;
    }
}
