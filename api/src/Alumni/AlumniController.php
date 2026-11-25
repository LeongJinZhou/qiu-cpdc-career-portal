<?php

declare(strict_types=1);

namespace Cpdc\Alumni;

use Cpdc\App;
use Cpdc\Audit\Audit;
use Cpdc\Auth\PreAuth;
use Cpdc\Http\ApiError;
use Cpdc\Http\Csv;
use Cpdc\Http\Paginator;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Profile\ProfileController;

/** Alumni tracker, conversion and graduate registrations (docs/SPEC.md rules 9, 10, 13, 14). */
final class AlumniController
{
    /** @param array<string, string> $params */
    public static function list(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'alumni.track');
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'list.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($admin['organisation_id']));
        $result = (new AlumniService($app->pdo()))->list($admin['organisation_id'], $query, $page);
        Audit::log($app->pdo(), $admin, 'alumni.view', 'alumni', ['page' => $page->page]);

        return Response::json($result);
    }

    /** @param array<string, string> $params */
    public static function stats(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'alumni.track');

        return Response::json(['rows' => (new AlumniService($app->pdo()))->stats($admin['organisation_id'])]);
    }

    /** @param array<string, string> $params */
    public static function export(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'alumni.track');
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'list.query.json', $req->query);
        $rows = (new AlumniService($app->pdo()))->all($admin['organisation_id'], $query);
        Audit::log($app->pdo(), $admin, 'alumni.export', 'alumni', ['rows' => count($rows)]);
        $header = ['Name', 'Matric no', 'Faculty', 'Programme', 'Graduation year', 'Status', 'Job title', 'Company',
            'Location', 'Personal email', 'LinkedIn', 'Job confirmed', 'Last sign-in'];

        return Csv::response('alumni-' . gmdate('Y-m-d') . '.csv', $header, array_map(static fn (array $r): array => [
            $r['display_name'], $r['matric_no'], $r['faculty'], $r['programme'], $r['graduation_year'],
            $r['employment_status'], $r['current_title'], $r['current_company'], $r['location'],
            $r['personal_email'], $r['linkedin_url'], $r['job_confirmed_at'], $r['last_sign_in_at'],
        ], $rows));
    }

    /** @param array<string, string> $params */
    public static function convertOne(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'alumni.convert');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'alumni-convert.json', $req->json());
        $year = $body['graduation_year'] ?? throw ApiError::validation('graduation_year', 'Add the graduation year.');

        return Response::json((new AlumniService($app->pdo()))->convert($admin, (int) $params['id'], (int) $year));
    }

    /** @param array<string, string> $params */
    public static function convertList(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'alumni.convert');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'alumni-convert.json', $req->json());
        $rows = $body['rows'] ?? throw ApiError::validation('rows', 'Add at least one matric number.');

        return Response::json(['results' => (new AlumniService($app->pdo()))->convertList($admin, $rows)]);
    }

    /** @param array<string, string> $params */
    public static function registrations(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'registrations.decide');
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'list.query.json', $req->query);
        $status = in_array($query['status'] ?? 'waiting', ['waiting', 'approved', 'refused'], true)
            ? ($query['status'] ?? 'waiting') : throw ApiError::validation('status');
        $stmt = $app->pdo()->prepare(
            'SELECT r.id, r.matric_no, r.name, r.programme, r.faculty, r.graduation_year, r.status, r.created_at,'
            . ' r.decided_at, r.matched_user_id, m.display_name AS matched_name, l.profile_url AS linkedin_url'
            . ' FROM graduate_registration r LEFT JOIN `user` m ON m.id = r.matched_user_id'
            . ' LEFT JOIN linkedin_account l ON l.user_id = r.user_id'
            . ' WHERE r.organisation_id = ? AND r.status = ? ORDER BY r.created_at DESC LIMIT 200'
        );
        $stmt->execute([$admin['organisation_id'], $status]);

        return Response::json(['items' => array_map(static function (array $r): array {
            $r['id'] = (int) $r['id'];
            $r['graduation_year'] = (int) $r['graduation_year'];
            $r['matched_user_id'] = $r['matched_user_id'] === null ? null : (int) $r['matched_user_id'];

            return $r;
        }, $stmt->fetchAll(\PDO::FETCH_ASSOC))]);
    }

    /** @param array<string, string> $params */
    public static function approve(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'registrations.decide');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'registration.json', $req->json());

        return Response::json((new RegistrationService($app->pdo()))->approve(
            $admin,
            (int) $params['id'],
            $body['faculty'] ?? null
        ));
    }

    /** @param array<string, string> $params */
    public static function refuse(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'registrations.decide');
        (new RegistrationService($app->pdo()))->refuse($admin, (int) $params['id']);

        return new Response(204);
    }

    /**
     * Public: the LinkedIn name waiting for a graduate registration (rule 9), to greet the person.
     *
     * @param array<string, string> $params
     */
    public static function pendingRegistration(Request $req, array $params, App $app): Response
    {
        $stash = PreAuth::peek($req, PreAuth::REGISTRATION, $app->now());
        $identity = is_array($stash) && is_array($stash['identity'] ?? null) ? $stash['identity'] : null;
        if ($identity === null) {
            throw new ApiError(404, 'NO_REGISTRATION', 'Sign in with LinkedIn again to register.');
        }

        return Response::json(['name' => $identity['name'] ?? null]);
    }

    /** @param array<string, string> $params */
    public static function register(Request $req, array $params, App $app): Response
    {
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'registration.json', $req->json());
        foreach (['matric_no', 'programme', 'graduation_year'] as $field) {
            if (!isset($body[$field])) {
                throw ApiError::validation($field, 'This field is required.');
            }
        }
        $stash = PreAuth::take($req, PreAuth::REGISTRATION, $app->now());
        $identity = is_array($stash) && is_array($stash['identity'] ?? null) ? $stash['identity'] : null;
        if ($identity === null || !is_string($identity['sub'] ?? null)) {
            throw new ApiError(410, 'NO_REGISTRATION', 'Sign in with LinkedIn again to register.');
        }
        /** @var array{sub: string, name: string|null, email: string|null, picture: string|null} $identity */
        (new RegistrationService($app->pdo()))->register($app->defaultOrganisationId, $identity, $body);

        return new Response(201, '', ['Set-Cookie' => PreAuth::expired(PreAuth::REGISTRATION)]);
    }

    /**
     * @return array{id: int, organisation_id: int, email: string|null, display_name: string, role: string,
     *     active: int, onboarded_at: string|null, provider: string}
     */
    private static function admin(Request $req, App $app, string $permission): array
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $app->access()->require($user, $permission);

        return $user;
    }
}
