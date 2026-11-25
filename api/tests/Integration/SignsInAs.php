<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

/** Signs in a fake Google persona with a given role, past onboarding (slice 3a tests). */
trait SignsInAs
{
    /** @return int the user id */
    protected function signInAs(string $persona, string $role): int
    {
        $this->jar = [];
        $this->signIn('google', $persona);
        $id = (int) $this->body($this->send('GET', '/api/me'))['user']['id'];
        $this->pdo->prepare('UPDATE `user` SET role = ?, onboarded_at = UTC_TIMESTAMP(3) WHERE id = ?')
            ->execute([$role, $id]);
        $this->refreshCsrf();

        return $id;
    }
}
