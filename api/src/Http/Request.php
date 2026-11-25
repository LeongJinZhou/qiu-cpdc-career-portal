<?php

declare(strict_types=1);

namespace Cpdc\Http;

final class Request
{
    public const MAX_BODY_BYTES = 1048576;

    /**
     * The signed-in user row, set by the Session middleware.
     *
     * @var array{id: int, organisation_id: int, email: string|null, display_name: string, role: string,
     *     active: int, onboarded_at: string|null, provider: string}|null
     */
    public ?array $user = null;

    /** Synchronizer token of the current session, set by the Session middleware. */
    public ?string $csrfToken = null;

    /**
     * @param array<mixed> $query raw query string values
     * @param array<string, string> $headers lower-case names
     * @param array<string, string> $cookies
     * @param array<string, string> $form text fields of a multipart request
     * @param array<string, UploadedFile> $files
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query = [],
        public readonly array $headers = [],
        public readonly string $body = '',
        public readonly string $remoteAddr = '',
        public readonly array $cookies = [],
        public readonly array $form = [],
        public readonly array $files = []
    ) {
    }

    public function file(string $field): ?UploadedFile
    {
        return $this->files[$field] ?? null;
    }

    public static function fromGlobals(): self
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (is_string($value) && str_starts_with((string) $key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr((string) $key, 5)))] = $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE']) && is_string($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
        }
        // Read one byte past the cap so json() can tell "too large" without loading a huge body.
        $body = (string) file_get_contents('php://input', false, null, 0, self::MAX_BODY_BYTES + 1);

        return new self(
            strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH),
            $_GET,
            $headers,
            $body,
            (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
            array_filter($_COOKIE, 'is_string'),
            array_filter($_POST, 'is_string'),
            UploadedFile::fromPhp($_FILES, is_uploaded_file(...))
        );
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    /** Decoded JSON body with objects as stdClass, ready for Validator::validate(). */
    public function json(): mixed
    {
        if (strlen($this->body) > self::MAX_BODY_BYTES) {
            throw new ApiError(413, 'FILE_TOO_LARGE', 'Request body is too large.');
        }
        try {
            return json_decode($this->body, false, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw ApiError::validation('body');
        }
    }
}
