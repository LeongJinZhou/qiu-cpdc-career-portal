<?php

declare(strict_types=1);

namespace Cpdc\Interview;

use Cpdc\App;
use Cpdc\Http\ApiError;
use Cpdc\Http\Paginator;
use Cpdc\Http\Request;
use Cpdc\Http\Response;
use Cpdc\Http\Validator;
use Cpdc\Interview\Ai\Coach;
use Cpdc\Interview\Ai\CoachFactory;
use Cpdc\Profile\ProfileController;

/** Interview practice with AI feedback, and the CPDC question bank (docs/SPEC.md section 9). */
final class InterviewController
{
    public const MIN_ANSWER = 20;

    /** @param array<string, string> $params */
    public static function status(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'interview.practice');
        $settings = $app->settings($user['organisation_id']);
        $service = new InterviewService($app->pdo());

        return Response::json([
            'ready' => self::coach() !== null,
            'used_today' => $service->usedToday($user['id'], self::now($app)),
            'daily_limit' => $settings->int('interview_ai_per_user_per_day'),
            'max_chars' => $settings->int('interview_answer_max_chars'),
            'min_chars' => self::MIN_ANSWER,
            'fields' => $service->fields($user['organisation_id']),
        ]);
    }

    /** @param array<string, string> $params */
    public static function sessions(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'interview.practice');

        return Response::json(['items' => (new InterviewService($app->pdo()))->sessions($user)]);
    }

    /** @param array<string, string> $params */
    public static function start(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'interview.practice');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'interview-session.json', $req->json());
        $count = $app->settings($user['organisation_id'])->int('interview_questions_per_session');
        $service = new InterviewService($app->pdo());
        $id = $service->start($user, trim((string) $body['field']), $count, self::now($app));

        return Response::json($service->session($user, $id), 201);
    }

    /** @param array<string, string> $params */
    public static function show(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'interview.practice');

        return Response::json((new InterviewService($app->pdo()))->session($user, (int) $params['id']));
    }

    /** @param array<string, string> $params */
    public static function answer(Request $req, array $params, App $app): Response
    {
        $user = self::user($req, $app, 'interview.practice');
        $coach = self::coach() ?? throw new ApiError(503, 'AI_NOT_SET_UP', 'Interview feedback is not set up yet.');
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'interview-answer.json', $req->json());
        $settings = $app->settings($user['organisation_id']);
        $max = $settings->int('interview_answer_max_chars');
        $answer = trim((string) $body['answer']);
        if (mb_strlen($answer) < self::MIN_ANSWER) {
            throw ApiError::validation('answer', 'Write at least ' . self::MIN_ANSWER . ' characters.');
        }
        if (mb_strlen($answer) > $max) {
            throw ApiError::validation('answer', "Keep your answer under $max characters.");
        }

        return Response::json((new InterviewService($app->pdo()))->answer(
            $user,
            (int) $params['id'],
            (int) $params['item'],
            $answer,
            $coach,
            $settings->int('interview_ai_per_user_per_day'),
            self::now($app)
        ));
    }

    /** @param array<string, string> $params */
    public static function questions(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'interview.bank');
        $query = (new Validator())->query(ProfileController::SCHEMAS . 'interview-questions.query.json', $req->query);
        $page = Paginator::fromQuery($query, $app->settings($admin['organisation_id']));
        $field = isset($query['field']) ? (string) $query['field'] : null;
        $result = (new QuestionBank($app->pdo()))->list($admin['organisation_id'], $field, $page);

        return Response::json($result + ['fields' => array_column(
            (new InterviewService($app->pdo()))->fields($admin['organisation_id']),
            'field'
        )]);
    }

    /** @param array<string, string> $params */
    public static function createQuestion(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'interview.bank');
        /** @var array{field?: string, question?: string, tip?: string, active?: bool} $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'interview-question.json', $req->json());

        return Response::json((new QuestionBank($app->pdo()))->create($admin, $body), 201);
    }

    /** @param array<string, string> $params */
    public static function updateQuestion(Request $req, array $params, App $app): Response
    {
        $admin = self::user($req, $app, 'interview.bank');
        /** @var array{field?: string, question?: string, tip?: string, active?: bool} $body */
        $body = (new Validator())->validate(ProfileController::SCHEMAS . 'interview-question.json', $req->json());

        return Response::json((new QuestionBank($app->pdo()))->update($admin, (int) $params['id'], $body));
    }

    private static function coach(): ?Coach
    {
        return CoachFactory::fromEnv();
    }

    private static function now(App $app): string
    {
        return gmdate('Y-m-d H:i:s', $app->now());
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
