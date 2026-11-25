<?php

declare(strict_types=1);

namespace Cpdc\Assessment;

use Cpdc\App;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Profile\ProfileController;

/** Self-assessments: CPDC writes them (assessment.manage); students and alumni take them (assessment.take). */
final class AssessmentController
{
    /** @param array<string, string> $params */
    public static function manageList(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'assessment.manage');

        return Response::json(['items' => self::service($app)->manageList($admin['organisation_id'])]);
    }

    /** @param array<string, string> $params */
    public static function manageGet(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'assessment.manage');

        return Response::json(self::service($app)->manageGet($admin['organisation_id'], (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function create(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'assessment.manage');
        $service = self::service($app);
        $id = $service->create($admin, self::body($req));

        return Response::json($service->manageGet($admin['organisation_id'], $id), 201);
    }

    /** @param array<string, string> $params */
    public static function replace(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'assessment.manage');
        $service = self::service($app);
        $service->replace($admin, (int) $params['id'], self::body($req));

        return Response::json($service->manageGet($admin['organisation_id'], (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function status(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'assessment.manage');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'assessment.status.json', $req->json());
        $status = match ($body['status']) {
            'published' => 'published',
            'archived' => 'archived',
            default => 'draft',
        };
        $service = self::service($app);
        $service->setStatus($admin, (int) $params['id'], $status);

        return Response::json($service->manageGet($admin['organisation_id'], (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function available(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'assessment.take');

        return Response::json(['items' => self::service($app)->available($user['organisation_id'], $user['id'])]);
    }

    /** @param array<string, string> $params */
    public static function show(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'assessment.take');

        return Response::json(self::service($app)->forTaking($user['organisation_id'], (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function attempt(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'assessment.take');
        /** @var array{answers: list<array{question_id: int, option_id: int}>} $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'assessment.attempt.json', $req->json());

        return Response::json(self::service($app)->attempt($user, (int) $params['id'], $body['answers']), 201);
    }

    /** @param array<string, string> $params */
    public static function myResults(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'assessment.take');

        return Response::json(['items' => self::service($app)->myResults($user['organisation_id'], $user['id'])]);
    }

    /**
     * @return array{title: string, description: string, bands: list<array{min_percent: int, label: string}>,
     *     questions: list<array{prompt: string, options: list<array{label: string, points: int}>}>}
     */
    private static function body(Request $req): array
    {
        /** @var array{title: string, description: string, bands: list<array{min_percent: int, label: string}>,
         *     questions: list<array{prompt: string, options: list<array{label: string, points: int}>}>} */
        return (new Validator())->validate(ProfileController::SCHEMAS . 'assessment.save.json', $req->json());
    }

    private static function service(App $app): AssessmentService
    {
        return new AssessmentService($app->pdo());
    }

    /**
     * @return array{id: int, organisation_id: int, email: string|null, display_name: string, role: string,
     *     active: int, onboarded_at: string|null, provider: string}
     */
    private static function user(Request $req, App $app, string $permission): array
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $app->access()->require($user, $permission);

        return $user;
    }
}
