<?php

declare(strict_types=1);

use Firebase\JWT\JWT;

// Fake Google (OIDC + People) and fake LinkedIn (OpenID Connect sign-in), for tests and local dev only.
// Never deployed. State (RSA key, issued codes) lives in storage/fake-idp/ (git-ignored); the key is made at first use.
$handler =
/**
 * @param array<mixed> $query
 * @param array<string, string> $headers
 * @return array{status: int, body: string, headers: array<string, string>}
 */
static function (
    string $method,
    string $path,
    array $query = [],
    string $body = '',
    array $headers = []
): array {
    $json = static fn (int $status, mixed $data, array $extra = []): array => [
        'status' => $status,
        'body' => json_encode($data, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
        'headers' => ['Content-Type' => 'application/json'] + $extra,
    ];
    $oauthError = static fn (string $error): array => $json(400, ['error' => $error]);
    $str = static fn (mixed $v): string => is_string($v) ? $v : '';
    $b64 = static fn (string $raw): string => rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    $e = static fn (string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $bearer = static function (array $headers, string $prefix): string {
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        return preg_match('/^Bearer ' . preg_quote($prefix, '/') . '\.([a-z-]+)\.[a-f0-9]+$/D', $auth, $m) === 1
            ? $m[1] : '';
    };
    $chooser = static function (string $title, array $names, array $query, string $authorizePath) use ($e): array {
        $items = '';
        foreach ($names as $name => $label) {
            $href = $authorizePath . '?' . http_build_query(['persona' => $name] + $query);
            $items .= '<li><a href="' . $e($href) . '">' . $e($label . ' (' . $name . ')') . '</a></li>';
        }

        return [
            'status' => 200,
            'body' => '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' . $e($title)
                . '</title></head><body><h1>' . $e($title) . '</h1><ul>' . $items . '</ul></body></html>',
            'headers' => ['Content-Type' => 'text/html; charset=utf-8'],
        ];
    };

    if ($path === '/google/health') {
        return $json(200, ['status' => 'ok']);
    }

    $dir = dirname(__DIR__, 3) . '/storage/fake-idp';
    if (!is_dir($dir . '/codes')) {
        @mkdir($dir . '/codes', 0700, true);
    }
    $saveCode = static function (array $grant) use ($dir): string {
        $code = bin2hex(random_bytes(16));
        file_put_contents($dir . "/codes/$code.json", json_encode($grant, JSON_THROW_ON_ERROR));

        return $code;
    };
    /** @return array<mixed>|null the grant, used once */
    $takeCode = static function (string $code) use ($dir): ?array {
        $file = $dir . "/codes/$code.json";
        if (preg_match('/^[a-f0-9]{32}$/D', $code) !== 1 || !is_file($file)) {
            return null;
        }
        $grant = json_decode((string) file_get_contents($file), true, 8, JSON_THROW_ON_ERROR);

        return @unlink($file) && is_array($grant) ? $grant : null; // a parallel request may have used it
    };

    // ---------------------------------------------------------------- LinkedIn (OpenID Connect sign-in)
    // sub, name, email, email_verified, picture. "nolink" is a LinkedIn account no portal user holds.
    $linkedin = [
        'student' => ['li-sub-student', 'Fake Student', 'fake.student@gmail.example', true,
            'https://media.licdn.com/dms/image/fake-student'],
        'staff' => ['li-sub-staff', 'Fake Staff', 'fake.staff@gmail.example', true, null],
        'alumni' => ['li-sub-alumni', 'Fake Alumna', 'fake.alumna@gmail.example', true,
            'https://media.licdn.com/dms/image/fake-alumna'],
        'nolink' => ['li-sub-nolink', 'Fake Old Graduate', 'old.graduate@gmail.example', true, null],
        'qiumail' => ['li-sub-qiumail', 'Fake Qiu Mail', 'someone@qiu.edu.my', true, null],
        'unverified' => ['li-sub-unverified', 'Fake Unverified', 'unverified@gmail.example', false, null],
    ];
    $liClient = (string) getenv('LINKEDIN_CLIENT_ID');
    $liSecret = (string) getenv('LINKEDIN_CLIENT_SECRET');

    if ($method === 'GET' && $path === '/linkedin/oauth/v2/authorization') {
        $ok = $str($query['response_type'] ?? null) === 'code' && $str($query['client_id'] ?? null) === $liClient
            && $str($query['redirect_uri'] ?? null) !== '' && $str($query['state'] ?? null) !== ''
            && $str($query['scope'] ?? null) === 'openid profile email';
        if (!$ok) {
            return $oauthError('invalid_request');
        }
        $persona = $str($query['persona'] ?? null);
        if ($persona === '') {
            return $chooser('Fake LinkedIn sign-in', array_map(fn (array $p) => $p[1], $linkedin), $query, $path);
        }
        if ($persona === 'cancel') {
            return ['status' => 302, 'body' => '', 'headers' => ['Location' => $query['redirect_uri'] . '?'
                . http_build_query(['error' => 'user_cancelled_login', 'state' => $query['state']])]];
        }
        if (!isset($linkedin[$persona])) {
            return $oauthError('invalid_request');
        }
        $code = $saveCode(['idp' => 'linkedin', 'persona' => $persona, 'redirect_uri' => $query['redirect_uri']]);

        return ['status' => 302, 'body' => '', 'headers' => ['Location' => $query['redirect_uri'] . '?'
            . http_build_query(['code' => $code, 'state' => $query['state']])]];
    }

    if ($method === 'POST' && $path === '/linkedin/oauth/v2/accessToken') {
        parse_str($body, $form);
        $grant = $takeCode($str($form['code'] ?? null));
        $valid = $grant !== null && ($grant['idp'] ?? null) === 'linkedin'
            && $str($form['grant_type'] ?? null) === 'authorization_code'
            && $str($form['client_id'] ?? null) === $liClient && $str($form['client_secret'] ?? null) === $liSecret
            && $str($form['redirect_uri'] ?? null) === $grant['redirect_uri'];
        if (!$valid) {
            return $json(400, ['error' => 'invalid_request', 'error_description' => 'Unable to retrieve token']);
        }

        return $json(200, ['access_token' => 'fake-li.' . $grant['persona'] . '.' . bin2hex(random_bytes(8)),
            'expires_in' => 5183999, 'scope' => 'email,openid,profile', 'token_type' => 'Bearer']);
    }

    if ($method === 'GET' && $path === '/linkedin-api/v2/userinfo') {
        $persona = $bearer($headers, 'fake-li');
        if (!isset($linkedin[$persona])) {
            return $json(401, ['status' => 401, 'message' => 'Invalid access token']);
        }
        $p = $linkedin[$persona];
        [$given, $family] = explode(' ', $p[1], 2); // every fake name has two words

        return $json(200, array_filter([
            'sub' => $p[0], 'name' => $p[1], 'given_name' => $given, 'family_name' => $family,
            'email' => $p[2], 'email_verified' => $p[3], 'picture' => $p[4], 'locale' => ['country' => 'MY',
                'language' => 'en'],
        ], static fn ($v) => $v !== null));
    }

    // ---------------------------------------------------------------- Google (OIDC + People API)
    $base = rtrim((string) (getenv('GOOGLE_OIDC_BASE') ?: 'http://127.0.0.1:8091/google'), '/');
    $clientId = (string) getenv('GOOGLE_CLIENT_ID');

    $keyFile = $dir . '/key.pem';
    if (!is_file($keyFile)) {
        $cnf = $dir . '/openssl.cnf'; // Windows PHP builds ship without a default openssl.cnf
        file_put_contents($cnf, "[req]\ndistinguished_name=dn\n[dn]\n");
        $opts = ['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA, 'config' => $cnf];
        $res = openssl_pkey_new($opts) ?: throw new RuntimeException('fake Google: RSA key generation failed');
        openssl_pkey_export($res, $pem, null, ['config' => $cnf]);
        $tmp = $keyFile . '.' . bin2hex(random_bytes(4));
        file_put_contents($tmp, $pem);
        rename($tmp, $keyFile); // atomic: parallel first requests never see a half-written key
    }
    $pem = (string) file_get_contents($keyFile);
    $private = openssl_pkey_get_private($pem) ?: throw new RuntimeException('fake Google: bad key');
    $rsa = (openssl_pkey_get_details($private) ?: [])['rsa'];
    $kid = substr(hash('sha256', $rsa['n']), 0, 16);

    $superadmin = strtolower((string) (getenv('SUPERADMIN_EMAIL') ?: 'superadmin@example.test'));
    // sub, email, email_verified, hd, name, directory ID, employee type, department, title
    $personas = [
        'student' => ['g-sub-student', 'student@example.test', true, 'example.test', 'Fake Student',
            'FAKE-S-0001', 'Student', 'Faculty of Fake Studies', 'Bachelor of Fake Studies'],
        'student-b' => ['g-sub-student-b', 'other.student@example.test', true, 'example.test', 'Fake Other Student',
            'FAKE-S-0002', 'Student', 'Faculty of Other Studies', 'Bachelor of Other Studies'],
        'graduate' => ['g-sub-graduate', 'graduate@example.test', true, 'example.test', 'Fake Graduate',
            'FAKE-S-0003', 'Student', 'Faculty of Fake Studies', 'Bachelor of Fake Studies'],
        'staff' => ['g-sub-staff', 'staff@example.test', true, 'example.test', 'Fake Staff',
            'FAKE-E-0100', 'Staff', 'Faculty of Fake Studies', 'Lecturer'],
        'admin' => ['g-sub-admin', 'admin@example.test', true, 'example.test', 'Fake CPDC Officer',
            'FAKE-E-0002', 'Staff', 'CPDC', 'Career Officer'],
        'superadmin' => ['g-sub-superadmin', $superadmin, true, substr((string) strrchr($superadmin, '@'), 1),
            'Fake Superadmin', 'FAKE-E-0001', 'Staff', 'CPDC', 'Director'],
        'offdomain' => ['g-sub-offdomain', 'outsider@elsewhere.test', true, 'elsewhere.test', 'Fake Outsider',
            'X-1', 'Student', 'Elsewhere', 'Student'],
        'unverified' => ['g-sub-unverified', 'unverified@example.test', false, 'example.test', 'Fake Unverified',
            'FAKE-S-0009', 'Student', 'Faculty of Fake Studies', 'Student'],
        'nohd' => ['g-sub-nohd', 'nohd@example.test', true, null, 'Fake No Hd',
            'FAKE-S-0008', 'Student', 'Faculty of Fake Studies', 'Student'],
    ];

    if ($method === 'GET' && $path === '/google/.well-known/openid-configuration') {
        return $json(200, [
            'issuer' => $base,
            'authorization_endpoint' => $base . '/authorize',
            'token_endpoint' => $base . '/token',
            'jwks_uri' => $base . '/jwks',
            'id_token_signing_alg_values_supported' => ['RS256'],
        ], ['Cache-Control' => 'public, max-age=3600']);
    }

    if ($method === 'GET' && $path === '/google/jwks') {
        return $json(200, ['keys' => [[
            'kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'kid' => $kid,
            'n' => $b64($rsa['n']), 'e' => $b64($rsa['e']),
        ]]], ['Cache-Control' => 'public, max-age=3600']);
    }

    if ($method === 'GET' && $path === '/google/authorize') {
        $ok = $str($query['response_type'] ?? null) === 'code' && $str($query['client_id'] ?? null) === $clientId
            && $str($query['code_challenge_method'] ?? null) === 'S256'
            && $str($query['code_challenge'] ?? null) !== ''
            && $str($query['redirect_uri'] ?? null) !== '';
        if (!$ok) {
            return $oauthError('invalid_request');
        }
        $persona = $str($query['persona'] ?? null);
        if ($persona === '') {
            return $chooser('Fake Google sign-in', array_map(fn (array $p) => $p[4], $personas), $query, $path);
        }
        if (!isset($personas[$persona])) {
            return $oauthError('invalid_request');
        }
        $code = $saveCode([
            'idp' => 'google',
            'persona' => $persona,
            'redirect_uri' => $query['redirect_uri'],
            'nonce' => $str($query['nonce'] ?? null),
            'challenge' => $query['code_challenge'],
        ]);
        $back = http_build_query(['state' => $str($query['state'] ?? null), 'code' => $code,
            'scope' => $str($query['scope'] ?? null), 'authuser' => '0', 'prompt' => 'consent']);

        return ['status' => 302, 'body' => '', 'headers' => ['Location' => $query['redirect_uri'] . '?' . $back]];
    }

    if ($method === 'POST' && $path === '/google/token') {
        parse_str($body, $form);
        $grant = $takeCode($str($form['code'] ?? null));
        $valid = $grant !== null && ($grant['idp'] ?? null) === 'google'
            && $str($form['grant_type'] ?? null) === 'authorization_code'
            && $str($form['client_id'] ?? null) === $clientId
            && $str($form['client_secret'] ?? null) === (string) getenv('GOOGLE_CLIENT_SECRET')
            && $str($form['redirect_uri'] ?? null) === $grant['redirect_uri']
            && hash_equals($grant['challenge'], $b64(hash('sha256', $str($form['code_verifier'] ?? null), true)));
        if (!$valid) {
            return $oauthError('invalid_grant');
        }
        $p = $personas[$grant['persona']];
        $now = time();
        $claims = [
            'iss' => $base, 'aud' => $clientId, 'sub' => $p[0], 'email' => $p[1], 'email_verified' => $p[2],
            'hd' => $p[3], 'name' => $p[4], 'nonce' => $grant['nonce'], 'iat' => $now, 'exp' => $now + 3600,
        ];
        if ($p[3] === null) {
            unset($claims['hd']);
        }

        return $json(200, [
            'access_token' => 'fake-at.' . $grant['persona'] . '.' . bin2hex(random_bytes(8)),
            'id_token' => JWT::encode($claims, $pem, 'RS256', $kid),
            'token_type' => 'Bearer',
            'expires_in' => 3599,
            'scope' => 'openid email profile',
        ]);
    }

    if ($method === 'GET' && $path === '/google/v1/people/me') {
        $persona = $bearer($headers, 'fake-at');
        if (!isset($personas[$persona])) {
            return $json(401, ['error' => ['code' => 401, 'status' => 'UNAUTHENTICATED']]);
        }
        $p = $personas[$persona];
        $primary = ['metadata' => ['primary' => true]];
        $person = [
            'resourceName' => 'people/' . $p[0],
            'names' => [$primary + ['displayName' => $p[4]]],
            'emailAddresses' => [$primary + ['value' => $p[1]]],
            'organizations' => [$primary + ['department' => $p[7], 'title' => $p[8], 'jobDescription' => $p[6]]],
            // Deliberately present: the app must never store these.
            'phoneNumbers' => [['value' => '+60 3-0000 0000', 'type' => 'work']],
        ];
        if ($persona === 'student') {
            $person['photos'] = [$primary + ['url' => 'https://lh3.googleusercontent.com/a/fake-student-photo']];
        }

        return $json(200, $person);
    }

    // The Workspace directory (domain profile): the admin-set ID and organisation.
    if ($method === 'GET' && $path === '/google/v1/people:searchDirectoryPeople') {
        if (!isset($personas[$bearer($headers, 'fake-at')])) {
            return $json(401, ['error' => ['code' => 401, 'status' => 'UNAUTHENTICATED']]);
        }
        $q = strtolower($str($query['query'] ?? null));
        $people = [];
        foreach ($personas as $p) {
            if ($q === '' || !str_contains(strtolower($p[1]), $q) || $p[3] === null) {
                continue;
            }
            $people[] = [
                'resourceName' => 'people/' . $p[0],
                'emailAddresses' => [['value' => $p[1]]],
                'organizations' => [['department' => $p[7], 'title' => $p[8], 'jobDescription' => $p[6]]],
                'externalIds' => [['value' => $p[5], 'type' => 'organization']],
            ];
        }

        return $json(200, $people === [] ? new stdClass() : ['people' => $people]);
    }

    return $json(404, ['error' => ['code' => 'NOT_FOUND', 'message' => 'Not found.']]);
};

return $handler;
