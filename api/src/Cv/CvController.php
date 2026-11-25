<?php

declare(strict_types=1);

namespace Cpdc\Cv;

use Cpdc\App;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Profile\ProfileController;

/**
 * The signed-in person's own CV (cv.own). No other person's CV is reachable here.
 *
 * @phpstan-import-type Content from CvService
 */
final class CvController
{
    /** @param array<string, string> $params */
    public static function show(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);

        return Response::json((new CvService($app->pdo()))->get($user));
    }

    /** @param array<string, string> $params */
    public static function save(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);
        /** @var Content $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'cv.save.json', $req->json());
        $service = new CvService($app->pdo());
        $service->save($user, $body);

        return Response::json($service->get($user));
    }

    /**
     * @return array{id: int, organisation_id: int, email: string|null, display_name: string, role: string,
     *     active: int, onboarded_at: string|null, provider: string}
     */
    private static function user(Request $req, App $app): array
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $app->access()->require($user, 'cv.own');

        return $user;
    }
}
