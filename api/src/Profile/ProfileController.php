<?php

declare(strict_types=1);

namespace Cpdc\Profile;

use Cpdc\App;
use Cpdc\Http\ApiError;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;

/** The signed-in person's own profile, onboarding and LinkedIn PDF import (docs/SPEC.md rules 6, 7, 11, 12). */
final class ProfileController
{
    public const SCHEMAS = __DIR__ . '/../../../shared/schemas/';

    /** @param array<string, string> $params */
    public static function show(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);

        return Response::json((new ProfileService($app->pdo()))->get($user['organisation_id'], $user['id']));
    }

    /** @param array<string, string> $params */
    public static function save(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);
        $body = (new Validator())->validate(self::SCHEMAS . 'profile.save.json', $req->json());
        $service = new ProfileService($app->pdo());
        $service->save(
            $user,
            $body['fields'] ?? [],
            $body['experience'] ?? null,
            $body['education'] ?? null,
            $body['skills'] ?? null,
            ($body['source'] ?? 'manual') === 'pdf' ? 'pdf' : 'manual'
        );

        return Response::json($service->get($user['organisation_id'], $user['id']));
    }

    /**
     * Reads an uploaded LinkedIn PDF and returns what it found. Nothing is saved: the person reviews the preview
     * and saves it with PUT /api/profile (source "pdf"). The file is never kept.
     *
     * @param array<string, string> $params
     */
    public static function readPdf(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);
        $max = $app->settings($user['organisation_id'])->int('pdf_import_max_bytes');
        $file = $req->file('file') ?? throw ApiError::validation('file', 'Choose your LinkedIn PDF.');
        if ($file->error !== UPLOAD_ERR_OK || $file->size > $max || $file->size === 0) {
            throw new ApiError(413, 'FILE_TOO_LARGE', 'The PDF must be smaller than ' . intdiv($max, 1048576) . ' MB.');
        }
        $bytes = (string) file_get_contents($file->path, false, null, 0, max(1, $max + 1));
        @unlink($file->path); // never kept
        try {
            $parsed = LinkedInPdf::parseLines(LinkedInPdf::extractLines($bytes));
        } catch (\InvalidArgumentException) {
            throw new ApiError(
                422,
                'PDF_UNREADABLE',
                'This file could not be read. Download the PDF from your LinkedIn profile again.'
            );
        }
        if (!$parsed['looks_like_linkedin']) {
            throw new ApiError(422, 'NOT_LINKEDIN_PDF', 'This does not look like a LinkedIn profile PDF.');
        }

        return Response::json($parsed);
    }

    /** @param array<string, string> $params */
    public static function completeOnboarding(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);
        $body = (new Validator())->validate(self::SCHEMAS . 'onboarding.json', $req->json());
        $version = $app->settings($user['organisation_id'])->string('consent_version');
        Onboarding::complete($app->pdo(), $user, (string) $body['profile_url'], $version);

        return new Response(204);
    }

    /** @param array<string, string> $params */
    public static function changeLinkedInUrl(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);
        $body = (new Validator())->validate(self::SCHEMAS . 'linkedin-url.json', $req->json());

        return Response::json([
            'profile_url' => Onboarding::changeUrl($app->pdo(), $user, (string) $body['profile_url']),
        ]);
    }

    /** @param array<string, string> $params */
    public static function confirmJob(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app);
        if ($user['role'] !== 'alumni') {
            throw new ApiError(403, 'FORBIDDEN', 'Only alumni confirm a job here.');
        }
        $body = (new Validator())->validate(self::SCHEMAS . 'job-confirmation.json', $req->json());
        (new ProfileService($app->pdo()))->confirmJob(
            $user,
            (string) $body['employment_status'],
            $body['title'] ?? null,
            $body['company'] ?? null
        );

        return new Response(204);
    }

    /**
     * The signed-in user, who must hold profile.own.
     *
     * @return array{id: int, organisation_id: int, email: string|null, display_name: string, role: string,
     *     active: int, onboarded_at: string|null, provider: string}
     */
    private static function user(Request $req, App $app): array
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $app->access()->require($user, 'profile.own');

        return $user;
    }
}
