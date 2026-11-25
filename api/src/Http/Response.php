<?php

declare(strict_types=1);

namespace Cpdc\Http;

final class Response
{
    /** @param array<string, string|list<string>> $headers a list value sends the header once per item (Set-Cookie) */
    public function __construct(
        public readonly int $status,
        public readonly string $body = '',
        public array $headers = []
    ) {
    }

    public static function json(mixed $data, int $status = 200): self
    {
        return new self($status, json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
    }

    /**
     * @param string $location a validated relative path or a URL built from configuration
     * @param array<string, string|list<string>> $headers
     */
    public static function redirect(string $location, array $headers = []): self
    {
        return new self(302, '', ['Location' => $location] + $headers);
    }

    /** @param array<string, string|int> $details extra keys of the error object, after code and message */
    public static function error(int $status, string $code, string $message, array $details = []): self
    {
        return self::json(['error' => ['code' => $code, 'message' => $message] + $details], $status);
    }

    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $values) {
            foreach ((array) $values as $value) {
                header($name . ': ' . $value, false);
            }
        }
        echo $this->body;
    }
}
