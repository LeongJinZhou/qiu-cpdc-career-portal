<?php

declare(strict_types=1);

namespace Cpdc\Interview\Ai;

/**
 * Local driver for development and tests: no network, same answer for the same input. It scores length, structure
 * (STAR words) and concrete numbers. An answer containing FAIL_MARKER fails, to test the error path.
 */
final class FakeCoach implements Coach
{
    public const FAIL_MARKER = '[fake-ai-fail]';

    public function name(): string
    {
        return 'fake';
    }

    public function feedback(string $field, string $question, string $answer): Feedback
    {
        if (str_contains($answer, self::FAIL_MARKER)) {
            throw new CoachUnavailable('fake failure requested');
        }
        $words = count(preg_split('/\s+/u', trim($answer), -1, PREG_SPLIT_NO_EMPTY) ?: []);
        $structured = preg_match('/\b(situation|task|action|result|because|so that|as a result)\b/iu', $answer) === 1;
        $concrete = preg_match('/\d/u', $answer) === 1;

        $strengths = [];
        $improve = [];
        if ($words >= 60) {
            $strengths[] = 'You gave enough detail for the interviewer to follow.';
        } else {
            $improve[] = 'Add more detail: aim for 60 to 150 words.';
        }
        if ($structured) {
            $strengths[] = 'Your answer has a clear structure.';
        } else {
            $improve[] = 'Use STAR: situation, task, action, result.';
        }
        if ($concrete) {
            $strengths[] = 'You used a concrete number or date.';
        } else {
            $improve[] = 'Add one concrete result, such as a number or a date.';
        }
        $score = 1 + ($words >= 60 ? 1 : 0) + ($words >= 120 ? 1 : 0) + ($structured ? 1 : 0) + ($concrete ? 1 : 0);

        return Feedback::from([
            'score' => min(5, $score),
            'summary' => "Practice feedback for a $field question ($words words).",
            'strengths' => $strengths,
            'improve' => $improve,
        ]);
    }
}
