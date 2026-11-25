<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

use PDO;
use PHPUnit\Framework\TestCase;
use Cpdc\Db\Connection;

/** Each test runs inside a transaction that is rolled back, so tests never see each other's rows. */
abstract class DbTestCase extends TestCase
{
    protected PDO $pdo;

    protected function setUp(): void
    {
        $this->pdo = Connection::fromEnv();
        $this->pdo->beginTransaction();
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
        unset($this->pdo); // PHPUnit keeps every test object alive: free the connection or the server runs out
    }

    /** @return int new user id */
    protected function insertUser(string $email, string $role, int $org = 1, bool $active = true): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO `user` (organisation_id, email, display_name, role, active) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$org, $email, 'Fake ' . $role, $role, (int) $active]);

        return (int) $this->pdo->lastInsertId();
    }

    protected function insertOrganisation(string $name): int
    {
        $this->pdo->prepare('INSERT INTO organisation (name) VALUES (?)')->execute([$name]);

        return (int) $this->pdo->lastInsertId();
    }
}
