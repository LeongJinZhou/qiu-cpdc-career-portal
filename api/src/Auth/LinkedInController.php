<?php

declare(strict_types=1);

namespace Cpdc\Auth;

use Cpdc\App;
use Cpdc\Http\ErrorHandler;
use Cpdc\Http\Middleware\Session;
use Cpdc\Http\Request;
use Cpdc\Http\Response;

/**
 * LinkedIn: link to the signed-in account (mode=link) or alumni sign-in (mode=signin), docs/SPEC.md rules 4-9.
 * Both are browser navigations; every outcome is a redirect to a page that explains it.
 */
final class LinkedInController
{
    public const PATHS = ['/api/auth/linkedin/start', LinkedInOidc::CALLBACK_PATH];

    /** Pages a link may return to (never a URL from the request). */
    private const RETURNS = ['/onboarding', '/profile'];

    /** @param array<string, string> $params */
    public static function start(Request $req, array $params, App $app): Response
    {
        $mode = $req->query['mode'] ?? null;
        $return = in_array($req->query['return'] ?? null, self::RETURNS, true) ? $req->query['return'] : '/onboarding';
        $linkedin = $app->linkedIn();
        $userId = null;
        if ($mode === 'link') {
            if ($req->user === null) {
                return Response::redirect('/login');
            }
            if ($linkedin === null) {
                return Response::redirect($return . '?linkedin=off');
            }
            $userId = $req->user['id'];
        } elseif ($mode === 'signin') {
            if ($linkedin === null) {
                return Response::redirect('/login?error=linkedin-off');
            }
        } else {
            return Response::redirect('/login');
        }
        $state = AuthController::random();
        $cookie = PreAuth::put(PreAuth::OAUTH, [
            'provider' => 'linkedin',
            'mode' => $mode,
            'state' => $state,
            'user_id' => $userId,
            'return' => $return,
        ], $app->now());

        return Response::redirect($linkedin->authorizationUrl($state), ['Set-Cookie' => $cookie]);
    }

    /** @param array<string, string> $params */
    public static function callback(Request $req, array $params, App $app): Response
    {
        $org = $app->defaultOrganisationId;
        $oauth = PreAuth::take($req, PreAuth::OAUTH, $app->now());
        $mode = is_array($oauth) && ($oauth['provider'] ?? null) === 'linkedin' ? $oauth['mode'] ?? null : null;
        $return = is_array($oauth) && in_array($oauth['return'] ?? null, self::RETURNS, true)
            ? (string) $oauth['return'] : '/onboarding';
        $identity = null;
        try {
            $state = $req->query['state'] ?? null;
            $valid = $mode !== null && is_string($state) && is_string($oauth['state'] ?? null)
                && hash_equals($oauth['state'], $state);
            if (!$valid) {
                throw new LoginRefused('state_invalid');
            }
            $code = $req->query['code'] ?? null;
            if (isset($req->query['error']) || !is_string($code) || $code === '' || strlen($code) > 2048) {
                throw new LoginRefused('denied');
            }
            $linkedin = $app->linkedIn() ?? throw new LoginRefused('off');
            $identity = $linkedin->identity($code);
            $service = new LinkedInService($app->pdo());

            if ($mode === 'link') {
                // The account that started the link must be the one signed in now (no link into another account).
                $user = $req->user;
                if ($user === null || $user['id'] !== ($oauth['user_id'] ?? null)) {
                    throw new LoginRefused('state_invalid');
                }
                $service->link($user, $identity);

                return self::done(Response::redirect($return . '?linkedin=linked'));
            }

            $user = $service->signIn($org, $identity);
        } catch (LoginRefused $e) {
            return self::refused($req, $app, (string) $mode, $return, $e, $identity);
        } catch (\Throwable $e) {
            (new ErrorHandler($app->storageDir . '/logs'))->log($e);

            return self::refused($req, $app, (string) $mode, $return, new LoginRefused('upstream_error'), $identity);
        }

        Session::forget($req->cookies[Session::COOKIE] ?? '');
        $cookie = $app->session()->login($user, 'linkedin');
        LoginService::log(
            $app->pdo(),
            $org,
            $user['id'],
            'linkedin',
            null,
            'success',
            $req->remoteAddr,
            $identity['sub']
        );

        return self::done(Response::redirect('/', ['Set-Cookie' => $cookie]));
    }

    /**
     * Every refusal is one login_log row (reason code and LinkedIn id only), then a page that explains it. A
     * LinkedIn account nobody holds may register as a QIU graduate (rule 9): its identity waits server side.
     *
     * @param array{sub: string, name: string|null, email: string|null, picture: string|null}|null $identity
     */
    private static function refused(
        Request $req,
        App $app,
        string $mode,
        string $return,
        LoginRefused $e,
        ?array $identity
    ): Response {
        $result = ($mode === 'link' ? 'link_' : '') . $e->result;
        LoginService::log(
            $app->pdo(),
            $app->defaultOrganisationId,
            $e->userId ?? ($mode === 'link' ? $req->user['id'] ?? null : null),
            'linkedin',
            null,
            $result,
            $req->remoteAddr,
            $identity['sub'] ?? null
        );
        if ($mode === 'link') {
            $code = match ($e->result) {
                'linkedin_in_use' => 'in-use',
                'denied' => 'cancelled',
                'state_invalid' => 'expired',
                'off' => 'off',
                default => 'failed',
            };

            return self::done(Response::redirect($return . '?linkedin=' . $code));
        }
        if ($e->result === 'linkedin_not_linked' && $identity !== null) {
            $stash = PreAuth::put(PreAuth::REGISTRATION, ['identity' => $identity], $app->now());

            return self::done(Response::redirect('/register-graduate', ['Set-Cookie' => $stash]));
        }
        $code = match ($e->result) {
            'registration_waiting' => 'linkedin-waiting',
            'linkedin_not_alumni' => 'linkedin-not-alumni',
            'inactive' => 'inactive',
            'denied' => 'linkedin-cancelled',
            'state_invalid' => 'linkedin-expired',
            'off' => 'linkedin-off',
            'rate_limited' => 'busy',
            default => 'linkedin-failed',
        };

        return self::done(Response::redirect('/login?error=' . $code));
    }

    /** The OAuth cookie is single use: always expire it in the browser too. */
    private static function done(Response $response): Response
    {
        $cookies = (array) ($response->headers['Set-Cookie'] ?? []);
        $cookies[] = PreAuth::expired(PreAuth::OAUTH);
        $response->headers['Set-Cookie'] = $cookies;

        return $response;
    }
}
