<?php

declare(strict_types=1);

namespace Cpdc\Jobs;

use Cpdc\Http\ApiError;

/** Calendar dates in the organisation's display time zone (closing dates, completion dates). */
final class LocalDate
{
    /** Today's date (Y-m-d) in $timezone at unix time $now. */
    public static function today(int $now, string $timezone): string
    {
        return (new \DateTimeImmutable('@' . $now))->setTimezone(new \DateTimeZone($timezone))->format('Y-m-d');
    }

    /** A real calendar date in Y-m-d form, or a validation error on $field. */
    public static function parse(string $value, string $field): string
    {
        $shaped = preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $value, $m) === 1;
        if (!$shaped || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            throw ApiError::validation($field, 'Enter a real date.');
        }
        if ((int) $m[1] < 1990 || (int) $m[1] > 2100) {
            throw ApiError::validation($field, 'Enter a date between 1990 and 2100.');
        }

        return $value;
    }
}
