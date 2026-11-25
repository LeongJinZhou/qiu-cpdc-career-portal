<?php

declare(strict_types=1);

namespace Cpdc\Auth;

use Cpdc\App;
use Cpdc\Env;
use Cpdc\Http\ApiError;
use Cpdc\Http\ErrorHandler;
use Cpdc\Http\Middleware\Session;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Profile\Onboarding;
use Firebase\JWT\JWT;
use PDO;

/**
 * Google sign-in for students and staff (docs/SPEC.md rules 1-3), /api/me and sign-out. Start and callback are
 * public; state, nonce and the PKCE verifier live in a single-use pre-auth session.
 */
final class AuthController
{
    public const LOGIN_PATHS = ['/api/auth/google/start', '/api/auth/google/callback'];

    /** @param array<string, string> $params */
    public static function start(Request $req, array $params, App $app): Response
    {
        $state = self::random();
        $nonce = self::random();
        $verifier = self::random();
        $challenge = JWT::urlsafeB64Encode(hash('sha256', $verifier, true));
        $domains = self::domains($app);
        try {
            $url = $app->google()->authorizationUrl($state, $nonce, $challenge, count($domains) === 1 ? $domains[0] : '');
        } catch (LoginRefused $e) {
            return self::refuse($req, $app, $e->result); // discovery unreachable
        }
        $cookie = PreAuth::put(PreAuth::OAUTH, [
            'provider' => 'google', 'state' => $state, 'nonce' => $nonce, 'verifier' => $verifier,
        ], $app->now());

        return Response::redirect($url, ['Set-Cookie' => $cookie]);
    }

    /** @param array<string, string> $params */
    public static function callback(Request $req, array $params, App $app): Response
    {
        $org = $app->defaultOrganisationId;
        $oauth = PreAuth::take($req, PreAuth::OAUTH, $app->now()); // single use: gone before anything else happens
        $email = null;
        try {
            $state = $req->query['state'] ?? null;
            $valid = $oauth !== null && ($oauth['provider'] ?? null) === 'google'
                && is_string($state) && is_string($oauth['state'] ?? null) && hash_equals($oauth['state'], $state);
            if (!$valid) {
                throw new LoginRefused('state_invalid');
            }
            $code = $req->query['code'] ?? null;
            if (isset($req->query['error']) || !is_string($code) || $code === '' || strlen($code) > 2048) {
                throw new LoginRefused('denied');
            }
            $google = $app->google();
            $tokens = $google->exchange($code, (string) $oauth['verifier']);
            $claims = $google->verify($tokens['id_token'], (string) $oauth['nonce'], self::domains($app));
            $email = $claims['email'];
            $person = DirectoryProfile::withDirectory(
                $google->person($tokens['access_token']),
                $google->directoryEntry($tokens['access_token'], $email)
            );
            unset($tokens); // raw tokens are never stored or logged
            $profile = DirectoryProfile::fromPerson($person);
            unset($person);
            $types = $app->settings($org)->list('student_employee_types');
            $user = (new LoginService($app->pdo(), Env::get('SUPERADMIN_EMAIL')))->login($org, $claims, $profile, $types);
        } catch (LoginRefused $e) {
            return self::refuse($req, $app, $e->result, $e->email ?? $email, $e->userId);
        } catch (\Throwable $e) {
            // Anything else mid-login is still a refused, logged login; the detail goes to the server log only.
            try {
                $response = self::refuse($req, $app, 'upstream_error', $email);
            } catch (\Throwable) {
                throw $e;
            }
            (new ErrorHandler($app->storageDir . '/logs'))->log($e);

            return $response;
        }

        Session::forget($req->cookies[Session::COOKIE] ?? ''); // rotation: no earlier session id survives sign-in
        $cookie = $app->session()->login($user, 'google');
        LoginService::log($app->pdo(), $org, $user['id'], 'google', $email, 'success', $req->remoteAddr);

        return Response::redirect('/', ['Set-Cookie' => [$cookie, PreAuth::expired(PreAuth::OAUTH)]]);
    }

    /** One login_log row, then the sign-in page with a short reason code (never details). */
    public static function refuse(
        Request $req,
        App $app,
        string $result,
        ?string $email = null,
        ?int $userId = null
    ): Response {
        LoginService::log($app->pdo(), $app->defaultOrganisationId, $userId, 'google', $email, $result, $req->remoteAddr);
        $shown = match ($result) {
            'domain' => 'domain',
            'inactive' => 'inactive',
            'rate_limited' => 'busy',
            default => 'failed',
        };

        return Response::redirect('/login?error=' . $shown, ['Set-Cookie' => PreAuth::expired(PreAuth::OAUTH)]);
    }

    /** @param array<string, string> $params */
    public static function me(Request $req, array $params, App $app): Response
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $pdo = $app->pdo();
        $stmt = $pdo->prepare(
            'SELECT u.id, u.email, u.display_name, u.picture_url, u.role, u.matric_no, u.employee_id, u.department,'
            . ' u.job_title, u.onboarded_at, l.profile_url AS linkedin_url,'
            . ' (g.user_id IS NOT NULL) AS github_linked, g.profile_url AS github_url'
            . ' FROM `user` u LEFT JOIN linkedin_account l ON l.user_id = u.id'
            . ' LEFT JOIN github_account g ON g.user_id = u.id WHERE u.id = ? AND u.organisation_id = ?'
        );
        $stmt->execute([$user['id'], $user['organisation_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in.');
        }
        $row['id'] = (int) $row['id'];
        $row['github_linked'] = (bool) $row['github_linked'];
        $settings = $app->settings($user['organisation_id']);

        return Response::json([
            'user' => $row,
            'signed_in_with' => $user['provider'],
            'permissions' => array_keys($app->access()->permissions($user)),
            'csrf_token' => $req->csrfToken,
            'onboarding' => Onboarding::state($pdo, $user, $app->linkedInConfigured()),
            'job_confirmation_due' => Onboarding::jobConfirmationDue(
                $pdo,
                $user,
                $settings->int('alumni_job_confirm_days'),
                $app->now()
            ),
            'features' => [
                'linkedin' => $app->linkedInConfigured(),
                'github' => $app->gitHubConfigured(),
            ],
        ]);
    }

    /** @param array<string, string> $params */
    public static function logout(Request $req, array $params, App $app): Response
    {
        Session::forget($req->cookies[Session::COOKIE] ?? '');

        return new Response(204, '', ['Set-Cookie' => Session::expiredCookie()]);
    }

    /** @return list<string> */
    private static function domains(App $app): array
    {
        $domains = array_values(array_filter(
            $app->settings($app->defaultOrganisationId)->list('google_hosted_domains'),
            'is_string'
        ));

        return $domains !== [] ? $domains : throw new \UnexpectedValueException('google_hosted_domains is empty');
    }

    /** 32 random bytes, base64url: state, nonce and the PKCE verifier (43 characters). */
    public static function random(): string
    {
        return JWT::urlsafeB64Encode(random_bytes(32));
    }
}
