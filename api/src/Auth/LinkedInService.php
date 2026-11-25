<?php

declare(strict_types=1);

namespace Cpdc\Auth;

use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use PDO;

/**
 * LinkedIn link, alumni sign-in and the LinkedIn data copied into the profile (docs/SPEC.md rules 4, 5, 8, 12, 15).
 *
 * @phpstan-import-type LinkedInIdentity from LinkedInOidc
 */
final class LinkedInService
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * Links (or re-links) the signed-in user's LinkedIn. Refused when another user holds that LinkedIn account.
     *
     * @param array{id: int, organisation_id: int, ...} $user
     * @param LinkedInIdentity $identity
     */
    public function link(array $user, array $identity): void
    {
        Transaction::run($this->pdo, function () use ($user, $identity): void {
            $holder = $this->holder((int) $user['organisation_id'], $identity['sub']);
            if ($holder !== null && $holder !== (int) $user['id']) {
                throw new LoginRefused('linkedin_in_use', null, (int) $user['id']);
            }
            $stmt = $this->pdo->prepare('SELECT linkedin_sub FROM linkedin_account WHERE user_id = ? FOR UPDATE');
            $stmt->execute([$user['id']]);
            $previous = $stmt->fetchColumn();
            if ($previous === false) {
                $this->pdo->prepare(
                    'INSERT INTO linkedin_account (user_id, organisation_id, linkedin_sub, name, linked_at, updated_at)'
                    . ' VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))'
                )->execute([$user['id'], $user['organisation_id'], $identity['sub'], $identity['name']]);
                Audit::log($this->pdo, $user, 'linkedin.link', 'user:' . $user['id']);
            } else {
                $changed = $previous !== $identity['sub'];
                // A different LinkedIn account: its old profile URL belonged to the old account.
                $this->pdo->prepare(
                    'UPDATE linkedin_account SET linkedin_sub = ?, name = ?, updated_at = UTC_TIMESTAMP(3),'
                    . ' linked_at = IF(?, UTC_TIMESTAMP(3), linked_at), profile_url = IF(?, NULL, profile_url)'
                    . ' WHERE user_id = ?'
                )->execute([$identity['sub'], $identity['name'], (int) $changed, (int) $changed, $user['id']]);
                if ($changed) {
                    Audit::log($this->pdo, $user, 'linkedin.relink', 'user:' . $user['id'], ['account' => 'changed']);
                }
            }
            $this->copyIdentity($user, $identity);
        });
    }

    /**
     * LinkedIn sign-in: only for an active alumni account holding this LinkedIn (rule 8).
     *
     * @param LinkedInIdentity $identity
     * @return array{id: int, organisation_id: int}
     */
    public function signIn(int $org, array $identity): array
    {
        return Transaction::run($this->pdo, function () use ($org, $identity): array {
            $stmt = $this->pdo->prepare(
                'SELECT u.id, u.role, u.active FROM linkedin_account l JOIN `user` u ON u.id = l.user_id'
                . ' WHERE l.organisation_id = ? AND l.linkedin_sub = ? FOR UPDATE'
            );
            $stmt->execute([$org, $identity['sub']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                throw new LoginRefused('linkedin_not_linked');
            }
            $id = (int) $row['id'];
            if ((int) $row['active'] !== 1) {
                throw new LoginRefused('inactive', null, $id);
            }
            if ($row['role'] === 'pending') {
                throw new LoginRefused('registration_waiting', null, $id);
            }
            if ($row['role'] !== 'alumni') {
                throw new LoginRefused('linkedin_not_alumni', null, $id);
            }
            $user = ['id' => $id, 'organisation_id' => $org];
            $this->pdo->prepare(
                'UPDATE linkedin_account SET name = COALESCE(?, name), last_sign_in_at = UTC_TIMESTAMP(3),'
                . ' updated_at = UTC_TIMESTAMP(3) WHERE user_id = ?'
            )->execute([$identity['name'], $id]);
            $this->copyIdentity($user, $identity);

            return $user;
        });
    }

    /** The user id holding this LinkedIn account, or null. */
    public function holder(int $org, string $sub): ?int
    {
        $stmt = $this->pdo->prepare(
            'SELECT user_id FROM linkedin_account WHERE organisation_id = ? AND linkedin_sub = ? FOR UPDATE'
        );
        $stmt->execute([$org, $sub]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    /**
     * LinkedIn's photo replaces the stored one; LinkedIn's verified personal email fills an empty personal email.
     *
     * @param array{id: int, organisation_id: int, ...} $user
     * @param LinkedInIdentity $identity
     */
    private function copyIdentity(array $user, array $identity): void
    {
        if ($identity['picture'] !== null) {
            $this->pdo->prepare('UPDATE `user` SET picture_url = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?')
                ->execute([$identity['picture'], $user['id']]);
        }
        $this->pdo->prepare(
            'INSERT INTO career_profile (user_id, organisation_id, personal_email) VALUES (?, ?, ?)'
            . ' ON DUPLICATE KEY UPDATE personal_email = COALESCE(personal_email, VALUES(personal_email))'
        )->execute([$user['id'], $user['organisation_id'], $identity['email']]);
    }
}
