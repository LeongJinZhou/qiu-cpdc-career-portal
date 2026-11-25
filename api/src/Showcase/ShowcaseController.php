<?php

declare(strict_types=1);

namespace Cpdc\Showcase;

use Cpdc\App;
use Cpdc\Http\ApiError;
use Cpdc\Http\Paginator;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Profile\ProfileController;

/** FYP showcase: the student's project (showcase.own) and the talent feed for staff and CPDC (showcase.browse). */
final class ShowcaseController
{
    /** @param array<string, string> $params */
    public static function mine(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'showcase.own');

        return Response::json(['project' => self::service($app)->mine($user['organisation_id'], $user['id'])]);
    }

    /** @param array<string, string> $params */
    public static function save(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'showcase.own');
        /** @var array{title: string, summary: string, tech: list<string>, project_year: int, repo_url?: string,
         *     demo_url?: string, published: bool} $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'showcase.save.json', $req->json());

        return Response::json(['project' => self::service($app)->save($user, $body)]);
    }

    /** @param array<string, string> $params */
    public static function uploadImage(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'showcase.own');
        $max = $app->settings($user['organisation_id'])->int('showcase_image_max_bytes');

        return Response::json(['project' => self::service($app)->setImage($user, $req->file('file'), $max)]);
    }

    /** @param array<string, string> $params */
    public static function removeImage(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'showcase.own');

        return Response::json(['project' => self::service($app)->removeImage($user)]);
    }

    /** @param array<string, string> $params */
    public static function feed(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'showcase.browse');
        $org = $user['organisation_id'];
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'showcase.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($org));
        $list = self::service($app)->feed($org, $query, $page->perPage, $page->offset());

        return Response::json($page->envelope($list['rows'], $list['total']));
    }

    /** @param array<string, string> $params */
    public static function filters(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'showcase.browse');

        return Response::json(self::service($app)->filters($user['organisation_id']));
    }

    /** @param array<string, string> $params */
    public static function show(Request $req, array $params, App $app): Response
    {
        [$user, $browse] = self::viewer($req, $app);

        $project = self::service($app)->show($user['organisation_id'], (int) $params['id'], $user['id'], $browse);

        return Response::json($project);
    }

    /** @param array<string, string> $params */
    public static function image(Request $req, array $params, App $app): Response
    {
        [$user, $browse] = self::viewer($req, $app);
        $file = self::service($app)->image($user['organisation_id'], (int) $params['id'], $user['id'], $browse);
        $ext = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'][$file['mime']];

        return new Response(200, (string) file_get_contents($file['path']), [
            'Content-Type' => $file['mime'],
            'Content-Disposition' => 'inline; filename="project.' . $ext . '"',
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    /**
     * Talent-feed readers see published projects; a student with only showcase.own sees their own.
     *
     * @return array{0: array{id: int, organisation_id: int, email: string|null, display_name: string, role: string,
     *     active: int, onboarded_at: string|null, provider: string}, 1: bool}
     */
    private static function viewer(Request $req, App $app): array
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $browse = $app->access()->can($user, 'showcase.browse');
        if (!$browse && !$app->access()->can($user, 'showcase.own')) {
            throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this.');
        }

        return [$user, $browse];
    }

    private static function service(App $app): ShowcaseService
    {
        return new ShowcaseService($app->pdo(), $app->storageDir . '/showcase');
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
