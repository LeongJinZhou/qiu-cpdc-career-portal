<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use Cpdc\Http\ApiError;
use Cpdc\Http\UploadedFile;
use Cpdc\Jobs\ApplicationStatus;
use Cpdc\Jobs\JobService;
use Cpdc\Jobs\LocalDate;
use Cpdc\Jobs\PdfStore;
use Cpdc\Skills\Gap;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Slice 2b rules without a database: application status, open jobs, dates, PDF checks, skills gap. */
final class JobsLogicTest extends TestCase
{
    public function testCpdcMovesAnyReviewStatusButNeverWithdrawsOrRevivesAWithdrawal(): void
    {
        $this->assertTrue(ApplicationStatus::managerMaySet('submitted', 'shortlisted'));
        $this->assertTrue(ApplicationStatus::managerMaySet('rejected', 'reviewing'));
        $this->assertFalse(ApplicationStatus::managerMaySet('submitted', 'withdrawn'));
        $this->assertFalse(ApplicationStatus::managerMaySet('withdrawn', 'reviewing'));
        $this->assertFalse(ApplicationStatus::managerMaySet('submitted', 'unknown'));
    }

    public function testTheApplicantWithdrawsOnlyBeforeADecision(): void
    {
        foreach (['submitted', 'reviewing', 'shortlisted', 'interview', 'offered'] as $status) {
            $this->assertTrue(ApplicationStatus::applicantMayWithdraw($status), $status);
        }
        foreach (['hired', 'rejected', 'withdrawn', 'nonsense'] as $status) {
            $this->assertFalse(ApplicationStatus::applicantMayWithdraw($status), $status);
        }
    }

    public function testAJobIsOpenThroughItsClosingDay(): void
    {
        $job = ['status' => 'open', 'closing_date' => '2026-11-26', 'active' => 1];
        $this->assertTrue(JobService::isOpen($job, '2026-11-26'));
        $this->assertFalse(JobService::isOpen($job, '2026-11-27'));
        $this->assertFalse(JobService::isOpen(['status' => 'draft'] + $job, '2026-11-01'));
        $this->assertFalse(JobService::isOpen(['active' => 0] + $job, '2026-11-01'));
    }

    public function testTodayIsTheOrganisationsLocalDate(): void
    {
        $lateUtc = (new \DateTimeImmutable('2026-11-26 17:30:00', new \DateTimeZone('UTC')))->getTimestamp();
        $this->assertSame('2026-11-27', LocalDate::today($lateUtc, 'Asia/Kuala_Lumpur'));
        $this->assertSame('2026-11-26', LocalDate::today($lateUtc, 'UTC'));
    }

    /** @return array<string, array{string}> */
    public static function badDates(): array
    {
        return ['not a day' => ['2026-02-30'], 'month 13' => ['2026-13-01'], 'too old' => ['1980-01-01'],
            'shape' => ['26-1-1']];
    }

    #[DataProvider('badDates')]
    public function testOnlyRealDatesPass(string $date): void
    {
        $this->expectException(ApiError::class);
        LocalDate::parse($date, 'closing_date');
    }

    public function testALeapDayPasses(): void
    {
        $this->assertSame('2028-02-29', LocalDate::parse('2028-02-29', 'closing_date'));
    }

    public function testAnUploadMustStartLikeAPdf(): void
    {
        $tmp = (string) tempnam(sys_get_temp_dir(), 'cpdc-unit');
        file_put_contents($tmp, '%PDF-1.7 fake');
        PdfStore::check(new UploadedFile('a.pdf', $tmp, 13, UPLOAD_ERR_OK), 100, 'cv');
        file_put_contents($tmp, '<html>%PDF-');
        try {
            PdfStore::check(new UploadedFile('a.pdf', $tmp, 11, UPLOAD_ERR_OK), 100, 'cv');
            $this->fail('an HTML file passed as a PDF');
        } catch (ApiError $e) {
            $this->assertSame(400, $e->status);
        } finally {
            unlink($tmp);
        }
    }

    public function testATooLargeUploadIsRefusedWith413(): void
    {
        try {
            PdfStore::check(new UploadedFile('a.pdf', '', 5000, UPLOAD_ERR_INI_SIZE), 100, 'cv');
            $this->fail('accepted');
        } catch (ApiError $e) {
            $this->assertSame(413, $e->status);
        }
    }

    public function testTheClientsFileNameIsCleanedForDisplay(): void
    {
        $this->assertSame('cv.pdf', PdfStore::displayName('C:\\fakepath\\cv.pdf'));
        $this->assertSame('evil.pdf', PdfStore::displayName("../../etc/evil\x00.pdf"));
        $this->assertSame('document.pdf', PdfStore::displayName(''));
        $this->assertSame(200, mb_strlen(PdfStore::displayName(str_repeat('é', 300))));
    }

    public function testTheGapCountsUnratedAreasAndSortsBiggestFirst(): void
    {
        $gap = Gap::compute([
            ['area_id' => 1, 'name' => 'Communication', 'level' => 3],
            ['area_id' => 2, 'name' => 'Programming', 'level' => 5],
            ['area_id' => 3, 'name' => 'Teamwork', 'level' => 2],
        ], [1 => 4, 2 => 2]);
        $this->assertSame(['Programming', 'Teamwork', 'Communication'], array_column($gap['rows'], 'name'));
        $this->assertSame([3, 2, 0], array_column($gap['rows'], 'gap'));
        $this->assertSame([2, null, 4], array_column($gap['rows'], 'mine'));
        $this->assertSame(1, $gap['met']);
        $this->assertSame(3, $gap['total']);
    }

    public function testAJobWithoutSkillsHasNoGap(): void
    {
        $this->assertSame(['rows' => [], 'met' => 0, 'total' => 0], Gap::compute([], [1 => 3]));
    }
}
