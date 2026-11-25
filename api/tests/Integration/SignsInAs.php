<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\UploadedFile;

/**
 * Slice 2a test helpers for HttpTestCase: sign in a fake Google persona with onboarding done (the LinkedIn gate is
 * covered by the slice 1 tests), and send requests the shared helpers do not cover.
 */
trait SignsInAs
{
    /** @return int the user id */
    protected function signInAs(string $persona, ?string $role = null): int
    {
        $this->jar = [];
        $this->signIn('google', $persona);
        $stmt = $this->pdo->prepare('SELECT id FROM `user` WHERE google_sub = ?');
        $stmt->execute(['g-sub-' . $persona]);
        $id = (int) $stmt->fetchColumn();
        $this->pdo->prepare('UPDATE `user` SET onboarded_at = UTC_TIMESTAMP(3), role = COALESCE(?, role) WHERE id = ?')
            ->execute([$role, $id]);
        $this->refreshCsrf();

        return $id;
    }

    /**
     * A JSON request that must fail with $status and $code.
     *
     * @param array<string, mixed> $data
     */
    protected function refused(string $method, string $path, array $data, int $status, string $code): void
    {
        $this->assertError($this->json($method, $path, $data), $status, $code);
    }

    /** A COUNT(*) of a fixed test query. */
    protected function countRows(string $query): int
    {
        return (int) $this->sql($query)->fetchColumn();
    }

    /** Signed out, as a supervisor opening an emailed link. */
    protected function signOutLocally(): void
    {
        $this->jar = [];
        $this->csrf = '';
    }

    /** A multipart upload of one file in field "file". */
    protected function upload(string $path, string $bytes, int $error = UPLOAD_ERR_OK, ?int $size = null): Response
    {
        $tmp = tempnam(sys_get_temp_dir(), 'cpdc-up');
        file_put_contents((string) $tmp, $bytes);
        $file = new UploadedFile('picture.png', (string) $tmp, $size ?? strlen($bytes), $error);
        $headers = ['origin' => self::APP_URL, 'x-csrf-token' => $this->csrf];

        return $this->app->handle(
            new Request('POST', $path, [], $headers, '', '192.0.2.10', $this->jar, [], ['file' => $file])
        );
    }

    /** A JSON request from another site (no matching Origin). */
    protected function foreign(string $method, string $path, string $body): Response
    {
        $headers = ['origin' => 'https://evil.example', 'content-type' => 'application/json'];

        return $this->app->handle(new Request($method, $path, [], $headers, $body, '192.0.2.10', $this->jar));
    }
}
