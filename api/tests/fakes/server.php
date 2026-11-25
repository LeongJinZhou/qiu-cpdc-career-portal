<?php

declare(strict_types=1);

// Run: php -S 127.0.0.1:8091 api/tests/fakes/server.php (npm run dev:fakes). Local and tests only.
require __DIR__ . '/../../vendor/autoload.php';

Cpdc\Env::load(dirname(__DIR__, 3) . '/.env');

$headers = [];
foreach ($_SERVER as $key => $value) {
    if (is_string($value) && str_starts_with((string) $key, 'HTTP_')) {
        $name = ucwords(strtolower(str_replace('_', '-', substr((string) $key, 5))), '-');
        $headers[$name] = $value;
    }
}
$handler = require __DIR__ . '/handler.php';
$result = $handler(
    (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'),
    (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH),
    $_GET,
    (string) file_get_contents('php://input'),
    $headers
);
http_response_code($result['status']);
foreach ($result['headers'] as $name => $value) {
    header($name . ': ' . $value);
}
echo $result['body'];
