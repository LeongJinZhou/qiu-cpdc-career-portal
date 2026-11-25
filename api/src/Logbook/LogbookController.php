<?php

declare(strict_types=1);

namespace Cpdc\Logbook;

use Cpdc\App;
use Cpdc\Audit\Audit;
use Cpdc\Http\Paginator;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Logbook\Mail\Mailers;
use Cpdc\Profile\ProfileController;

/**
 * Internship logbook: the student's weeks (logbook.own), the supervisor's link (public, by token) and CPDC's
 * progress view (logbook.track).
 */
final class LogbookController
{
    /** @param array<string, string> $params */
    public static function mine(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'logbook.own');

        $org = $user['organisation_id'];

        return Response::json(self::service($app, $org)->mine($org, $user['id']));
    }

    /** @param array<string, string> $params */
    public static function saveInternship(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'logbook.own');
        /** @var array{company: string, supervisor_name: string, supervisor_email: string, start_date: string,
         *     end_date: string} $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'logbook.internship.json', $req->json());

        return Response::json(self::service($app, $user['organisation_id'])->saveInternship($user, $body));
    }

    /** @param array<string, string> $params */
    public static function createEntry(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'logbook.own');

        $service = self::service($app, $user['organisation_id']);

        return Response::json($service->saveEntry($user, self::entryBody($req)), 201);
    }

    /** @param array<string, string> $params */
    public static function updateEntry(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'logbook.own');
        $service = self::service($app, $user['organisation_id']);

        return Response::json($service->saveEntry($user, self::entryBody($req), (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function submit(Request $req, array $params, App $app): Response
    {
        return self::send($req, $params, $app, false);
    }

    /** @param array<string, string> $params */
    public static function resend(Request $req, array $params, App $app): Response
    {
        return self::send($req, $params, $app, true);
    }

    /** @param array<string, string> $params */
    public static function review(Request $req, array $params, App $app): Response
    {
        $org = $app->defaultOrganisationId;

        return Response::json(self::service($app, $org)->review($params['token']));
    }

    /** @param array<string, string> $params */
    public static function decide(Request $req, array $params, App $app): Response
    {
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'logbook.review.json', $req->json());
        $decision = $body['decision'] === 'approve' ? 'approve' : 'return';
        $service = self::service($app, $app->defaultOrganisationId);

        return Response::json($service->decide($params['token'], $decision, (string) ($body['comment'] ?? '')));
    }

    /** @param array<string, string> $params */
    public static function students(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'logbook.track');
        $org = $admin['organisation_id'];
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'logbook.students.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($org));
        $list = self::service($app, $org)->students($org, $query, $page->perPage, $page->offset());

        return Response::json($page->envelope($list['rows'], $list['total']));
    }

    /** @param array<string, string> $params */
    public static function student(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'logbook.track');
        $org = $admin['organisation_id'];
        $detail = self::service($app, $org)->student($org, (int) $params['id']);
        Audit::log($app->pdo(), $admin, 'logbook.view', 'user:' . $params['id']);

        return Response::json($detail);
    }

    /** @param array<string, string> $params */
    private static function send(Request $req, array $params, App $app, bool $resend): Response
    {
        $user = self::user($req, $app, 'logbook.own');
        $org = $user['organisation_id'];
        $days = $app->settings($org)->int('logbook_review_link_days');

        return Response::json(self::service($app, $org)->send($user, (int) $params['id'], $days, $resend));
    }

    /** @return array{week_start: string, hours: int, activities: string, learnings: string} */
    private static function entryBody(Request $req): array
    {
        /** @var array{week_start: string, hours: int, activities: string, learnings: string} */
        return (new Validator())->validate(ProfileController::SCHEMAS . 'logbook.entry.json', $req->json());
    }

    private static function service(App $app, int $org): LogbookService
    {
        return new LogbookService(
            $app->pdo(),
            Mailers::fromEnv($app->storageDir),
            $app->appUrl,
            $app->now(),
            $app->settings($org)->string('display_timezone')
        );
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
