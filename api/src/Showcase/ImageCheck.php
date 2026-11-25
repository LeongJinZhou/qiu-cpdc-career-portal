<?php

declare(strict_types=1);

namespace Cpdc\Showcase;

use Cpdc\Http\ApiError;
use Cpdc\Http\UploadedFile;

/**
 * Accepts a project image only when its bytes are a PNG, JPEG or WebP picture of sane size. The client's file name
 * and content type are never trusted: the type comes from the file itself, and the stored name is made here.
 */
final class ImageCheck
{
    public const TYPES = [
        IMAGETYPE_PNG => ['mime' => 'image/png', 'ext' => 'png'],
        IMAGETYPE_JPEG => ['mime' => 'image/jpeg', 'ext' => 'jpg'],
        IMAGETYPE_WEBP => ['mime' => 'image/webp', 'ext' => 'webp'],
    ];
    private const MAX_SIDE = 6000;

    /** @return array{mime: string, ext: string, path: string} */
    public static function check(?UploadedFile $file, int $maxBytes): array
    {
        if ($file === null) {
            throw ApiError::validation('file', 'Choose an image.');
        }
        $mb = intdiv($maxBytes, 1048576);
        if ($file->error === UPLOAD_ERR_INI_SIZE || $file->error === UPLOAD_ERR_FORM_SIZE || $file->size > $maxBytes) {
            throw new ApiError(413, 'FILE_TOO_LARGE', "The image must be $mb MB or smaller.");
        }
        if ($file->error !== UPLOAD_ERR_OK || $file->size === 0 || !is_file($file->path)) {
            throw ApiError::validation('file', 'The image did not arrive. Try again.');
        }
        $info = @getimagesize($file->path);
        if ($info === false || !isset(self::TYPES[$info[2]])) {
            throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Use a PNG, JPEG or WebP image.');
        }
        if ($info[0] < 1 || $info[1] < 1 || $info[0] > self::MAX_SIDE || $info[1] > self::MAX_SIDE) {
            throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'The image must be at most 6000 pixels on each side.');
        }

        return self::TYPES[$info[2]] + ['path' => $file->path];
    }

    /** A new random stored name: 32 hex characters and the extension of the checked type. */
    public static function storedName(string $ext): string
    {
        return bin2hex(random_bytes(16)) . '.' . $ext;
    }

    /** Only names this class makes are ever turned into a path. */
    public static function isStoredName(string $name): bool
    {
        return preg_match('/^[0-9a-f]{32}\.(png|jpg|webp)$/D', $name) === 1;
    }
}
