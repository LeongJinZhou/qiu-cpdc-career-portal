<?php

declare(strict_types=1);

namespace Cpdc\Logbook\Mail;

/**
 * Sends nothing: appends each message as one JSON line to STORAGE_DIR/logs/mail.log. For local work and tests only;
 * the file holds working review links, so it lives with the other private logs, never in a public folder.
 */
final class LogMailer implements Mailer
{
    public function __construct(private readonly string $file)
    {
    }

    public function send(string $to, string $subject, string $text): void
    {
        $dir = dirname($this->file);
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new \RuntimeException('mail log folder cannot be created');
        }
        $line = json_encode(
            ['to' => $to, 'subject' => $subject, 'text' => $text, 'at' => gmdate('c')],
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES
        );
        if (file_put_contents($this->file, $line . "\n", FILE_APPEND | LOCK_EX) === false) {
            throw new \RuntimeException('mail log cannot be written');
        }
    }

    /**
     * Messages written so far, oldest first (tests and the local mail viewer).
     *
     * @return list<array{to: string, subject: string, text: string}>
     */
    public function messages(): array
    {
        if (!is_readable($this->file)) {
            return [];
        }
        $out = [];
        foreach (file($this->file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $m = json_decode($line, true);
            if (
                is_array($m) && is_string($m['to'] ?? null) && is_string($m['subject'] ?? null)
                && is_string($m['text'] ?? null)
            ) {
                $out[] = ['to' => $m['to'], 'subject' => $m['subject'], 'text' => $m['text']];
            }
        }

        return $out;
    }
}
