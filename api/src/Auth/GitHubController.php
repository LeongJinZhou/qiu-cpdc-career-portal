<?php

declare(strict_types=1);

namespace Cpdc\Auth;

use Cpdc\App;
use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use Cpdc\Env;
use Cpdc\Http\ErrorHandler;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use GuzzleHttp\Exception\GuzzleException;

/**
 * Optional GitHub link (docs/SPEC.md rule 6): sign in to GitHub once, the portal keeps the public profile link.
 * Scope read:user only; the token is used once and never stored.
 */
final class GitHubController
{
    public const CALLBACK_PATH = '/api/auth/github/callback';

    /** @param array<string, string> $params */
    public static function start(Request $req, array $params, App $app): Response
    {
        if ($req->user === null) {
            return Response::redirect('/login');
        }
        if (!$app->gitHubConfigured()) {
            return Response::redirect('/profile?github=off');
        }
        $state = AuthController::random();
        $cookie = PreAuth::put(PreAuth::OAUTH, [
            'provider' => 'github', 'state' => $state, 'user_id' => $req->user['id'],
        ], $app->now());
        $url = rtrim(Env::get('GITHUB_OAUTH_BASE'), '/') . '/login/oauth/authorize?' . http_build_query([
            'client_id' => Env::get('GITHUB_CLIENT_ID'),
            'redirect_uri' => rtrim($app->appUrl, '/') . self::CALLBACK_PATH,
            'scope' => 'read:user',
            'state' => $state,
            'allow_signup' => 'false',
        ], '', '&', PHP_QUERY_RFC3986);

        return Response::redirect($url, ['Set-Cookie' => $cookie]);
    }

    /** @param array<string, string> $params */
    public static function callback(Request $req, array $params, App $app): Response
    {
        $oauth = PreAuth::take($req, PreAuth::OAUTH, $app->now());
        $expire = ['Set-Cookie' => PreAuth::expired(PreAuth::OAUTH)];
        $state = $req->query['state'] ?? null;
        $user = $req->user;
        $valid = is_array($oauth) && ($oauth['provider'] ?? null) === 'github' && is_string($state)
            && is_string($oauth['state'] ?? null) && hash_equals($oauth['state'], $state)
            && $user !== null && $user['id'] === ($oauth['user_id'] ?? null);
        $code = $req->query['code'] ?? null;
        if (!$valid || !is_string($code) || $code === '' || strlen($code) > 512 || !$app->gitHubConfigured()) {
            return Response::redirect('/profile?github=failed', $expire);
        }
        try {
            $account = self::account($code, $app);
            Transaction::run($app->pdo(), function () use ($app, $user, $account): void {
                $pdo = $app->pdo();
                $held = $pdo->prepare('SELECT user_id FROM github_account WHERE organisation_id = ? AND github_id = ?');
                $held->execute([$user['organisation_id'], $account['id']]);
                $holder = $held->fetchColumn();
                if ($holder !== false && (int) $holder !== $user['id']) {
                    throw new LoginRefused('github_in_use');
                }
                $pdo->prepare(
                    'INSERT INTO github_account (user_id, organisation_id, github_id, login, profile_url, linked_at)'
                    . ' VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE github_id = VALUES(github_id),'
                    . ' login = VALUES(login), profile_url = VALUES(profile_url), linked_at = UTC_TIMESTAMP(3)'
                )->execute([$user['id'], $user['organisation_id'], $account['id'], $account['login'], $account['url']]);
                Audit::log($pdo, $user, 'github.link', 'user:' . $user['id']);
            });
        } catch (LoginRefused $e) {
            return Response::redirect(
                '/profile?github=' . ($e->result === 'github_in_use' ? 'in-use' : 'failed'),
                $expire
            );
        } catch (\Throwable $e) {
            (new ErrorHandler($app->storageDir . '/logs'))->log($e);

            return Response::redirect('/profile?github=failed', $expire);
        }

        return Response::redirect('/profile?github=linked', $expire);
    }

    /**
     * @return array{id: string, login: string, url: string}
     * @throws LoginRefused
     */
    private static function account(string $code, App $app): array
    {
        $http = GoogleOidc::httpClient();
        try {
            $res = $http->request('POST', rtrim(Env::get('GITHUB_OAUTH_BASE'), '/') . '/login/oauth/access_token', [
                'headers' => ['Accept' => 'application/json'],
                'form_params' => [
                    'client_id' => Env::get('GITHUB_CLIENT_ID'),
                    'client_secret' => Env::get('GITHUB_CLIENT_SECRET'),
                    'code' => $code,
                    'redirect_uri' => rtrim($app->appUrl, '/') . self::CALLBACK_PATH,
                ],
            ]);
            $token = json_decode((string) $res->getBody(), true);
            $access = is_array($token) && is_string($token['access_token'] ?? null) ? $token['access_token'] : null;
            if ($access === null) {
                throw new LoginRefused('token_invalid');
            }
            $res = $http->request('GET', rtrim(Env::get('GITHUB_API_BASE'), '/') . '/user', ['headers' => [
                'Authorization' => 'Bearer ' . $access,
                'Accept' => 'application/vnd.github+json',
                'User-Agent' => 'QIU-CPDC-Portal',
            ]]);
        } catch (GuzzleException) {
            throw new LoginRefused('upstream_error');
        }
        $info = $res->getStatusCode() === 200 ? json_decode((string) $res->getBody(), true) : null;
        $id = is_array($info) && is_int($info['id'] ?? null) ? (string) $info['id'] : null;
        $login = is_array($info) && is_string($info['login'] ?? null) ? $info['login'] : null;
        if ($id === null || $login === null || preg_match('/^[A-Za-z0-9-]{1,39}$/D', $login) !== 1) {
            throw new LoginRefused('upstream_error');
        }

        return ['id' => $id, 'login' => $login, 'url' => 'https://github.com/' . $login];
    }
}
