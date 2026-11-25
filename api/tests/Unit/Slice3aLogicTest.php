<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use Cpdc\CareerPath\CareerPathService;
use Cpdc\Http\ApiError;
use Cpdc\Workshops\WorkshopService;
use Cpdc\Workshops\WorkshopTime;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Pure logic of slice 3a: Malaysia time, audience groups, check-in codes, programme and skill matching. */
final class Slice3aLogicTest extends TestCase
{
    private const MY = 'Asia/Kuala_Lumpur';

    public function testMalaysiaTimeIsEightHoursAheadOfUtcBothWays(): void
    {
        $this->assertSame('2027-01-16 02:00:00', WorkshopTime::toUtc('2027-01-16T10:00', self::MY, 'starts_at'));
        $this->assertSame('2027-01-15 16:30:00', WorkshopTime::toUtc('2027-01-16T00:30', self::MY, 'starts_at'));
        $this->assertSame('2027-01-16T10:00', WorkshopTime::local('2027-01-16 02:00:00', self::MY));
        $this->assertSame('2027-01-16T02:00:00Z', WorkshopTime::iso('2027-01-16 02:00:00.000'));
        $this->assertSame('2027-01-16 10:00', WorkshopTime::readable('2027-01-16T02:00:00Z', self::MY));
        $this->assertSame('', WorkshopTime::readable(null, self::MY));
        $this->assertSame(1_800_064_800, WorkshopTime::unix('2027-01-16 02:00:00'));
    }

    /** @return iterable<string, array{string}> */
    public static function badTimes(): iterable
    {
        yield 'no such day' => ['2027-02-30T10:00'];
        yield 'hour 24' => ['2027-01-16T24:00'];
        yield 'month 13' => ['2027-13-01T10:00'];
        yield 'not a time' => ['tomorrow'];
        yield 'seconds' => ['2027-01-16T10:00:00'];
    }

    #[DataProvider('badTimes')]
    public function testImpossibleTimesAreRefused(string $value): void
    {
        try {
            WorkshopTime::toUtc($value, self::MY, 'starts_at');
            $this->fail("accepted $value");
        } catch (ApiError $e) {
            $this->assertSame('starts_at', $e->field);
        }
    }

    public function testAdminsCountAsStaffAndPendingHasNoGroup(): void
    {
        $this->assertSame('student', WorkshopService::group('student'));
        $this->assertSame('alumni', WorkshopService::group('alumni'));
        $this->assertSame('staff', WorkshopService::group('admin'));
        $this->assertSame('staff', WorkshopService::group('superadmin'));
        $this->assertNull(WorkshopService::group('pending'));
    }

    public function testCheckInCodesHaveSixCharactersWithoutLookAlikes(): void
    {
        for ($i = 0; $i < 200; $i++) {
            $this->assertMatchesRegularExpression('/^[A-HJ-NP-Z2-9]{6}$/', WorkshopService::newCode());
        }
    }

    public function testProgrammesMatchInAnyCase(): void
    {
        $list = ['Bachelor of Fake Computing', 'Diploma of Fake Nursing'];
        $this->assertSame('Diploma of Fake Nursing', CareerPathService::pick($list, ' diploma of fake NURSING '));
        $this->assertNull(CareerPathService::pick($list, 'Bachelor of Fake'));
        $this->assertNull(CareerPathService::pick($list, null));
        $this->assertNull(CareerPathService::pick([], 'x'));
    }

    public function testPathSkillsAreMarkedWhenTheProfileListsThem(): void
    {
        $this->assertSame(
            [['name' => 'SQL', 'have' => true], ['name' => 'Power BI', 'have' => false]],
            CareerPathService::matchSkills(['SQL', 'Power BI'], ['sql', 'Excel'])
        );
        $this->assertSame([], CareerPathService::matchSkills([], ['SQL']));
    }
}
