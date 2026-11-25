<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use Cpdc\Assessment\Scoring;
use Cpdc\Http\ApiError;
use PHPUnit\Framework\TestCase;

final class ScoringTest extends TestCase
{
    private const QUESTIONS = [10 => [100 => 0, 101 => 3], 11 => [110 => 1, 111 => 2, 112 => 5]];
    private const BANDS = [['min_percent' => 0, 'label' => 'Low'], ['min_percent' => 50, 'label' => 'Mid'],
        ['min_percent' => 100, 'label' => 'Top']];

    public function testScoresChosenPointsOverTheBestPossible(): void
    {
        $result = Scoring::score(self::QUESTIONS, [
            ['question_id' => 11, 'option_id' => 111], ['question_id' => 10, 'option_id' => 101],
        ], self::BANDS);
        $this->assertSame(
            [5, 8, 62, 'Mid'],
            [$result['score'], $result['max_score'], $result['percent'], $result['band']]
        );
        $this->assertSame([11 => 111, 10 => 101], $result['chosen']);
    }

    public function testFullMarksAndZero(): void
    {
        $top = Scoring::score(self::QUESTIONS, [['question_id' => 10, 'option_id' => 101],
            ['question_id' => 11, 'option_id' => 112]], self::BANDS);
        $this->assertSame([100, 'Top'], [$top['percent'], $top['band']]);
        $zero = Scoring::score([1 => [5 => 0, 6 => 0]], [['question_id' => 1, 'option_id' => 5]], self::BANDS);
        $this->assertSame([0, 0, 0, 'Low'], [$zero['score'], $zero['max_score'], $zero['percent'], $zero['band']]);
    }

    /** @return array<string, array{list<array{question_id: int, option_id: int}>}> */
    public static function badAnswers(): array
    {
        return [
            'missing question' => [[['question_id' => 10, 'option_id' => 100]]],
            'twice' => [[['question_id' => 10, 'option_id' => 100], ['question_id' => 10, 'option_id' => 101]]],
            'other question option' => [[['question_id' => 10, 'option_id' => 110],
                ['question_id' => 11, 'option_id' => 111]]],
            'unknown question' => [[['question_id' => 99, 'option_id' => 100],
                ['question_id' => 11, 'option_id' => 111]]],
        ];
    }

    /** @param list<array{question_id: int, option_id: int}> $answers */
    #[\PHPUnit\Framework\Attributes\DataProvider('badAnswers')]
    public function testRefusesIncompleteOrForeignAnswers(array $answers): void
    {
        $this->expectException(ApiError::class);
        Scoring::score(self::QUESTIONS, $answers, self::BANDS);
    }

    public function testBandsAreSortedAndMustStartAtZeroOnce(): void
    {
        $this->assertSame(
            [['min_percent' => 0, 'label' => 'A'], ['min_percent' => 60, 'label' => 'B']],
            Scoring::checkBands([['min_percent' => 60, 'label' => ' B '], ['min_percent' => 0, 'label' => 'A']])
        );
        $bands = [['min_percent' => 0, 'label' => 'A'], ['min_percent' => 60, 'label' => 'B']];
        $this->assertSame('B', Scoring::band($bands, 60));
        foreach (
            [[['min_percent' => 10, 'label' => 'A']], [['min_percent' => 0, 'label' => 'A'],
            ['min_percent' => 0, 'label' => 'B']]] as $bad
        ) {
            try {
                Scoring::checkBands($bad);
                $this->fail('accepted bad bands');
            } catch (ApiError $e) {
                $this->assertSame('bands', $e->field);
            }
        }
    }
}
