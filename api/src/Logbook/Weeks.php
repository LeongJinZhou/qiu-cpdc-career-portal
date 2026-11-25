<?php

declare(strict_types=1);

namespace Cpdc\Logbook;

/** Internship weeks. A week is named by its Monday (YYYY-MM-DD). Pure date logic, no database. */
final class Weeks
{
    public static function isDate(string $value): bool
    {
        $d = \DateTimeImmutable::createFromFormat('!Y-m-d', $value, new \DateTimeZone('UTC'));

        return $d !== false && $d->format('Y-m-d') === $value;
    }

    /** The Monday of the week that holds $date. */
    public static function monday(string $date): string
    {
        $d = new \DateTimeImmutable($date, new \DateTimeZone('UTC'));

        return $d->modify('-' . ((int) $d->format('N') - 1) . ' days')->format('Y-m-d');
    }

    /** Today's date in the organisation's time zone, from a unix time. */
    public static function today(int $now, string $timezone): string
    {
        return (new \DateTimeImmutable('@' . $now))->setTimezone(new \DateTimeZone($timezone))->format('Y-m-d');
    }

    /**
     * Whether a student may log this week: a Monday, inside the internship, and not after the current week.
     *
     * @return string|null null = allowed; otherwise the reason for the person
     */
    public static function refusal(string $week, string $start, string $end, string $today): ?string
    {
        if (!self::isDate($week) || self::monday($week) !== $week) {
            return 'Pick the Monday of the week.';
        }
        if ($week < self::monday($start) || $week > $end) {
            return 'This week is outside your internship dates.';
        }
        if ($week > self::monday($today)) {
            return 'You can only log a week once it has started.';
        }

        return null;
    }

    /** How many weeks of the internship have started by $today (0 before it starts). */
    public static function expected(string $start, string $end, string $today): int
    {
        $first = new \DateTimeImmutable(self::monday($start), new \DateTimeZone('UTC'));
        $lastDay = min($end, $today);
        if ($lastDay < $start) {
            return 0;
        }
        $last = new \DateTimeImmutable(self::monday($lastDay), new \DateTimeZone('UTC'));

        return intdiv((int) $first->diff($last)->days, 7) + 1;
    }
}
