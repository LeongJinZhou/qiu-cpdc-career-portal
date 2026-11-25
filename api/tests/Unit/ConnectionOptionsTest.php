<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use PDO;
use PHPUnit\Framework\TestCase;
use Cpdc\Db\Connection;

final class ConnectionOptionsTest extends TestCase
{
    public function testWithoutCaThereAreNoTlsOptions(): void
    {
        foreach ([null, '', '   '] as $ca) {
            $options = Connection::options($ca);
            self::assertArrayNotHasKey(PDO::MYSQL_ATTR_SSL_CA, $options);
            self::assertArrayNotHasKey(PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT, $options);
        }
    }

    public function testWithCaTheServerCertificateIsVerified(): void
    {
        $options = Connection::options('/etc/secrets/db-ca.pem');

        self::assertSame('/etc/secrets/db-ca.pem', $options[PDO::MYSQL_ATTR_SSL_CA]);
        self::assertTrue($options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT]);
    }

    /** @return array<string, array{?string}> */
    public static function missingCa(): array
    {
        return ['unset' => [null], 'empty' => [''], 'blank' => ['  ']];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('missingCa')]
    public function testProductionRefusesToConnectWithoutCa(?string $ca): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('DB_SSL_CA');

        Connection::options($ca, true);
    }

    public function testProductionWithCaVerifiesTheServer(): void
    {
        self::assertTrue(Connection::options('/ca.pem', true)[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT]);
    }

    public function testBaseOptionsStayInBothModes(): void
    {
        foreach ([null, '/ca.pem'] as $ca) {
            $options = Connection::options($ca);
            self::assertSame(PDO::ERRMODE_EXCEPTION, $options[PDO::ATTR_ERRMODE]);
            self::assertFalse($options[PDO::ATTR_EMULATE_PREPARES]);
            self::assertSame("SET time_zone = '+00:00'", $options[PDO::MYSQL_ATTR_INIT_COMMAND]);
        }
    }
}
