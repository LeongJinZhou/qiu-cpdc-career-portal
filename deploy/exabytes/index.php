<?php

declare(strict_types=1);

// Exabytes (cPanel) when public_html cannot point at api/public: this file sits in public_html and runs the app in
// ~/cpdc, above public_html, so .env, storage and the code are never served as files (docs/RELEASE.md section 4).
require dirname(__DIR__) . '/cpdc/api/public/index.php';
