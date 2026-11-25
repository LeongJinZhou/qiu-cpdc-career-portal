<?php

declare(strict_types=1);

namespace Cpdc\Tests;

use PDO;
use Cpdc\Db\Migrator;

/** Test database reset: drop every table, then migrate. Refuses any database not named *_test. */
final class TestDb
{
    public static function reset(PDO $pdo, string $dbName): void
    {
        if (!str_ends_with($dbName, '_test')) {
            throw new \RuntimeException('Refusing to reset a database not named *_test');
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        $tables = $pdo->query(
            'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()'
        );
        foreach ($tables === false ? [] : $tables->fetchAll(PDO::FETCH_COLUMN) as $table) {
            $pdo->exec('DROP TABLE `' . str_replace('`', '``', (string) $table) . '`');
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        (new Migrator($pdo, __DIR__ . '/../migrations'))->run();
    }
}
