<?php

declare(strict_types=1);

namespace Cpdc\Network;

use Cpdc\Http\Router;

/** Routes of the alumni network and mentoring (slice 3b). */
final class NetworkRoutes
{
    public static function add(Router $router): Router
    {
        $ask = [
            'name' => 'mentor-request',
            'setting' => 'rate_mentor_request_per_user_per_hour',
            'by' => 'user',
            'window' => 3600,
        ];

        return $router
            ->add('GET', '/api/network/directory', NetworkController::directory(...))
            ->add('GET', '/api/network/me', NetworkController::showOwn(...))
            ->add('PUT', '/api/network/me', NetworkController::saveOwn(...))
            ->add('PUT', '/api/network/mentoring', NetworkController::saveOffer(...))
            ->add('POST', '/api/network/mentors/{id}/requests', NetworkController::ask(...), rate: $ask)
            ->add('GET', '/api/network/requests', NetworkController::requests(...))
            ->add('POST', '/api/network/requests/{id}/accept', NetworkController::accept(...))
            ->add('POST', '/api/network/requests/{id}/decline', NetworkController::decline(...))
            ->add('POST', '/api/network/requests/{id}/withdraw', NetworkController::withdraw(...))
            ->add('GET', '/api/network/activity', NetworkController::activity(...));
    }
}
