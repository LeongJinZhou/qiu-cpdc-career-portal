<?php

declare(strict_types=1);

namespace Cpdc\Workshops;

use Cpdc\App;
use Cpdc\Audit\Audit;
use Cpdc\Http\Csv;
use Cpdc\Http\Paginator;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Profile\ProfileController;

/**
 * Workshops and events: everyone signed in lists and RSVPs (workshops.view, workshops.rsvp); CPDC creates, edits,
 * cancels, checks people in and downloads the attendance CSV (workshops.manage).
 *
 * @phpstan-import-type Saved from WorkshopService
 */
final class WorkshopController
{
    /** @param array<string, string> $params */
    public static function list(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'workshops.view');
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'workshops.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($user['organisation_id']));
        $manager = $app->access()->can($user, 'workshops.manage');

        return Response::json(self::service($app, $user)->list(
            $user,
            $manager,
            ($query['when'] ?? 'upcoming') === 'past',
            $page,
            $app->now()
        ));
    }

    /** @param array<string, string> $params */
    public static function show(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'workshops.view');

        return Response::json(self::detail($app, $user, (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function create(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'workshops.manage');
        /** @var Saved $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'workshop.save.json', $req->json());
        $id = self::service($app, $admin)->create($admin, $body, $app->now());

        return Response::json(self::detail($app, $admin, $id), 201);
    }

    /** @param array<string, string> $params */
    public static function update(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'workshops.manage');
        /** @var Saved $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'workshop.save.json', $req->json());
        self::service($app, $admin)->update($admin, (int) $params['id'], $body, $app->now());

        return Response::json(self::detail($app, $admin, (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function cancel(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'workshops.manage');
        self::service($app, $admin)->cancel($admin, (int) $params['id']);

        return Response::json(self::detail($app, $admin, (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function rsvp(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'workshops.rsvp');
        self::service($app, $user)->rsvp($user, (int) $params['id'], $app->now());

        return Response::json(self::detail($app, $user, (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function cancelRsvp(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'workshops.rsvp');
        self::service($app, $user)->cancelRsvp($user, (int) $params['id'], $app->now());

        return Response::json(self::detail($app, $user, (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function checkIn(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'workshops.rsvp');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'workshop.checkin.json', $req->json());
        $opens = $app->settings($user['organisation_id'])->int('workshop_checkin_opens_minutes');
        self::service($app, $user)->checkIn($user, (int) $params['id'], (string) $body['code'], $opens, $app->now());

        return Response::json(self::detail($app, $user, (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function attendees(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'workshops.manage');

        return Response::json(['items' => self::service($app, $admin)->attendees($admin, (int) $params['id'])]);
    }

    /** @param array<string, string> $params */
    public static function attendance(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'workshops.manage');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'workshop.attendance.json', $req->json());
        $service = self::service($app, $admin);
        $id = (int) $params['id'];
        $service->markAttendance($admin, $id, (int) $body['user_id'], (bool) $body['present'], $app->now());

        return Response::json(['items' => $service->attendees($admin, $id)]);
    }

    /** @param array<string, string> $params */
    public static function export(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'workshops.manage');
        $id = (int) $params['id'];
        $service = self::service($app, $admin);
        $rows = $service->attendees($admin, $id);
        Audit::log($app->pdo(), $admin, 'workshop.export', "workshop:$id", ['rows' => count($rows)]);
        $zone = $service->zone();
        $header = ['Name', 'Matric or staff no', 'QIU email', 'Role', 'Faculty or department', 'RSVP', 'Checked in',
            'Checked in at (Malaysia time)', 'How', 'LinkedIn'];

        return Csv::response("workshop-$id-attendance.csv", $header, array_map(
            static fn (array $r): array => [
                $r['display_name'], $r['matric_no'] ?? $r['employee_id'], $r['email'], $r['role'], $r['department'],
                $r['status'] === 'going' ? 'Seat' : 'Waitlist', $r['checked_in_at'] === null ? 'No' : 'Yes',
                WorkshopTime::readable($r['checked_in_at'], $zone),
                $r['checkin_method'], $r['linkedin_url'],
            ],
            $rows
        ));
    }

    /**
     * @param array{id: int, organisation_id: int, role: string, ...} $user
     * @return array<string, mixed>
     */
    private static function detail(App $app, array $user, int $id): array
    {
        $manager = $app->access()->can($user, 'workshops.manage');

        return self::service($app, $user)->get($user, $manager, $id, $app->now());
    }

    /** @param array{organisation_id: int, ...} $user */
    private static function service(App $app, array $user): WorkshopService
    {
        return new WorkshopService($app->pdo(), $app->settings($user['organisation_id'])->string('display_timezone'));
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
