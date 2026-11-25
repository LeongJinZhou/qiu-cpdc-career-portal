<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use Cpdc\Profile\LinkedInPdf;
use PHPUnit\Framework\TestCase;

final class LinkedInPdfTest extends TestCase
{
    /** @return list<array{text: string, size: float, column: string}> */
    private static function profileLines(): array
    {
        $m = static fn (string $t, float $s = 10.5): array => ['text' => $t, 'size' => $s, 'column' => 'main'];
        $s = static fn (string $t, float $size = 10.5): array => ['text' => $t, 'size' => $size, 'column' => 'side'];

        return [
            $s('Contact', 13), $s('www.linkedin.com/in/aina-'), $s('rahman (LinkedIn)'),
            $s('Top Skills', 13), $s('Python'), $s('SQL'),
            $m('Aina Rahman', 26), $m('Data student at QIU', 12), $m('Ipoh, Malaysia'),
            $m('Summary', 16), $m('I build'), $m('data tools.'),
            $m('Experience', 16),
            $m('Petronas', 12), $m('2 years 1 month'),
            $m('Data Intern', 11.5), $m('June 2025 - Present (6 months)'), $m('Kuala Lumpur, Malaysia'),
            $m('Built dashboards.'),
            $m('Data Assistant', 11.5), $m('Jan 2024 - May 2025 (1 year 5 months)'), $m('Cleaned data.'),
            $m('Maybank', 12), $m('Senior Analytics and Reporting'), $m('Associate Lead'),
            $m('2023 - 2023 (less than a year)'),
            $m('Page 1 of 2'),
            $m('Education', 16),
            $m('Quest International University', 12),
            $m('Bachelor of Computer Science · (2022 - 2026)'),
        ];
    }

    public function testReadsHeaderAboutSkillsAndProfileUrl(): void
    {
        $p = LinkedInPdf::parseLines(self::profileLines());
        $this->assertTrue($p['looks_like_linkedin']);
        $this->assertSame('Aina Rahman', $p['name']);
        $this->assertSame('Data student at QIU', $p['headline']);
        $this->assertSame('Ipoh, Malaysia', $p['location']);
        $this->assertSame('I build data tools.', $p['about']);
        $this->assertSame(['Python', 'SQL'], $p['skills']);
        $this->assertSame('https://www.linkedin.com/in/aina-rahman', $p['profile_url']);
    }

    public function testReadsEveryRoleIncludingTwoAtOneCompanyAndWrappedTitles(): void
    {
        $jobs = LinkedInPdf::parseLines(self::profileLines())['experience'];
        $this->assertCount(3, $jobs);
        $this->assertSame(['title' => 'Data Intern', 'company' => 'Petronas', 'location' => 'Kuala Lumpur, Malaysia',
            'start' => '2025-06', 'end' => null, 'description' => 'Built dashboards.'], $jobs[0]);
        $this->assertSame('Petronas', $jobs[1]['company']);
        $this->assertSame('2024-01', $jobs[1]['start']);
        $this->assertSame('2025-05', $jobs[1]['end']);
        // The wrapped title, but the page footer is not part of the description.
        $this->assertSame('Maybank', $jobs[2]['company']);
        $this->assertSame('Senior Analytics and Reporting Associate Lead', $jobs[2]['title']);
        $this->assertSame('', $jobs[2]['description']);
    }

    public function testReadsEducationWithYears(): void
    {
        $school = LinkedInPdf::parseLines(self::profileLines())['education'][0];
        $this->assertSame(['school' => 'Quest International University', 'degree' => 'Bachelor of Computer Science',
            'start_year' => 2022, 'end_year' => 2026], $school);
    }

    public function testAPageThatIsNotAProfileGivesAnEmptyResult(): void
    {
        $p = LinkedInPdf::parseLines([['text' => 'Invoice 42', 'size' => 12, 'column' => 'main']]);
        $this->assertFalse($p['looks_like_linkedin']);
        $this->assertSame([], $p['experience']);
        $this->assertNull($p['profile_url']);
    }

    public function testALongAboutIsCutAtAWordBoundary(): void
    {
        $long = str_repeat('word ', 600);
        $p = LinkedInPdf::parseLines([
            ['text' => 'Aina', 'size' => 26, 'column' => 'main'],
            ['text' => 'Summary', 'size' => 16, 'column' => 'main'],
            ['text' => $long, 'size' => 10, 'column' => 'main'],
        ]);
        $this->assertLessThanOrEqual(LinkedInPdf::MAX_ABOUT, mb_strlen($p['about']));
        $this->assertStringEndsWith('word', $p['about']);
    }

    public function testExtractsARealTwoColumnPdfEndToEnd(): void
    {
        $bytes = (string) file_get_contents(__DIR__ . '/../fixtures/linkedin-profile.pdf');
        $p = LinkedInPdf::parseLines(LinkedInPdf::extractLines($bytes));
        $this->assertTrue($p['looks_like_linkedin']);
        $this->assertSame('Aina Rahman', $p['name']);
        $this->assertSame(['Python', 'SQL'], $p['skills']);
        $this->assertSame('https://www.linkedin.com/in/aina-rahman-fake', $p['profile_url']);
        $this->assertSame('Data Intern', $p['experience'][0]['title']);
        $this->assertSame('Petronas', $p['experience'][0]['company']);
        $this->assertSame(2026, $p['education'][0]['end_year']);
    }

    public function testRefusesBytesThatAreNotAPdf(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        LinkedInPdf::extractLines('<html>not a pdf</html>');
    }

    public function testRefusesABrokenPdf(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        LinkedInPdf::extractLines("%PDF-1.7\n garbage that is not a document");
    }
}
