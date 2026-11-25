<?php

declare(strict_types=1);

namespace Cpdc\People;

use Cpdc\App;
use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use Cpdc\Http\Paginator;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Profile\ProfileController;
use Cpdc\Profile\ProfileService;
use PDO;

/** Admin: everyone in the portal, one person's full profile, and role changes (docs/SPEC.md section 3). */
final class PeopleController
{
    /** @param array<string, string> $params */
    public static function list(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'people.view');
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'list.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($admin['organisation_id']));
        $where = 'u.organisation_id = ?';
        $args = [$admin['organisation_id']];
        if (($query['q'] ?? '') !== '') {
            $like = '%' . addcslashes((string) $query['q'], '%_\\') . '%';
            $where .= ' AND (u.display_name LIKE ? OR u.email LIKE ? OR u.matric_no LIKE ? OR u.employee_id LIKE ?)';
            array_push($args, $like, $like, $like, $like);
        }
        if (isset($query['role'])) {
            $where .= ' AND u.role = ?';
            $args[] = $query['role'];
        }
        if (($query['faculty'] ?? '') !== '') {
            $where .= ' AND u.department = ?';
            $args[] = $query['faculty'];
        }
        if (($query['linkedin'] ?? null) === 'linked') {
            $where .= ' AND l.user_id IS NOT NULL';
        } elseif (($query['linkedin'] ?? null) === 'missing') {
            $where .= ' AND l.user_id IS NULL';
        }
        $pdo = $app->pdo();
        $count = $pdo->prepare(
            "SELECT COUNT(*) FROM `user` u LEFT JOIN linkedin_account l ON l.user_id = u.id WHERE $where"
        );
        $count->execute($args);
        $stmt = $pdo->prepare(
            'SELECT u.id, u.display_name, u.email, u.picture_url, u.role, u.matric_no, u.employee_id, u.department,'
            . ' u.active, u.onboarded_at, u.last_sign_in_at, l.profile_url AS linkedin_url,'
            . ' (l.user_id IS NOT NULL) AS linkedin_linked'
            . " FROM `user` u LEFT JOIN linkedin_account l ON l.user_id = u.id WHERE $where"
            . ' ORDER BY u.display_name, u.id LIMIT ' . $page->perPage . ' OFFSET ' . $page->offset()
        );
        $stmt->execute($args);
        $rows = array_values(array_map(static function (array $r): array {
            $r['id'] = (int) $r['id'];
            $r['active'] = (bool) $r['active'];
            $r['linkedin_linked'] = (bool) $r['linkedin_linked'];

            return $r;
        }, $stmt->fetchAll(PDO::FETCH_ASSOC)));

        return Response::json($page->envelope($rows, (int) $count->fetchColumn()));
    }

    /** @param array<string, string> $params */
    public static function show(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'people.view');
        $profile = (new ProfileService($app->pdo()))->get($admin['organisation_id'], (int) $params['id']);
        Audit::log($app->pdo(), $admin, 'profile.view', 'user:' . $params['id']);

        return Response::json($profile);
    }

    /**
     * Role change. Nobody sets superadmin (it comes only from SUPERADMIN_EMAIL); nobody changes their own role;
     * only the superadmin makes or unmakes an admin; the superadmin's row is never changed here.
     *
     * @param array<string, string> $params
     */
    public static function role(Request $req, array $params, App $app): Response
    {
        $admin = self::admin($req, $app, 'people.roles');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'role.json', $req->json());
        $target = (int) $params['id'];
        $role = (string) $body['role'];
        $pdo = $app->pdo();
        Transaction::run($pdo, function () use ($pdo, $admin, $target, $role): void {
            $stmt = $pdo->prepare('SELECT role FROM `user` WHERE id = ? AND organisation_id = ? FOR UPDATE');
            $stmt->execute([$target, $admin['organisation_id']]);
            $current = $stmt->fetchColumn();
            if ($current === false) {
                throw new ApiError(404, 'NOT_FOUND', 'Not found.');
            }
            if ($target === $admin['id']) {
                throw new ApiError(403, 'FORBIDDEN', 'You cannot change your own role.');
            }
            $touchesAdmin = $current === 'admin' || $role === 'admin';
            if (
                in_array($current, ['superadmin', 'pending'], true)
                || ($touchesAdmin && $admin['role'] !== 'superadmin')
            ) {
                throw new ApiError(403, 'FORBIDDEN', 'You cannot change this role.');
            }
            if ($current === $role) {
                return;
            }
            $pdo->prepare('UPDATE `user` SET role = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?')
                ->execute([$role, $target]);
            Audit::log($pdo, $admin, 'user.role', 'user:' . $target, ['from' => $current, 'to' => $role]);
        });

        return new Response(204);
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
