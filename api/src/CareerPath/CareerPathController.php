<?php

declare(strict_types=1);

namespace Cpdc\CareerPath;

use Cpdc\App;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Profile\ProfileController;

/**
 * Career paths: everyone signed in reads them and ticks their own steps (careerpath.view); CPDC writes them
 * (careerpath.manage).
 *
 * @phpstan-import-type Saved from CareerPathService
 */
final class CareerPathController
{
    /** @param array<string, string> $params */
    public static function overview(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'careerpath.view');
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'career-paths.query.json', $req->query);
        $asked = isset($query['programme']) ? (string) $query['programme'] : null;

        return Response::json((new CareerPathService($app->pdo()))->overview($user, $asked));
    }

    /** @param array<string, string> $params */
    public static function create(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'careerpath.manage');
        /** @var Saved $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'career-path.save.json', $req->json());
        $service = new CareerPathService($app->pdo());
        $service->create($admin, $body);

        return Response::json($service->overview($admin, $body['programme']), 201);
    }

    /** @param array<string, string> $params */
    public static function update(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'careerpath.manage');
        /** @var Saved $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'career-path.save.json', $req->json());
        $service = new CareerPathService($app->pdo());
        $service->update($admin, (int) $params['id'], $body);

        return Response::json($service->overview($admin, $body['programme']));
    }

    /** @param array<string, string> $params */
    public static function delete(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'careerpath.manage');
        (new CareerPathService($app->pdo()))->delete($admin, (int) $params['id']);

        return new Response(204);
    }

    /** @param array<string, string> $params */
    public static function progress(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'careerpath.view');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'career-path.progress.json', $req->json());
        (new CareerPathService($app->pdo()))->setDone($user, (int) $params['id'], (bool) $body['done'], $app->now());

        return new Response(204);
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
