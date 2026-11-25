<?php

declare(strict_types=1);

namespace Cpdc\Jobs;

/**
 * Application status rules. CPDC moves an application between the review statuses; only the applicant withdraws,
 * and a withdrawn application is final. An applicant can withdraw until CPDC has decided (hired or rejected).
 */
final class ApplicationStatus
{
    /** Statuses CPDC may set. */
    public const REVIEW = ['submitted', 'reviewing', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];
    public const ALL = [...self::REVIEW, 'withdrawn'];
    private const DECIDED = ['hired', 'rejected', 'withdrawn'];

    public static function managerMaySet(string $from, string $to): bool
    {
        return $from !== 'withdrawn' && in_array($to, self::REVIEW, true);
    }

    public static function applicantMayWithdraw(string $from): bool
    {
        return in_array($from, self::ALL, true) && !in_array($from, self::DECIDED, true);
    }
}
