<?php

declare(strict_types=1);

namespace Cpdc\Jobs;

use Cpdc\App;
use Cpdc\Audit\Audit;
use Cpdc\Http\ApiError;
use Cpdc\Http\Paginator;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Profile\ProfileController;
use Cpdc\Profile\ProfileService;

/** CPDC (jobs.manage): employer directory, jobs and internships, applications and their status. */
final class ManageController
{
    /** @param array<string, string> $params */
    public static function employers(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app);
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'jobs.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($admin['organisation_id']));

        return Response::json((new ManageService($app->pdo()))
            ->employers($admin['organisation_id'], (string) ($query['q'] ?? ''), $page));
    }

    /** @param array<string, string> $params */
    public static function createEmployer(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app);
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'employer.save.json', $req->json());

        return Response::json(['id' => (new ManageService($app->pdo()))->saveEmployer($admin, null, $body)], 201);
    }

    /** @param array<string, string> $params */
    public static function updateEmployer(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app);
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'employer.save.json', $req->json());
        (new ManageService($app->pdo()))->saveEmployer($admin, (int) $params['id'], $body);

        return new Response(204);
    }

    /** @param array<string, string> $params */
    public static function jobs(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app);
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'jobs.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($admin['organisation_id']));
        /** @var array{q?: string, status?: string} $filters */
        $filters = array_intersect_key($query, ['q' => 1, 'status' => 1]);

        return Response::json((new ManageService($app->pdo()))->jobs($admin['organisation_id'], $filters, $page));
    }

    /** @param array<string, string> $params */
    public static function job(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app);

        return Response::json((new ManageService($app->pdo()))->job($admin['organisation_id'], (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function createJob(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app);
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'job.save.json', $req->json());

        return Response::json(['id' => (new ManageService($app->pdo()))->saveJob($admin, null, $body)], 201);
    }

    /** @param array<string, string> $params */
    public static function updateJob(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app);
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'job.save.json', $req->json());
        (new ManageService($app->pdo()))->saveJob($admin, (int) $params['id'], $body);

        return new Response(204);
    }

    /** @param array<string, string> $params */
    public static function applications(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app);
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'jobs.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($admin['organisation_id']));
        $status = in_array($query['status'] ?? null, ApplicationStatus::ALL, true) ? (string) $query['status'] : null;

        return Response::json((new ManageService($app->pdo()))
            ->applications($admin['organisation_id'], (int) $params['id'], $status, $page));
    }

    /**
     * One application with the applicant's career profile (SPEC rule 14: CPDC sees full profiles). Audited.
     *
     * @param array<string, string> $params
     */
    public static function application(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app);
        $org = $admin['organisation_id'];
        $service = new ManageService($app->pdo());
        $application = $service->application($org, (int) $params['id']);
        $job = $service->job($org, $application['job_id']);
        $profile = (new ProfileService($app->pdo()))->get($org, $application['user_id']);
        Audit::log($app->pdo(), $admin, 'application.view', 'application:' . $application['id']);
        $application['has_cv'] = $application['cv_file'] !== null;
        unset($application['cv_file']);

        return Response::json([
            'application' => $application,
            'job' => ['id' => $job['id'], 'title' => $job['title'], 'employer_name' => $job['employer_name']],
            'profile' => $profile,
        ]);
    }

    /** @param array<string, string> $params */
    public static function status(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app);
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'application.status.json', $req->json());
        (new ManageService($app->pdo()))->setStatus($admin, (int) $params['id'], (string) $body['status']);

        return new Response(204);
    }

    /**
     * Any application's CV for CPDC. Called by JobsController::cv once jobs.manage is checked. Audited.
     *
     * @param array{id: int, organisation_id: int, ...} $admin
     */
    public static function cv(array $admin, int $id, App $app): Response
    {
        $application = (new ManageService($app->pdo()))->application($admin['organisation_id'], $id);
        if ($application['cv_file'] === null) {
            throw new ApiError(404, 'NOT_FOUND', 'Not found.');
        }
        Audit::log($app->pdo(), $admin, 'application.cv_download', 'application:' . $id);

        return (new PdfStore($app->storageDir, PdfStore::CV))
            ->download($application['cv_file'], (string) $application['cv_name']);
    }

    /**
     * @return array{id: int, organisation_id: int, email: string|null, display_name: string, role: string,
     *     active: int, onboarded_at: string|null, provider: string}
     */
    private static function admin(Request $req, App $app): array
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $app->access()->require($user, 'jobs.manage');

        return $user;
    }
}
