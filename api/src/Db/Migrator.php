<?php

declare(strict_types=1);

namespace Cpdc\Db;

use PDO;

/** Forward-only runner: applies migrations/*.sql in filename order, once each. */
final class Migrator
{
    public function __construct(private readonly PDO $pdo, private readonly string $dir)
    {
    }

    /** @return list<string> filenames applied by this run */
    public function run(): array
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS schema_migration ('
            . 'filename VARCHAR(190) NOT NULL PRIMARY KEY, '
            . 'applied_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $done = $this->pdo->query('SELECT filename FROM schema_migration');
        $applied = $done === false ? [] : $done->fetchAll(PDO::FETCH_COLUMN);

        $files = glob($this->dir . '/*.sql') ?: [];
        sort($files);
        $ran = [];
        foreach ($files as $file) {
            $name = basename($file);
            if (in_array($name, $applied, true)) {
                continue;
            }
            $this->pdo->exec((string) file_get_contents($file));
            $stmt = $this->pdo->prepare(
                'INSERT INTO schema_migration (filename, applied_at) VALUES (?, UTC_TIMESTAMP())'
            );
            $stmt->execute([$name]);
            $ran[] = $name;
        }

        return $ran;
    }
}
