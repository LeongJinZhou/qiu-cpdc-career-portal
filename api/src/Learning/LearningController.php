<?php

declare(strict_types=1);

namespace Cpdc\Learning;

use Cpdc\App;
use Cpdc\Audit\Audit;
use Cpdc\Http\ApiError;
use Cpdc\Http\Paginator;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Jobs\JobsController;
use Cpdc\Jobs\LocalDate;
use Cpdc\Jobs\PdfStore;
use Cpdc\Profile\ProfileController;

/** Learning records: the person's own (learning.own) and CPDC's verification (learning.verify). */
final class LearningController
{
    /** @param array<string, string> $params */
    public static function mine(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'learning.own');

        return Response::json([
            'items' => (new LearningService($app->pdo()))->mine($user['organisation_id'], $user['id']),
        ]);
    }

    /**
     * Multipart: text fields of learning.save.json, optional PDF file field "proof". Needs a link or the PDF.
     *
     * @param array<string, string> $params
     */
    public static function add(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'learning.own');
        $form = (new Validator())->validate(ProfileController::SCHEMAS . 'learning.save.json', (object) $req->form);
        $completed = LocalDate::parse((string) $form['completed_on'], 'completed_on');
        if ($completed > JobsController::today($app, $user)) {
            throw ApiError::validation('completed_on', 'The completion date cannot be in the future.');
        }
        $link = trim((string) ($form['link_url'] ?? ''));
        $data = [
            'kind' => (string) $form['kind'],
            'name' => trim((string) $form['name']),
            'provider' => trim((string) $form['provider']),
            'completed_on' => $completed,
            'link_url' => $link === '' ? null : $link,
        ];
        $store = new PdfStore($app->storageDir, PdfStore::LEARNING);
        $file = $req->file('proof');
        $proof = $file === null
            ? null
            : $store->keep($file, $app->settings($user['organisation_id'])->int('upload_pdf_max_bytes'), 'proof');
        $service = new LearningService($app->pdo());
        try {
            $id = $service->add($user, $data, $proof);
        } catch (\Throwable $e) {
            $store->delete($proof['key'] ?? null);
            throw $e;
        }

        return Response::json(['id' => $id, 'items' => $service->mine($user['organisation_id'], $user['id'])], 201);
    }

    /** @param array<string, string> $params */
    public static function delete(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'learning.own');
        $proof = (new LearningService($app->pdo()))->delete($user, (int) $params['id']);
        (new PdfStore($app->storageDir, PdfStore::LEARNING))->delete($proof);

        return new Response(204);
    }

    /**
     * The proof PDF: the owner's own, or any for CPDC (learning.verify, audited).
     *
     * @param array<string, string> $params
     */
    public static function proof(Request $req, array $params, App $app): Response
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $verifier = $app->access()->can($user, 'learning.verify');
        if (!$verifier) {
            $app->access()->require($user, 'learning.own');
        }
        $id = (int) $params['id'];
        $proof = (new LearningService($app->pdo()))->proof($user['organisation_id'], $user['id'], $id, $verifier);
        if ($verifier) {
            Audit::log($app->pdo(), $user, 'learning.proof_download', 'learning:' . $id);
        }

        return (new PdfStore($app->storageDir, PdfStore::LEARNING))
            ->download((string) $proof['proof_file'], (string) $proof['proof_name']);
    }

    /** @param array<string, string> $params */
    public static function review(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'learning.verify');
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'learning.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($admin['organisation_id']));
        $status = isset($query['status']) ? (string) $query['status'] : null;

        return Response::json((new LearningService($app->pdo()))
            ->review($admin['organisation_id'], $status, trim((string) ($query['q'] ?? '')), $page));
    }

    /** @param array<string, string> $params */
    public static function decide(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'learning.verify');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'learning.decision.json', $req->json());
        (new LearningService($app->pdo()))
            ->decide($admin, (int) $params['id'], (string) $body['decision'], trim((string) ($body['note'] ?? '')));

        return new Response(204);
    }

    /**
     * @return array{id: int, organisation_id: int, email: string|null, display_name: string, role: string,
     *     active: int, onboarded_at: string|null, provider: string}
     */
    private static function user(Request $req, App $app, string $permission): array
    {
        $user = $req->user ?? throw new \LogicException('route is not public');
        $app->access()->require($user, $permission);

        return $user;
    }
}
