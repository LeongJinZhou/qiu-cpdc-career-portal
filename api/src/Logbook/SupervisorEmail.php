<?php

declare(strict_types=1);

namespace Cpdc\Logbook;

use Cpdc\Auth\QiuEmail;

/**
 * Flags supervisor addresses CPDC should check by hand: free-mail and QIU addresses are not a company's, so a student
 * could approve their own weeks through one. A flag only; company domains vary too much to refuse anything.
 */
final class SupervisorEmail
{
    private const FREE_MAIL = ['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.com.my', 'ymail.com',
        'hotmail.com', 'hotmail.my', 'outlook.com', 'outlook.my', 'live.com', 'msn.com', 'icloud.com', 'me.com',
        'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'qq.com', '163.com', 'zoho.com'];

    public static function isPersonal(string $email): bool
    {
        $email = strtolower(trim($email));
        $at = strrpos($email, '@');
        if ($at === false) {
            return true;
        }

        return in_array(substr($email, $at + 1), self::FREE_MAIL, true) || QiuEmail::is($email);
    }
}
