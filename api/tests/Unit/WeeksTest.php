<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use Cpdc\Logbook\Weeks;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class WeeksTest extends TestCase
{
    public function testMondayOfAnyDay(): void
    {
        $this->assertSame('2027-01-04', Weeks::monday('2027-01-04'));
        $this->assertSame('2027-01-04', Weeks::monday('2027-01-10'));
        $this->assertSame('2026-12-28', Weeks::monday('2027-01-01'));
    }

    public function testTodayUsesTheOrganisationsTimeZone(): void
    {
        // 2027-01-15 16:00 UTC is already 16 January in Kuala Lumpur (UTC+8) at 00:00.
        $this->assertSame('2027-01-16', Weeks::today(1_800_028_800 + 0, 'Asia/Kuala_Lumpur'));
        $this->assertSame('2027-01-15', Weeks::today(1_800_028_799, 'Asia/Kuala_Lumpur'));
    }

    /** @return array<string, array{string, string|null}> */
    public static function weeks(): array
    {
        return [
            'first week' => ['2027-01-04', null],
            'current week' => ['2027-01-11', null],
            'not a Monday' => ['2027-01-05', 'Pick the Monday of the week.'],
            'not a date' => ['2027-02-30', 'Pick the Monday of the week.'],
            'before start' => ['2026-12-28', 'This week is outside your internship dates.'],
            'next week' => ['2027-01-18', 'You can only log a week once it has started.'],
        ];
    }

    #[DataProvider('weeks')]
    public function testWhichWeeksMayBeLogged(string $week, ?string $reason): void
    {
        $this->assertSame($reason, Weeks::refusal($week, '2027-01-06', '2027-03-26', '2027-01-15'));
    }

    public function testAWeekAfterTheEndIsRefused(): void
    {
        $this->assertSame(
            'This week is outside your internship dates.',
            Weeks::refusal('2027-04-05', '2027-01-04', '2027-04-02', '2027-06-01')
        );
    }

    public function testExpectedWeeksCountStartedWeeksUpToTheEnd(): void
    {
        $this->assertSame(0, Weeks::expected('2027-02-01', '2027-04-30', '2027-01-15'), 'not started');
        $this->assertSame(1, Weeks::expected('2027-01-13', '2027-04-30', '2027-01-15'), 'started mid-week');
        $this->assertSame(2, Weeks::expected('2027-01-04', '2027-04-30', '2027-01-15'));
        $this->assertSame(12, Weeks::expected('2027-01-04', '2027-03-26', '2027-09-01'), 'finished');
    }

    public function testIsDateRejectsImpossibleDates(): void
    {
        $this->assertTrue(Weeks::isDate('2028-02-29'));
        $this->assertFalse(Weeks::isDate('2027-02-29'));
        $this->assertFalse(Weeks::isDate('2027-1-04'));
    }
}
