<?php

declare(strict_types=1);

namespace Cpdc\Logbook\Mail;

/** Picks the mail driver from MAIL_DRIVER: "log" (default outside production) or "mail" (needs MAIL_FROM). */
final class Mailers
{
    public static function fromEnv(string $storageDir): Mailer
    {
        $driver = trim((string) getenv('MAIL_DRIVER'));
        if ($driver === '') {
            $driver = getenv('APP_ENV') === 'production' ? '' : 'log';
        }

        return match ($driver) {
            'log' => new LogMailer(self::logFile($storageDir)),
            'mail' => new PhpMailMailer(trim((string) getenv('MAIL_FROM'))),
            default => throw new \RuntimeException('MAIL_DRIVER must be log or mail'),
        };
    }

    public static function logFile(string $storageDir): string
    {
        return $storageDir . '/logs/mail.log';
    }
}
