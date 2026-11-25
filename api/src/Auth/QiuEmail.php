<?php

declare(strict_types=1);

namespace Cpdc\Auth;

/** A QIU address (qiu.edu.my or any subdomain): never kept as a personal email (docs/SPEC.md rule 15). */
final class QiuEmail
{
    public static function is(string $email): bool
    {
        $domain = strtolower((string) substr($email, (int) strrpos($email, '@') + 1));

        return $domain === 'qiu.edu.my' || str_ends_with($domain, '.qiu.edu.my');
    }
}
