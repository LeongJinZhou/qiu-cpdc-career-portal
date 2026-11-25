<?php

declare(strict_types=1);

namespace Cpdc\Db;

use PDO;

/**
 * One transaction around $work. Called inside an open transaction, the work joins it: the outer caller commits or
 * rolls back everything together (the AI draft creates an activity, its blocks and questions as one write).
 */
final class Transaction
{
    /**
     * @template T
     * @param \Closure(): T $work
     * @return T
     */
    public static function run(PDO $pdo, \Closure $work): mixed
    {
        if ($pdo->inTransaction()) {
            return $work();
        }
        $pdo->beginTransaction();
        try {
            $result = $work();
            $pdo->commit();

            return $result;
        } catch (\Throwable $e) {
            self::rollBack($pdo);
            throw $e;
        }
    }

    private static function rollBack(PDO $pdo): void
    {
        if ($pdo->inTransaction()) { // the work may already have ended it
            $pdo->rollBack();
        }
    }
}
