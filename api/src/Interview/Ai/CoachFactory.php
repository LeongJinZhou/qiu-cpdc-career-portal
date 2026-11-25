<?php

declare(strict_types=1);

namespace Cpdc\Interview\Ai;

use GuzzleHttp\Client;

/**
 * Picks the AI driver from the server environment. AI_DRIVER=fake (never in production) or anthropic with
 * ANTHROPIC_API_KEY set; anything else = not set up (null), and the feature says so.
 */
final class CoachFactory
{
    public const DEFAULT_MODEL = 'claude-opus-5-5';

    public static function fromEnv(): ?Coach
    {
        $driver = trim((string) getenv('AI_DRIVER'));
        if ($driver === 'fake') {
            return getenv('APP_ENV') === 'production' ? null : new FakeCoach();
        }
        $key = trim((string) getenv('ANTHROPIC_API_KEY'));
        if ($driver !== 'anthropic' || $key === '') {
            return null;
        }
        $model = trim((string) getenv('AI_MODEL'));

        return new AnthropicCoach(new Client(), $key, $model === '' ? self::DEFAULT_MODEL : $model);
    }
}
