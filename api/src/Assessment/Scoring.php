<?php

declare(strict_types=1);

namespace Cpdc\Assessment;

use Cpdc\Http\ApiError;

/** Scores one attempt and picks its band. Pure logic: the caller loads the questions from the database. */
final class Scoring
{
    /**
     * @param array<int, array<int, int>> $questions question id => (option id => points)
     * @param list<array{question_id: int, option_id: int}> $answers
     * @param list<array{min_percent: int, label: string}> $bands
     * @return array{score: int, max_score: int, percent: int, band: string|null,
     *     chosen: array<int, int>}
     */
    public static function score(array $questions, array $answers, array $bands): array
    {
        $chosen = [];
        foreach ($answers as $i => $a) {
            $q = $a['question_id'];
            if (!isset($questions[$q]) || isset($chosen[$q])) {
                throw new ApiError(400, 'VALIDATION', 'Answer each question once.', ['field' => "answers.$i"]);
            }
            if (!isset($questions[$q][$a['option_id']])) {
                throw new ApiError(400, 'VALIDATION', 'Pick one of the given answers.', ['field' => "answers.$i"]);
            }
            $chosen[$q] = $a['option_id'];
        }
        if (count($chosen) !== count($questions)) {
            throw new ApiError(400, 'VALIDATION', 'Answer every question.', ['field' => 'answers']);
        }
        $score = 0;
        $max = 0;
        foreach ($questions as $q => $options) {
            $score += $options[$chosen[$q]];
            $max += $options === [] ? 0 : max($options);
        }
        $percent = $max === 0 ? 0 : intdiv($score * 100, $max);

        return ['score' => $score, 'max_score' => $max, 'percent' => $percent, 'band' => self::band($bands, $percent),
            'chosen' => $chosen];
    }

    /** @param list<array{min_percent: int, label: string}> $bands */
    public static function band(array $bands, int $percent): ?string
    {
        $best = null;
        foreach ($bands as $b) {
            if ($b['min_percent'] <= $percent && ($best === null || $b['min_percent'] > $best['min_percent'])) {
                $best = $b;
            }
        }

        return $best['label'] ?? null;
    }

    /**
     * Bands sorted from lowest; one must start at 0 so every score has a band, and no two may share a start.
     *
     * @param list<array{min_percent: int, label: string}> $bands
     * @return list<array{min_percent: int, label: string}>
     */
    public static function checkBands(array $bands): array
    {
        $starts = array_map(static fn (array $b): int => $b['min_percent'], $bands);
        if (!in_array(0, $starts, true)) {
            throw ApiError::validation('bands', 'One result band must start at 0%.');
        }
        if (count(array_unique($starts)) !== count($starts)) {
            throw ApiError::validation('bands', 'Two result bands start at the same score.');
        }
        usort($bands, static fn (array $a, array $b): int => $a['min_percent'] <=> $b['min_percent']);

        return array_map(
            static fn (array $b): array => ['min_percent' => $b['min_percent'], 'label' => trim($b['label'])],
            $bands
        );
    }
}
