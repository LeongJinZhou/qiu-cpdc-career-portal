<?php

declare(strict_types=1);

namespace Cpdc\Audit;

use PDO;

/** Admin action log (rule 41). Call inside the caller's transaction so the row and the change commit together. */
final class Audit
{
    /**
     * @param array{id: int|null, organisation_id: int, ...} $actor null id: no account (a supervisor's link)
     * @param array<string, mixed>|null $meta ids and before/after values only, no personal data
     */
    public static function log(PDO $pdo, array $actor, string $action, string $target, ?array $meta = null): void
    {
        $pdo->prepare(
            'INSERT INTO audit_log (organisation_id, actor_id, action, target, meta_json, created_at)'
            . ' VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))'
        )->execute([
            $actor['organisation_id'],
            $actor['id'],
            $action,
            $target,
            $meta === null ? null : json_encode($meta, JSON_THROW_ON_ERROR),
        ]);
    }
}
