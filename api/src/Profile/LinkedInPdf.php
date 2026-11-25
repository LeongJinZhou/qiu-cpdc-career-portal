<?php

declare(strict_types=1);

namespace Cpdc\Profile;

use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;

/**
 * Reads a LinkedIn "Save to PDF" profile into career fields (docs/SPEC.md rule 7).
 *
 * LinkedIn's sign-in gives only name, email and photo; the PDF a member downloads from their own profile is the
 * sanctioned way to bring headline, About, jobs, education and skills across. The person reviews every field
 * before anything is saved: this class only reads.
 *
 * The layout is two columns: a narrow sidebar (Contact, Top Skills, Languages, Certifications, Honors-Awards) and
 * the main column (name, headline, location, Summary, Experience, Education). extractLines() turns the PDF into
 * positioned lines; parseLines() is pure and unit-tested. Ported from the old portal (lib/profile/linkedin-pdf.js).
 *
 * @phpstan-type Line array{text: string, size: float, column: 'side'|'main'}
 * @phpstan-type Job array{title: string, company: string, location: string|null, start: string|null,
 *     end: string|null, description: string}
 * @phpstan-type School array{school: string, degree: string|null, start_year: int|null, end_year: int|null}
 * @phpstan-type Parsed array{looks_like_linkedin: bool, name: string, headline: string, location: string,
 *     about: string, profile_url: string|null, skills: list<string>, experience: list<Job>,
 *     education: list<School>}
 */
final class LinkedInPdf
{
    private const MAIN_HEADINGS = ['summary', 'experience', 'education', 'projects', 'publications',
        'volunteer experience', 'licenses & certifications', 'honors & awards', 'courses', 'skills'];
    private const SIDE_HEADINGS = ['contact', 'top skills', 'languages', 'certifications', 'honors-awards',
        'publications', 'patents'];

    private const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?'
        . '|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
    private const DURATION_ONLY = '/^(?:less than a year|\d+\s+years?(?:\s+\d+\s+months?)?|\d+\s+months?)$/i';
    private const PAGE_FOOTER = '/^page\s+\d+\s+of\s+\d+$/i';
    /** "Kuala Lumpur, Malaysia": capitalised words, comma separated, no digits. */
    private const PLACE = "/^[A-Z][A-Za-z.' -]+(?:,\\s*[A-Z][A-Za-z.' -]+){1,3}$/";

    public const MAX_ABOUT = 2000;
    /** Stops a hostile PDF with millions of tiny text items. */
    private const MAX_TEXT_ITEMS = 20000;
    private const MAX_PAGES = 10;

    /**
     * @return list<Line>
     * @throws \InvalidArgumentException when the bytes are not a readable PDF or hold too much text
     */
    public static function extractLines(string $bytes): array
    {
        if (!str_starts_with($bytes, '%PDF-')) {
            throw new \InvalidArgumentException('not a PDF');
        }
        $config = new Config();
        $config->setDataTmFontInfoHasToBeIncluded(true);
        $config->setRetainImageContent(false);
        $config->setDecodeMemoryLimit(32 * 1024 * 1024); // a compressed-stream bomb stops here
        $config->setMaxNestingDepth(64);
        try {
            $document = (new Parser([], $config))->parseContent($bytes);
            $pages = array_slice($document->getPages(), 0, self::MAX_PAGES);
            $lines = [];
            $items = 0;
            foreach ($pages as $page) {
                $box = $page->getDetails()['MediaBox'] ?? [0, 0, 595, 842];
                $width = is_array($box) && isset($box[2]) ? (float) $box[2] : 595.0;
                $sidebarEdge = $width * 0.32;
                $pieces = [];
                foreach ($page->getDataTm() as $item) {
                    if (++$items > self::MAX_TEXT_ITEMS) {
                        throw new \InvalidArgumentException('too much text');
                    }
                    $text = is_string($item[1] ?? null) ? $item[1] : '';
                    if (trim($text) === '' || !is_array($item[0] ?? null)) {
                        continue;
                    }
                    [$a, $b, , , $x, $y] = array_map('floatval', array_pad($item[0], 6, 0));
                    $fontSize = is_numeric($item[3] ?? null) ? (float) $item[3] : 1.0;
                    $pieces[] = [
                        'column' => $x < $sidebarEdge ? 'side' : 'main',
                        'x' => $x,
                        'y' => $y,
                        'size' => round($fontSize * (hypot($a, $b) ?: 1.0), 1),
                        'text' => $text,
                    ];
                }
                foreach (['side', 'main'] as $column) {
                    $mine = array_values(array_filter($pieces, fn (array $p): bool => $p['column'] === $column));
                    array_push($lines, ...self::groupIntoLines($mine));
                }
            }

            return $lines;
        } catch (\InvalidArgumentException $e) {
            throw $e;
        } catch (\Throwable) {
            throw new \InvalidArgumentException('unreadable PDF');
        }
    }

    /**
     * Pieces within 2pt of the same baseline are one line, read left to right.
     *
     * @param list<array{column: 'side'|'main', x: float, y: float, size: float, text: string}> $pieces
     * @return list<Line>
     */
    private static function groupIntoLines(array $pieces): array
    {
        usort($pieces, fn (array $l, array $r): int => $r['y'] <=> $l['y']);
        /** @var list<list<array{column: 'side'|'main', x: float, y: float, size: float, text: string}>> $groups */
        $groups = [];
        foreach ($pieces as $piece) {
            $last = count($groups) - 1;
            if ($last >= 0 && abs($groups[$last][0]['y'] - $piece['y']) <= 2) {
                $groups[$last][] = $piece;
            } else {
                $groups[] = [$piece];
            }
        }
        $lines = [];
        foreach ($groups as $group) {
            usort($group, fn (array $l, array $r): int => $l['x'] <=> $r['x']);
            $size = 0.0;
            foreach ($group as $part) {
                $size = max($size, $part['size']);
            }
            $lines[] = [
                'text' => implode(' ', array_map(fn (array $p): string => $p['text'], $group)),
                'size' => $size,
                'column' => $group[0]['column'],
            ];
        }

        return $lines;
    }

    /**
     * @param list<array{text?: mixed, size?: mixed, column?: mixed}> $rawLines
     * @return Parsed
     */
    public static function parseLines(array $rawLines): array
    {
        $lines = [];
        foreach ($rawLines as $raw) {
            $text = self::clean($raw['text'] ?? '');
            if ($text === '' || preg_match(self::PAGE_FOOTER, $text) === 1) {
                continue;
            }
            $lines[] = [
                'text' => $text,
                'size' => is_numeric($raw['size'] ?? null) ? (float) $raw['size'] : 0.0,
                'column' => ($raw['column'] ?? null) === 'side' ? 'side' : 'main',
            ];
        }
        $side = self::sections(
            array_values(array_filter($lines, fn ($l) => $l['column'] === 'side')),
            self::SIDE_HEADINGS
        );
        $main = self::sections(
            array_values(array_filter($lines, fn ($l) => $l['column'] === 'main')),
            self::MAIN_HEADINGS
        );
        $texts = static fn (?array $list): array => array_map(fn (array $l): string => $l['text'], $list ?? []);

        $header = self::parseHeader($main['_header'] ?? []);
        $hasSection = isset($main['experience']) || isset($main['summary']) || isset($main['education'])
            || isset($side['top skills']) || isset($side['contact']);

        return [
            'looks_like_linkedin' => $header['name'] !== '' && $hasSection,
            'name' => mb_substr($header['name'], 0, 200),
            'headline' => mb_substr($header['headline'], 0, 300),
            'location' => mb_substr($header['location'], 0, 200),
            'about' => self::clip(self::clean(implode(' ', $texts($main['summary'] ?? null))), self::MAX_ABOUT),
            'profile_url' => self::profileUrl(implode(' ', $texts($side['contact'] ?? null))),
            'skills' => array_values(array_slice(
                array_map(fn (string $s): string => mb_substr($s, 0, 80), $texts($side['top skills'] ?? null)),
                0,
                30
            )),
            'experience' => array_slice(self::parseExperience($main['experience'] ?? []), 0, 30),
            'education' => array_slice(self::parseEducation($main['education'] ?? []), 0, 20),
        ];
    }

    /**
     * The profile URL in the Contact block ("www.linkedin.com/in/aina-rahman (LinkedIn)"), which LinkedIn may wrap
     * onto two lines.
     */
    public static function profileUrl(string $contact): ?string
    {
        $joined = preg_replace(
            '#(linkedin\.com/in/[A-Za-z0-9\-_%]*)\s+([A-Za-z0-9\-_%]+)\s*\(LinkedIn\)#i',
            '$1$2',
            $contact
        );
        if (preg_match('#(?:[a-z]{2,3}\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+#i', (string) $joined, $m) !== 1) {
            return null;
        }

        return LinkedInUrl::normalise($m[0]);
    }

    /**
     * @param list<Line> $lines
     * @param list<string> $headings
     * @return array<string, list<Line>>
     */
    private static function sections(array $lines, array $headings): array
    {
        $result = ['_header' => []];
        $current = '_header';
        foreach ($lines as $line) {
            $key = strtolower($line['text']);
            if (in_array($key, $headings, true)) {
                $current = $key;
                $result[$current] ??= [];
                continue;
            }
            $result[$current][] = $line;
        }

        return $result;
    }

    /**
     * @param list<Line> $lines
     * @return array{name: string, headline: string, location: string}
     */
    private static function parseHeader(array $lines): array
    {
        if ($lines === []) {
            return ['name' => '', 'headline' => '', 'location' => ''];
        }
        $max = max(array_map(fn (array $l): float => $l['size'], $lines));
        $nameIndex = 0;
        foreach ($lines as $i => $line) {
            if ($line['size'] === $max) {
                $nameIndex = $i;
                break;
            }
        }
        $rest = array_map(fn (array $l): string => $l['text'], array_slice($lines, $nameIndex + 1));
        $count = count($rest);

        return [
            'name' => $lines[$nameIndex]['text'],
            'headline' => implode(' ', $count >= 2 ? array_slice($rest, 0, -1) : $rest),
            'location' => $count >= 2 ? $rest[$count - 1] : '',
        ];
    }

    private static function datePoint(): string
    {
        return '(?:' . self::MONTH . '\s+\d{4}|\d{4})';
    }

    private static function dateRange(): string
    {
        $p = self::datePoint();

        return '/^(' . $p . ')\s*[-–]\s*(present|' . $p . ')(?:\s*\(.*\))?$/iu';
    }

    /**
     * @param list<Line> $lines
     * @return list<Job>
     */
    private static function parseExperience(array $lines): array
    {
        $range = self::dateRange();
        $same = static fn (array $a, array $b): bool => abs($a['size'] - $b['size']) <= 0.25;
        $entries = [];
        $lastCompany = '';
        $count = count($lines);
        for ($i = 1; $i < $count; $i++) {
            if (preg_match($range, $lines[$i]['text'], $m) !== 1) {
                continue;
            }
            // A long title wraps: take up to three lines of the title's size.
            $titleLine = $lines[$i - 1];
            $titleStart = $i - 1;
            while (
                $titleStart > 0 && $i - $titleStart < 3 && $same($lines[$titleStart - 1], $titleLine)
                && preg_match($range, $lines[$titleStart - 1]['text']) !== 1
                && preg_match(self::DURATION_ONLY, $lines[$titleStart - 1]['text']) !== 1
            ) {
                $titleStart--;
            }
            // The company line is larger than the title. A "2 years 1 month" line between them means several
            // roles at one company.
            $prev = $lines[$titleStart - 1] ?? null;
            $headerStart = $titleStart;
            if (
                $prev !== null
                && preg_match(self::DURATION_ONLY, $prev['text']) === 1
                && isset($lines[$titleStart - 2])
            ) {
                $lastCompany = $lines[$titleStart - 2]['text'];
                $headerStart = $titleStart - 2;
            } elseif (
                $prev !== null
                && $prev['size'] > $titleLine['size'] + 0.25
                && preg_match($range, $prev['text']) !== 1
            ) {
                $lastCompany = $prev['text'];
                $headerStart = $titleStart - 1;
            }
            $title = implode(' ', array_map(
                fn (array $l): string => $l['text'],
                array_slice($lines, $titleStart, $i - $titleStart)
            ));
            $entries[] = [
                'headerStart' => $headerStart,
                'dateIndex' => $i,
                'title' => self::clean($title),
                'company' => $lastCompany,
                'start' => self::month($m[1]),
                'end' => strtolower($m[2]) === 'present' ? null : self::month($m[2]),
            ];
        }

        $jobs = [];
        foreach ($entries as $index => $entry) {
            $end = $entries[$index + 1]['headerStart'] ?? $count;
            $body = array_slice($lines, $entry['dateIndex'] + 1, $end - $entry['dateIndex'] - 1);
            $location = null;
            // The line right after the dates is the job location when it reads like a place.
            if (
                count($body) > 1
                && mb_strlen($body[0]['text']) <= 60
                && preg_match(self::PLACE, $body[0]['text']) === 1
            ) {
                $location = $body[0]['text'];
                $body = array_slice($body, 1);
            }
            $jobs[] = [
                'title' => mb_substr($entry['title'], 0, 200),
                'company' => mb_substr($entry['company'], 0, 200),
                'location' => $location,
                'start' => $entry['start'],
                'end' => $entry['end'],
                'description' => mb_substr(self::clean(implode(' ', array_map(fn ($l) => $l['text'], $body))), 0, 2000),
            ];
        }

        return $jobs;
    }

    /**
     * @param list<Line> $lines
     * @return list<School>
     */
    private static function parseEducation(array $lines): array
    {
        if ($lines === []) {
            return [];
        }
        $small = min(array_map(fn (array $l): float => $l['size'], $lines));
        // A school line is larger than its detail lines (degree, years).
        $schools = [];
        $details = [];
        foreach ($lines as $line) {
            if ($line['size'] > $small + 0.25 || $schools === []) {
                $schools[] = $line['text'];
                $details[] = '';
            } else {
                $details[count($details) - 1] .= ' ' . $line['text'];
            }
        }
        $p = self::datePoint();
        $years = '/\((' . $p . ')\s*[-–]\s*(present|' . $p . ')\)/iu';
        $result = [];
        foreach ($schools as $i => $school) {
            $text = self::clean($details[$i]);
            $found = preg_match($years, $text, $m) === 1;
            $degree = self::clean((string) preg_replace($years, '', explode(' · ', $text)[0]));
            $result[] = [
                'school' => mb_substr($school, 0, 200),
                'degree' => $degree === '' ? null : mb_substr($degree, 0, 200),
                'start_year' => $found ? self::year($m[1]) : null,
                'end_year' => $found && strtolower($m[2]) !== 'present' ? self::year($m[2]) : null,
            ];
        }

        return $result;
    }

    /** "June 2025" or "2025" as YYYY-MM (January when only the year is given). */
    private static function month(string $point): ?string
    {
        $year = self::year($point);
        if ($year === null) {
            return null;
        }
        $months = ['jan' => 1, 'feb' => 2, 'mar' => 3, 'apr' => 4, 'may' => 5, 'jun' => 6, 'jul' => 7, 'aug' => 8,
            'sep' => 9, 'oct' => 10, 'nov' => 11, 'dec' => 12];
        $month = $months[strtolower(substr(trim($point), 0, 3))] ?? 1;

        return sprintf('%04d-%02d', $year, $month);
    }

    private static function year(string $point): ?int
    {
        return preg_match('/(\d{4})/', $point, $m) === 1 ? (int) $m[1] : null;
    }

    private static function clean(mixed $text): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', is_string($text) ? $text : ''));
    }

    /** Cut at the last whole word that fits. */
    private static function clip(string $text, int $max): string
    {
        if (mb_strlen($text) <= $max) {
            return $text;
        }
        $cut = mb_substr($text, 0, $max + 1);
        $space = mb_strrpos($cut, ' ');

        return trim($space !== false && $space > 0 ? mb_substr($cut, 0, $space) : mb_substr($text, 0, $max));
    }
}
