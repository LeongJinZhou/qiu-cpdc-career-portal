<?php

declare(strict_types=1);

namespace Cpdc\Logbook;

use Cpdc\Assessment\AssessmentController;
use Cpdc\Http\Middleware\RateLimit;
use Cpdc\Http\Router;
use Cpdc\Showcase\ShowcaseController;

/** Routes of slice 2a: internship logbook, FYP showcase and talent feed, self-assessments. Added by App::routes. */
final class Slice2aRoutes
{
    public static function add(Router $router): Router
    {
        $review = ['name' => 'logbook-review', 'setting' => 'rate_review_link_per_ip_per_min', 'by' => 'ip'];
        $send = ['name' => 'logbook-send', 'setting' => 'rate_logbook_send_per_user_per_hour', 'by' => 'user',
            'window' => RateLimit::HOUR];
        $image = ['name' => 'showcase-image', 'setting' => 'rate_showcase_image_per_user_per_min', 'by' => 'user'];

        return $router
            ->add('GET', '/api/logbook', LogbookController::mine(...))
            ->add('PUT', '/api/logbook/internship', LogbookController::saveInternship(...))
            ->add('POST', '/api/logbook/entries', LogbookController::createEntry(...))
            ->add('PUT', '/api/logbook/entries/{id}', LogbookController::updateEntry(...))
            ->add('POST', '/api/logbook/entries/{id}/submit', LogbookController::submit(...), rate: $send)
            ->add('POST', '/api/logbook/entries/{id}/resend', LogbookController::resend(...), rate: $send)
            ->add('GET', '/api/logbook/review/{token}', LogbookController::review(...), true, $review)
            ->add('POST', '/api/logbook/review/{token}', LogbookController::decide(...), true, $review)
            ->add('GET', '/api/logbook/students', LogbookController::students(...))
            ->add('GET', '/api/logbook/students/{id}', LogbookController::student(...))
            ->add('GET', '/api/showcase/mine', ShowcaseController::mine(...))
            ->add('PUT', '/api/showcase/mine', ShowcaseController::save(...))
            ->add('POST', '/api/showcase/mine/image', ShowcaseController::uploadImage(...), rate: $image)
            ->add('DELETE', '/api/showcase/mine/image', ShowcaseController::removeImage(...))
            ->add('GET', '/api/showcase', ShowcaseController::feed(...))
            ->add('GET', '/api/showcase/filters', ShowcaseController::filters(...))
            ->add('GET', '/api/showcase/{id}', ShowcaseController::show(...))
            ->add('GET', '/api/showcase/{id}/image', ShowcaseController::image(...))
            ->add('GET', '/api/assessments/manage', AssessmentController::manageList(...))
            ->add('POST', '/api/assessments/manage', AssessmentController::create(...))
            ->add('GET', '/api/assessments/manage/{id}', AssessmentController::manageGet(...))
            ->add('PUT', '/api/assessments/manage/{id}', AssessmentController::replace(...))
            ->add('PATCH', '/api/assessments/manage/{id}/status', AssessmentController::status(...))
            ->add('GET', '/api/assessments', AssessmentController::available(...))
            ->add('GET', '/api/assessments/results', AssessmentController::myResults(...))
            ->add('GET', '/api/assessments/{id}', AssessmentController::show(...))
            ->add('POST', '/api/assessments/{id}/attempts', AssessmentController::attempt(...));
    }
}
