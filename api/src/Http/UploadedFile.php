<?php

declare(strict_types=1);

namespace Cpdc\Http;

/** One file of a multipart request, as PHP parsed it. The name is the client's and is display-only. */
final class UploadedFile
{
    public function __construct(
        public readonly string $name,
        public readonly string $path,
        public readonly int $size,
        public readonly int $error
    ) {
    }

    /**
     * @param array<mixed> $files the $_FILES array
     * @param \Closure(string): bool $isUpload is_uploaded_file: a path the client names is never trusted
     * @return array<string, self> fields with a real upload, or with an upload error (too large); no empty field
     */
    public static function fromPhp(array $files, \Closure $isUpload): array
    {
        $out = [];
        foreach ($files as $field => $f) {
            if (!is_array($f) || !is_string($f['tmp_name'] ?? null) || !is_int($f['error'] ?? null)) {
                continue; // an array field (file[]) or garbage
            }
            $name = is_string($f['name'] ?? null) ? $f['name'] : '';
            $size = is_int($f['size'] ?? null) ? $f['size'] : 0;
            if ($f['error'] === UPLOAD_ERR_OK && $isUpload($f['tmp_name'])) {
                $out[(string) $field] = new self($name, $f['tmp_name'], $size, UPLOAD_ERR_OK);
            } elseif ($f['error'] !== UPLOAD_ERR_OK && $f['error'] !== UPLOAD_ERR_NO_FILE) {
                $out[(string) $field] = new self($name, '', $size, $f['error']);
            }
        }

        return $out;
    }
}
