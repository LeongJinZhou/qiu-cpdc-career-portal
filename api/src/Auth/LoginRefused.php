<?php

declare(strict_types=1);

namespace Cpdc\Auth;

/** A login stopped for a reason that goes into login_log.result. Never shown to the user. */
final class LoginRefused extends \RuntimeException
{
    /**
     * @param string $result login_log result code (state_invalid, token_invalid, domain, ...)
     * @param string|null $email only from a verified ID token, else null
     */
    public function __construct(
        public readonly string $result,
        public readonly ?string $email = null,
        public readonly ?int $userId = null
    ) {
        parent::__construct('Login refused: ' . $result);
    }
}
