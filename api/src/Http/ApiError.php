<?php

declare(strict_types=1);

namespace Cpdc\Http;

/**
 * An error the client may see: status, code from docs/API.md, generic message. `details` are extra keys of the error
 * object (field, index); `field` is the request field a validation error is about, kept for callers that wrap it.
 */
final class ApiError extends \RuntimeException
{
    /** @param array<string, string|int> $details */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $details = [],
        public readonly ?string $field = null
    ) {
        parent::__construct($message);
    }

    /** @param string|null $message a fixed text for the person; then the answer also names the field */
    public static function validation(string $field, ?string $message = null): self
    {
        return $message === null
            ? new self(400, 'VALIDATION', 'Invalid or unknown field: ' . mb_substr($field, 0, 100), [], $field)
            : new self(400, 'VALIDATION', $message, ['field' => $field], $field);
    }
}
