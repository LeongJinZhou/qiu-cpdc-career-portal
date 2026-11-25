<?php

declare(strict_types=1);

namespace Cpdc\Audit;

use Cpdc\App;
use Cpdc\Http\Paginator;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Profile\ProfileController;
use PDO;

/** Admin: the audit log, newest first (who, what, when). */
final class AuditController
{
    /** @param array<string, string> $params */
    public static function list(Request $req, array $params, App $app): Response
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $app->access()->require($user, 'audit.view');
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'list.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($user['organisation_id']));
        $pdo = $app->pdo();
        $count = $pdo->prepare('SELECT COUNT(*) FROM audit_log WHERE organisation_id = ?');
        $count->execute([$user['organisation_id']]);
        $stmt = $pdo->prepare(
            'SELECT a.id, a.action, a.target, a.meta_json, a.created_at, u.display_name AS actor'
            . ' FROM audit_log a LEFT JOIN `user` u ON u.id = a.actor_id WHERE a.organisation_id = ?'
            . ' ORDER BY a.id DESC LIMIT ' . $page->perPage . ' OFFSET ' . $page->offset()
        );
        $stmt->execute([$user['organisation_id']]);
        $rows = array_values(array_map(static function (array $r): array {
            $r['id'] = (int) $r['id'];
            $r['meta'] = $r['meta_json'] === null ? null : json_decode((string) $r['meta_json'], true);
            unset($r['meta_json']);

            return $r;
        }, $stmt->fetchAll(PDO::FETCH_ASSOC)));

        return Response::json($page->envelope($rows, (int) $count->fetchColumn()));
    }
}
