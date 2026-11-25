<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\UploadedFile;

/** Slice 2b helpers: sign in as a role without the onboarding steps, multipart uploads, a CPDC job to apply to. */
abstract class ModuleTestCase extends HttpTestCase
{
    protected const PDF = __DIR__ . '/../fixtures/linkedin-profile.pdf';

    /** Signs in with the fake Google persona, then gives it $role and finished onboarding. Returns the user id. */
    protected function signInAs(string $persona, string $role): int
    {
        $this->jar = [];
        $this->signIn('google', $persona);
        $stmt = $this->pdo->prepare(
            'UPDATE `user` SET role = ?, onboarded_at = UTC_TIMESTAMP(3) WHERE google_sub = ?'
        );
        $stmt->execute([$role, 'g-sub-' . $persona]);
        $this->refreshCsrf();

        return (int) $this->body($this->send('GET', '/api/me'))['user']['id'];
    }

    /**
     * A multipart POST. Each file is copied to a temporary path first, as PHP would hand it over.
     *
     * @param array<string, string> $form
     * @param array<string, string> $files field => source path, or bytes when it starts with "bytes:"
     */
    protected function upload(string $path, array $form, array $files = []): Response
    {
        $uploaded = [];
        foreach ($files as $field => $source) {
            $tmp = (string) tempnam(sys_get_temp_dir(), 'cpdc-up');
            if (str_starts_with($source, 'bytes:')) {
                file_put_contents($tmp, substr($source, 6));
            } else {
                copy($source, $tmp);
            }
            $uploaded[$field] = new UploadedFile($field . '.pdf', $tmp, (int) filesize($tmp), UPLOAD_ERR_OK);
        }
        $headers = ['origin' => self::APP_URL, 'x-csrf-token' => $this->csrf, 'content-type' => 'multipart/form-data'];

        return $this->app->handle(
            new Request('POST', $path, [], $headers, '', '192.0.2.10', $this->jar, $form, $uploaded)
        );
    }

    /** CPDC sets an application's status. */
    protected function setStatus(int $application, string $status): Response
    {
        return $this->json('PATCH', "/api/applications/$application/status", ['status' => $status]);
    }

    /**
     * CPDC decides on a learning record.
     *
     * @param array<string, string> $body
     */
    protected function decide(int $record, array $body): Response
    {
        return $this->json('POST', "/api/learning/$record/decision", $body);
    }

    /**
     * Creates an employer and an open job (as the signed-in CPDC user); returns the job id.
     *
     * @param list<array{area_id: int, level: int}> $skills
     */
    protected function openJob(string $title = 'Data Intern', string $closing = '2030-12-31', array $skills = []): int
    {
        $employer = $this->json('POST', '/api/employers', ['name' => 'Fake Employer ' . $title]);
        $this->assertSame(201, $employer->status, $employer->body);
        $job = $this->json('POST', '/api/jobs/manage', [
            'employer_id' => $this->body($employer)['id'],
            'title' => $title,
            'job_type' => 'internship',
            'location' => 'Ipoh',
            'closing_date' => $closing,
            'description' => 'Fake job for tests.',
            'skills' => $skills,
        ]);
        $this->assertSame(201, $job->status, $job->body);

        return (int) $this->body($job)['id'];
    }

    /** @return int id of the skill area with this name */
    protected function area(string $name): int
    {
        $stmt = $this->pdo->prepare('SELECT id FROM skill_area WHERE organisation_id = 1 AND name = ?');
        $stmt->execute([$name]);

        return (int) $stmt->fetchColumn();
    }
}
