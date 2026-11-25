<?php

declare(strict_types=1);

namespace Cpdc\Http\Middleware;

use PDO;
use Cpdc\Http\ApiError;

/**
 * Fixed windows in the rate_limit table: one minute by default, one hour at most. Buckets store only a hash of
 * name + subject.
 */
final class RateLimit
{
    public const MINUTE = 60;
    public const HOUR = 3600;

    /** @param \Closure(): int $clock unix time */
    public function __construct(private readonly PDO $pdo, private readonly \Closure $clock)
    {
    }

    /**
     * @param string $subject "ip:<REMOTE_ADDR>" or "user:<id>"
     * @param int $window window length in seconds: MINUTE or HOUR
     */
    public function hit(string $name, string $subject, int $limit, int $window = self::MINUTE): void
    {
        $bucket = hash('sha256', $name . "\n" . $subject);
        $now = ($this->clock)();
        $start = gmdate('Y-m-d H:i:s', $now - $now % $window);
        // Atomic increment; concurrent callers can only make the count higher, never lose a hit.
        $insert = $this->pdo->prepare(
            'INSERT INTO rate_limit (bucket, window_start, count) VALUES (?, ?, 1)'
            . ' ON DUPLICATE KEY UPDATE count = count + 1'
        );
        $insert->execute([$bucket, $start]);
        if ($insert->rowCount() === 1) {
            // First hit of this bucket in this window (MySQL reports 2 for an update): drop windows that ended,
            // which is every window that started more than the longest window ago.
            $this->pdo->prepare('DELETE FROM rate_limit WHERE window_start < ?')
                ->execute([gmdate('Y-m-d H:i:s', $now - self::HOUR)]);
        }
        $stmt = $this->pdo->prepare('SELECT count FROM rate_limit WHERE bucket = ? AND window_start = ?');
        $stmt->execute([$bucket, $start]);
        if ((int) $stmt->fetchColumn() > $limit) {
            $wait = $window === self::MINUTE ? 'a minute' : 'a while';
            throw new ApiError(429, 'RATE_LIMITED', "Too many requests. Please wait $wait and try again.");
        }
    }
}
