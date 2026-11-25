<?php

declare(strict_types=1);

namespace Cpdc\Logbook\Mail;

/** Sends one plain-text email. Drivers: LogMailer (local, tests, Render test copy) and PhpMailMailer (cPanel). */
interface Mailer
{
    /** @throws \RuntimeException when the message could not be handed over */
    public function send(string $to, string $subject, string $text): void;
}
