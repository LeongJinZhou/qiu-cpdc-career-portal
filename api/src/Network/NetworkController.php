<?php

declare(strict_types=1);

namespace Cpdc\Network;

use Cpdc\App;
use Cpdc\Audit\Audit;
use Cpdc\Http\Paginator;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Profile\ProfileController;

/** Alumni directory and mentoring (docs/SPEC.md section 9). Every handler checks its permission first. */
final class NetworkController
{
    /** @param array<string, string> $params */
    public static function directory(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'network.view');
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'network-directory.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($user['organisation_id']));
        $service = new DirectoryService($app->pdo());
        /** @var array{q?: string, faculty?: string, year?: int, mentors?: string} $query */
        $month = MentoringService::monthStart(self::now($app));
        $result = $service->list($user['organisation_id'], $query, $page, $month);

        return Response::json($result + ['faculties' => $service->faculties($user['organisation_id'])]);
    }

    /** @param array<string, string> $params */
    public static function showOwn(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'network.own');

        return Response::json((new DirectoryService($app->pdo()))->own($user['organisation_id'], $user['id']));
    }

    /** @param array<string, string> $params */
    public static function saveOwn(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'network.own');
        /** @var array<string, bool> $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'network-profile.json', $req->json());
        $service = new DirectoryService($app->pdo());
        $service->save($user['organisation_id'], $user['id'], $body);

        return Response::json($service->own($user['organisation_id'], $user['id']));
    }

    /** @param array<string, string> $params */
    public static function saveOffer(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'network.own');
        /** @var array{active: bool, topics: list<string>, slots_per_month: int} $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'mentor-offer.json', $req->json());
        (new MentoringService($app->pdo()))->saveOffer($user, $body);

        return Response::json((new DirectoryService($app->pdo()))->own($user['organisation_id'], $user['id']));
    }

    /** @param array<string, string> $params */
    public static function ask(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'mentoring.request');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'mentor-request.json', $req->json());
        $max = $app->settings($user['organisation_id'])->int('mentor_open_requests_max');
        $id = (new MentoringService($app->pdo()))
            ->request($user, (int) $params['id'], (string) $body['message'], self::now($app), $max);

        return Response::json(['id' => $id], 201);
    }

    /** @param array<string, string> $params */
    public static function requests(Request $req, array $params, App $app): Response
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $access = $app->access();
        if (!$access->can($user, 'mentoring.request') && !$access->can($user, 'network.own')) {
            $access->require($user, 'mentoring.request'); // throws the usual 403
        }

        return Response::json((new MentoringService($app->pdo()))->mine($user));
    }

    /** @param array<string, string> $params */
    public static function accept(Request $req, array $params, App $app): Response
    {
        return self::decide($req, $params, $app, true);
    }

    /** @param array<string, string> $params */
    public static function decline(Request $req, array $params, App $app): Response
    {
        return self::decide($req, $params, $app, false);
    }

    /** @param array<string, string> $params */
    public static function withdraw(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'mentoring.request');
        (new MentoringService($app->pdo()))->withdraw($user, (int) $params['id'], self::now($app));

        return new Response(204);
    }

    /** @param array<string, string> $params */
    public static function activity(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'mentoring.activity');
        $result = (new MentoringService($app->pdo()))->activity($admin['organisation_id'], self::now($app));
        Audit::log($app->pdo(), $admin, 'mentoring.view', 'mentoring');

        return Response::json($result);
    }

    /** @param array<string, string> $params */
    private static function decide(Request $req, array $params, App $app, bool $accept): Response
    {
        $user = self::user($req, $app, 'network.own');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'mentor-decision.json', $req->json());
        (new MentoringService($app->pdo()))
            ->decide($user, (int) $params['id'], $accept, $body['reply'] ?? null, self::now($app));

        return new Response(204);
    }

    private static function now(App $app): string
    {
        return gmdate('Y-m-d H:i:s', $app->now());
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
