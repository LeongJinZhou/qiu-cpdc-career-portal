<?php

declare(strict_types=1);

namespace Cpdc\Interview\Ai;

/** Feedback on one answer: a 1-5 score, a summary, what was strong and what to improve. Built only through from(). */
final class Feedback
{
    public const MAX_TEXT = 400;
    public const MAX_POINTS = 4;

    /**
     * @param list<string> $strengths
     * @param list<string> $improve
     */
    private function __construct(
        public readonly int $score,
        public readonly string $summary,
        public readonly array $strengths,
        public readonly array $improve
    ) {
    }

    /**
     * Checks and trims untrusted driver output (a model's JSON). Anything off shape throws.
     *
     * @throws CoachUnavailable
     */
    public static function from(mixed $data): self
    {
        if (!is_array($data)) {
            throw new CoachUnavailable('feedback is not an object');
        }
        $score = $data['score'] ?? null;
        $summary = $data['summary'] ?? null;
        if (!is_int($score) || $score < 1 || $score > 5 || !is_string($summary) || trim($summary) === '') {
            throw new CoachUnavailable('feedback has no valid score or summary');
        }

        return new self(
            $score,
            self::clip($summary),
            self::points($data['strengths'] ?? []),
            self::points($data['improve'] ?? [])
        );
    }

    /** @return array{score: int, summary: string, strengths: list<string>, improve: list<string>} */
    public function toArray(): array
    {
        return [
            'score' => $this->score,
            'summary' => $this->summary,
            'strengths' => $this->strengths,
            'improve' => $this->improve,
        ];
    }

    /** @return list<string> */
    private static function points(mixed $list): array
    {
        if (!is_array($list)) {
            throw new CoachUnavailable('feedback points are not a list');
        }
        $points = [];
        foreach ($list as $item) {
            if (is_string($item) && trim($item) !== '') {
                $points[] = self::clip($item);
            }
        }

        return array_slice($points, 0, self::MAX_POINTS);
    }

    private static function clip(string $text): string
    {
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));

        return mb_strlen($text) > self::MAX_TEXT ? mb_substr($text, 0, self::MAX_TEXT - 1) . '…' : $text;
    }
}
