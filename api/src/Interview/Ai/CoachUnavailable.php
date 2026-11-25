<?php

declare(strict_types=1);

namespace Cpdc\Interview\Ai;

/** The AI provider could not give feedback (network, error answer, refusal, unreadable output). */
final class CoachUnavailable extends \RuntimeException
{
}
