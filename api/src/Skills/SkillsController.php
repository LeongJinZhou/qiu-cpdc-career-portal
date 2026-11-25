<?php

declare(strict_types=1);

namespace Cpdc\Skills;

use Cpdc\App;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Jobs\JobsController;
use Cpdc\Profile\ProfileController;

/** The signed-in person's own skills self-rating (skills.own): areas, history, new rating, gap against a job. */
final class SkillsController
{
    /** @param array<string, string> $params */
    public static function show(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);
        $org = $user['organisation_id'];
        $service = new SkillsService($app->pdo());

        return Response::json([
            'areas' => $service->areas($org),
            'history' => $service->history($org, $user['id']),
            'jobs' => $service->comparableJobs($org, JobsController::today($app, $user)),
        ]);
    }

    /**
     * The skill areas alone: for the person rating themselves and for CPDC setting a job's skills.
     *
     * @param array<string, string> $params
     */
    public static function areas(Request $req, array $params, App $app): Response
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        if (!$app->access()->can($user, 'jobs.manage')) {
            $app->access()->require($user, 'skills.own');
        }

        return Response::json(['areas' => (new SkillsService($app->pdo()))->areas($user['organisation_id'])]);
    }

    /** @param array<string, string> $params */
    public static function rate(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'skills.assessment.json', $req->json());
        /** @var list<array{area_id: int, level: int}> $ratings */
        $ratings = $body['ratings'];
        $service = new SkillsService($app->pdo());
        $service->rate($user, $ratings, gmdate('Y-m-d H:i:s', $app->now()));

        return Response::json(['history' => $service->history($user['organisation_id'], $user['id'])], 201);
    }

    /** @param array<string, string> $params */
    public static function gap(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);

        return Response::json((new SkillsService($app->pdo()))->gap(
            $user['organisation_id'],
            $user['id'],
            (int) $params['id'],
            JobsController::today($app, $user)
        ));
    }

    /**
     * @return array{id: int, organisation_id: int, email: string|null, display_name: string, role: string,
     *     active: int, onboarded_at: string|null, provider: string}
     */
    private static function user(Request $req, App $app): array
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $app->access()->require($user, 'skills.own');

        return $user;
    }
}
