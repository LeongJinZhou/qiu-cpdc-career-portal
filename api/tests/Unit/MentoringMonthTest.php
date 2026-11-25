<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use Cpdc\Network\MentoringService;
use PHPUnit\Framework\TestCase;

/** Monthly mentoring slots reset at the start of each UTC month. */
final class MentoringMonthTest extends TestCase
{
    public function testMonthStartIsTheFirstInstantOfTheMonth(): void
    {
        $this->assertSame('2027-01-01 00:00:00', MentoringService::monthStart('2027-01-15 08:00:00'));
        $this->assertSame('2026-12-01 00:00:00', MentoringService::monthStart('2026-12-31 23:59:59'));
        $this->assertSame('2028-02-01 00:00:00', MentoringService::monthStart('2028-02-29 12:00:00'));
    }
}
