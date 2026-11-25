<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

/**
 * Several signed-in people in one test: each persona keeps its own cookie jar and CSRF token, like separate
 * browsers. People are signed in with the fake Google, then given their role, onboarding and LinkedIn directly.
 */
abstract class SliceThreeBTestCase extends HttpTestCase
{
    /** @var array<string, array{jar: array<string, string>, csrf: string, id: int}> */
    private array $people = [];
    private ?string $current = null;

    /** @return int user id */
    protected function person(string $persona, string $role): int
    {
        $this->park();
        $this->jar = [];
        $this->csrf = '';
        $this->signIn('google', $persona);
        $stmt = $this->pdo->prepare('SELECT id FROM `user` WHERE google_sub = ?');
        $stmt->execute(['g-sub-' . $persona]);
        $id = (int) $stmt->fetchColumn();
        $this->pdo->prepare('UPDATE `user` SET role = ?, onboarded_at = UTC_TIMESTAMP(3) WHERE id = ?')
            ->execute([$role, $id]);
        $this->pdo->prepare(
            'INSERT IGNORE INTO linkedin_account (user_id, organisation_id, linkedin_sub, name, profile_url, linked_at)'
            . ' VALUES (?, 1, ?, ?, ?, UTC_TIMESTAMP(3))'
        )->execute([$id, 'li-test-' . $persona, $persona, 'https://www.linkedin.com/in/fake-' . $persona]);
        $this->refreshCsrf();
        $this->people[$persona] = ['jar' => $this->jar, 'csrf' => $this->csrf, 'id' => $id];
        $this->current = $persona;

        return $id;
    }

    /** Switches to a persona signed in earlier with person(). */
    protected function as(string $persona): void
    {
        $this->park();
        $this->jar = $this->people[$persona]['jar'];
        $this->csrf = $this->people[$persona]['csrf'];
        $this->current = $persona;
    }

    protected function setting(string $key, string $json): void
    {
        $this->pdo->prepare('UPDATE setting SET value = ? WHERE setting_key = ? AND organisation_id = 1')
            ->execute([$json, $key]);
    }

    /** Keeps the current persona's cookies (the session may have rotated them). */
    private function park(): void
    {
        if ($this->current !== null) {
            $id = $this->people[$this->current]['id'];
            $this->people[$this->current] = ['jar' => $this->jar, 'csrf' => $this->csrf, 'id' => $id];
        }
    }
}
