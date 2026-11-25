<?php

declare(strict_types=1);

namespace Cpdc\Interview;

use Cpdc\Http\Router;

/** Routes of interview practice and the question bank (slice 3b). */
final class InterviewRoutes
{
    public static function add(Router $router): Router
    {
        $ai = ['name' => 'interview-ai', 'setting' => 'rate_ai_per_user_per_min', 'by' => 'user'];
        $start = ['name' => 'interview-start', 'setting' => 'rate_ai_per_user_per_min', 'by' => 'user'];

        return $router
            ->add('GET', '/api/interview/status', InterviewController::status(...))
            ->add('GET', '/api/interview/sessions', InterviewController::sessions(...))
            ->add('POST', '/api/interview/sessions', InterviewController::start(...), rate: $start)
            ->add('GET', '/api/interview/sessions/{id}', InterviewController::show(...))
            ->add(
                'POST',
                '/api/interview/sessions/{id}/items/{item}/answer',
                InterviewController::answer(...),
                rate: $ai
            )
            ->add('GET', '/api/interview/questions', InterviewController::questions(...))
            ->add('POST', '/api/interview/questions', InterviewController::createQuestion(...))
            ->add('PUT', '/api/interview/questions/{id}', InterviewController::updateQuestion(...));
    }
}
