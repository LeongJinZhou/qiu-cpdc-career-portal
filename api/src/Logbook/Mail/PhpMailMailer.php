<?php

declare(strict_types=1);

namespace Cpdc\Logbook\Mail;

/**
 * PHP mail(): the host's own sendmail (Exabytes cPanel has one; no paid service). Addresses are checked and line
 * breaks removed from the subject so no header can be injected.
 */
final class PhpMailMailer implements Mailer
{
    public function __construct(private readonly string $from)
    {
        if (filter_var($from, FILTER_VALIDATE_EMAIL) === false) {
            throw new \RuntimeException('MAIL_FROM is not a valid address');
        }
    }

    public function send(string $to, string $subject, string $text): void
    {
        if (filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
            throw new \RuntimeException('recipient is not a valid address');
        }
        $subject = '=?UTF-8?B?' . base64_encode(self::oneLine($subject)) . '?=';
        $headers = [
            'From' => $this->from,
            'MIME-Version' => '1.0',
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Content-Transfer-Encoding' => '8bit',
        ];
        if (!mail($to, $subject, str_replace("\r\n", "\n", $text), $headers)) {
            throw new \RuntimeException('mail() refused the message');
        }
    }

    public static function oneLine(string $value): string
    {
        return trim((string) preg_replace('/[\r\n\t]+/', ' ', $value));
    }
}
