<?php

declare(strict_types=1);

namespace Cpdc\Interview\Ai;

/** Gives feedback on one interview answer. Drivers run on the server only; the browser never sees a key. */
interface Coach
{
    /** Short driver name stored with each feedback row ("fake", "anthropic"). */
    public function name(): string;

    /** @throws CoachUnavailable when the provider fails or declines; the caller frees the answer for a retry */
    public function feedback(string $field, string $question, string $answer): Feedback;
}
