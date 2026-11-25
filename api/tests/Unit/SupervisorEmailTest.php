<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use Cpdc\Logbook\SupervisorEmail;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Which supervisor addresses CPDC is asked to check by hand. */
final class SupervisorEmailTest extends TestCase
{
    /** @return iterable<string, array{string, bool}> */
    public static function addresses(): iterable
    {
        yield 'company' => ['lee@fake-engineering.example', false];
        yield 'company subdomain' => ['lee@my.fake-engineering.example', false];
        yield 'gmail' => ['someone@gmail.com', true];
        yield 'gmail any case and spaces' => ['  Someone@GMAIL.com ', true];
        yield 'yahoo malaysia' => ['someone@yahoo.com.my', true];
        yield 'outlook' => ['someone@outlook.com', true];
        yield 'qiu staff address' => ['lecturer@qiu.edu.my', true];
        yield 'qiu student address' => ['me@student.qiu.edu.my', true];
        yield 'no at sign' => ['not-an-address', true];
    }

    #[DataProvider('addresses')]
    public function testFlagsFreeMailAndQiuAddresses(string $email, bool $personal): void
    {
        $this->assertSame($personal, SupervisorEmail::isPersonal($email));
    }
}
