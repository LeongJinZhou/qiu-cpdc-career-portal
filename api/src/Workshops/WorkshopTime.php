<?php

declare(strict_types=1);

namespace Cpdc\Workshops;

use Cpdc\Http\ApiError;

/**
 * Workshop times: CPDC types Malaysia time ("2026-12-03T14:00", setting display_timezone); the database keeps UTC.
 * Malaysia has no daylight saving, but the zone comes from the setting so the rule lives in one place.
 */
final class WorkshopTime
{
    private const LOCAL = 'Y-m-d\TH:i';

    /** "2026-12-03T14:00" in $zone to "2026-12-03 06:00:00" UTC. */
    public static function toUtc(string $local, string $zone, string $field): string
    {
        $tz = new \DateTimeZone($zone);
        $time = \DateTimeImmutable::createFromFormat('!' . self::LOCAL, $local, $tz);
        $errors = \DateTimeImmutable::getLastErrors();
        if ($time === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            throw ApiError::validation($field, 'Enter a date and time.');
        }
        if ($time->format(self::LOCAL) !== $local) {
            throw ApiError::validation($field, 'Enter a date and time.'); // 2026-02-30 and the like
        }

        return $time->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    /** A UTC database value to unix time. */
    public static function unix(string $utc): int
    {
        return (new \DateTimeImmutable($utc, new \DateTimeZone('UTC')))->getTimestamp();
    }

    /** Unix time to the UTC form the database compares with. */
    public static function sql(int $unix): string
    {
        return gmdate('Y-m-d H:i:s', $unix);
    }

    /** A UTC database value as ISO 8601 with Z, for the screens. */
    public static function iso(string $utc): string
    {
        return gmdate('Y-m-d\TH:i:s\Z', self::unix($utc));
    }

    /** A UTC database value as local time in the form the edit screen uses. */
    public static function local(string $utc, string $zone): string
    {
        return (new \DateTimeImmutable($utc, new \DateTimeZone('UTC')))
            ->setTimezone(new \DateTimeZone($zone))
            ->format(self::LOCAL);
    }

    /** A UTC value (database or ISO with Z) as "2026-12-03 14:00" local time, for the CSV. */
    public static function readable(?string $utc, string $zone): string
    {
        return $utc === null ? '' : str_replace('T', ' ', self::local($utc, $zone));
    }
}
