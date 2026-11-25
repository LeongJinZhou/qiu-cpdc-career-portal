<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Cpdc\Env;

final class EnvTest extends TestCase
{
    public function testParsesKeyValueLinesAndSkipsComments(): void
    {
        $vars = Env::parse("# comment\nA=1\n\nB=two words\nC=\n");

        $this->assertSame(['A' => '1', 'B' => 'two words', 'C' => ''], $vars);
    }

    public function testGetThrowsWhenMissing(): void
    {
        $this->expectException(\RuntimeException::class);

        Env::get('SLD_DOES_NOT_EXIST');
    }

    private const PROD = [
        'APP_ENV' => 'production',
        'APP_URL' => 'https://orientation.example.test',
        'GOOGLE_CLIENT_ID' => 'client-id',
        'GOOGLE_CLIENT_SECRET' => 'client-secret',
        'GOOGLE_OIDC_BASE' => 'https://accounts.google.com',
        'GOOGLE_PEOPLE_BASE' => 'https://people.googleapis.com',
        'OPENAI_BASE' => 'https://api.openai.com',
    ];

    /** @param array<string, string|null> $vars null = unset */
    private function withEnv(array $vars, \Closure $test): void
    {
        $old = [];
        foreach ($vars as $key => $value) {
            $old[$key] = getenv($key);
            putenv($value === null ? $key : "$key=$value");
        }
        try {
            $test();
        } finally {
            foreach ($old as $key => $value) {
                putenv($value === false ? $key : "$key=$value");
            }
        }
    }

    /** assertProdUrls must throw; a fail() inside try would be swallowed (PHPUnit exceptions are RuntimeExceptions). */
    private function assertRefusedMentioning(string $key): void
    {
        $error = null;
        try {
            Env::assertProdUrls();
        } catch (\RuntimeException $e) {
            $error = $e;
        }
        $this->assertNotNull($error, "$key was accepted");
        $this->assertStringContainsString($key, $error->getMessage());
    }

    public function testProdUrlsAcceptHttpsPublicHostsAndOptionalOpenai(): void
    {
        $this->withEnv(self::PROD, fn () => Env::assertProdUrls());
        $this->withEnv(['OPENAI_BASE' => null] + self::PROD, fn () => Env::assertProdUrls());
        $this->addToAssertionCount(2);
    }

    public function testNonProductionSkipsTheCheck(): void
    {
        $this->withEnv(['APP_ENV' => 'test', 'GOOGLE_OIDC_BASE' => 'http://127.0.0.1:8081/google'], function () {
            Env::assertProdUrls();
        });
        $this->addToAssertionCount(1);
    }

    /** @return iterable<string, array{string|null}> */
    public static function badAppEnvs(): iterable
    {
        yield 'unset' => [null];
        yield 'empty' => [''];
        yield 'typo' => ['prodcution'];
        yield 'staging' => ['staging'];
        yield 'case differs' => ['Production'];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('badAppEnvs')]
    public function testUnknownAppEnvRefusesBoot(?string $env): void
    {
        // Fail closed: an unknown APP_ENV must not skip the production checks.
        $this->withEnv(['APP_ENV' => $env, 'GOOGLE_OIDC_BASE' => 'http://127.0.0.1:8081/google'], function () {
            $this->assertRefusedMentioning('APP_ENV');
        });
    }

    public function testKnownNonProductionEnvsSkipTheUrlCheck(): void
    {
        foreach (['local', 'development', 'test'] as $env) {
            $this->withEnv(['APP_ENV' => $env, 'GOOGLE_OIDC_BASE' => 'http://127.0.0.1:8081/google'], function () {
                Env::assertProdUrls();
            });
        }
        $this->addToAssertionCount(3);
    }

    /** @return iterable<string, array{string, string|null}> */
    public static function badProdValues(): iterable
    {
        yield 'oidc http' => ['GOOGLE_OIDC_BASE', 'http://accounts.google.com'];
        yield 'oidc localhost' => ['GOOGLE_OIDC_BASE', 'https://localhost/google'];
        yield 'oidc sub.localhost' => ['GOOGLE_OIDC_BASE', 'https://fake.localhost./google'];
        yield 'people 127.x' => ['GOOGLE_PEOPLE_BASE', 'https://127.10.0.1:8081'];
        yield 'people ::1' => ['GOOGLE_PEOPLE_BASE', 'https://[::1]/people'];
        yield 'people mapped' => ['GOOGLE_PEOPLE_BASE', 'https://[::ffff:127.0.0.1]/people'];
        yield 'openai 0.0.0.0' => ['OPENAI_BASE', 'https://0.0.0.0'];
        yield 'openai decimal ip' => ['OPENAI_BASE', 'https://2130706433'];
        yield 'openai http' => ['OPENAI_BASE', 'http://api.openai.com'];
        yield 'gmail http' => ['GOOGLE_GMAIL_BASE', 'http://gmail.googleapis.com'];
        yield 'gmail fake' => ['GOOGLE_GMAIL_BASE', 'http://127.0.0.1:8081/google/gmail'];
        yield 'app url http' => ['APP_URL', 'http://orientation.example.test'];
        yield 'app url localhost' => ['APP_URL', 'https://LOCALHOST:5173'];
        yield 'oidc 10.x' => ['GOOGLE_OIDC_BASE', 'https://10.0.0.5/google'];
        yield 'oidc 172.16.x' => ['GOOGLE_OIDC_BASE', 'https://172.16.4.1'];
        yield 'oidc 192.168.x' => ['GOOGLE_OIDC_BASE', 'https://192.168.1.10'];
        yield 'people cgnat' => ['GOOGLE_PEOPLE_BASE', 'https://100.64.0.1'];
        yield 'people link-local' => ['GOOGLE_PEOPLE_BASE', 'https://169.254.169.254/latest'];
        yield 'openai ula' => ['OPENAI_BASE', 'https://[fd12:3456::1]'];
        yield 'openai ula fc' => ['OPENAI_BASE', 'https://[fc00::1]'];
        yield 'openai ipv6 link-local' => ['OPENAI_BASE', 'https://[fe80::1]'];
        yield 'app url mapped private' => ['APP_URL', 'https://[::ffff:10.0.0.1]'];
        yield 'no scheme' => ['GOOGLE_OIDC_BASE', 'accounts.google.com'];
        yield 'missing oidc' => ['GOOGLE_OIDC_BASE', null];
        yield 'missing people' => ['GOOGLE_PEOPLE_BASE', null];
        yield 'missing client id' => ['GOOGLE_CLIENT_ID', null];
        yield 'empty client secret' => ['GOOGLE_CLIENT_SECRET', ''];
        yield 'missing app url' => ['APP_URL', null];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('badProdValues')]
    public function testProductionRefusesUnsafeOrMissingValues(string $key, ?string $value): void
    {
        $this->withEnv([$key => $value] + self::PROD, function () use ($key) {
            $this->assertRefusedMentioning($key);
        });
    }

    public function testStorageDirResolvesRelativeToRepoRootAndKeepsAbsolute(): void
    {
        $old = getenv('STORAGE_DIR');
        try {
            putenv('STORAGE_DIR=storage');
            $this->assertSame(dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'storage', Env::storageDir());

            putenv('STORAGE_DIR=/srv/sld/storage');
            $this->assertSame('/srv/sld/storage', Env::storageDir());

            putenv('STORAGE_DIR=C:\\sld\\storage');
            $this->assertSame('C:\\sld\\storage', Env::storageDir());
        } finally {
            putenv($old === false ? 'STORAGE_DIR' : "STORAGE_DIR=$old");
        }
    }
}
