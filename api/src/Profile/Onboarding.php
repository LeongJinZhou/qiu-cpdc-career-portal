<?php

declare(strict_types=1);

namespace Cpdc\Profile;

use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use PDO;

/**
 * The first-sign-in steps (docs/SPEC.md rules 4 and 6): LinkedIn linked by LinkedIn sign-in, the public profile
 * URL, the follow tick and consent. Until they are done only onboarding routes are open.
 */
final class Onboarding
{
    /**
     * Whether this user must still finish onboarding. The superadmin is never held back (they set the system up);
     * without LinkedIn configured nobody can link, so nobody is held back either.
     *
     * @param array{role: string, onboarded_at: string|null, ...} $user
     */
    public static function blocks(array $user, bool $linkedInConfigured): bool
    {
        return $linkedInConfigured && $user['role'] !== 'superadmin' && $user['onboarded_at'] === null;
    }

    /**
     * @param array{id: int, role: string, onboarded_at: string|null, ...} $user
     * @return array{required: bool, linkedin_linked: bool, profile_url: string|null, follow_confirmed: bool,
     *     consent_given: bool}
     */
    public static function state(PDO $pdo, array $user, bool $linkedInConfigured): array
    {
        $stmt = $pdo->prepare(
            'SELECT l.user_id IS NOT NULL AS linked, l.profile_url, l.follow_confirmed_at, u.consent_at'
            . ' FROM `user` u LEFT JOIN linkedin_account l ON l.user_id = u.id WHERE u.id = ?'
        );
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'required' => self::blocks($user, $linkedInConfigured),
            'linkedin_linked' => (bool) ($row['linked'] ?? false),
            'profile_url' => isset($row['profile_url']) ? (string) $row['profile_url'] : null,
            'follow_confirmed' => ($row['follow_confirmed_at'] ?? null) !== null,
            'consent_given' => ($row['consent_at'] ?? null) !== null,
        ];
    }

    /**
     * Finishes onboarding in one transaction. The LinkedIn account must already be linked by LinkedIn sign-in
     * (a pasted URL alone never counts).
     *
     * @param array{id: int, organisation_id: int, ...} $user
     */
    public static function complete(PDO $pdo, array $user, string $profileUrl, string $consentVersion): void
    {
        $url = LinkedInUrl::normalise($profileUrl) ?? throw ApiError::validation(
            'profile_url',
            'Enter your public LinkedIn profile link, like https://www.linkedin.com/in/your-name.'
        );
        Transaction::run($pdo, function () use ($pdo, $user, $url, $consentVersion): void {
            $stmt = $pdo->prepare('SELECT user_id FROM linkedin_account WHERE user_id = ? FOR UPDATE');
            $stmt->execute([$user['id']]);
            if ($stmt->fetchColumn() === false) {
                throw new ApiError(409, 'LINKEDIN_NOT_LINKED', 'Sign in with LinkedIn first to link your account.');
            }
            self::assertUrlFree($pdo, $user, $url);
            $pdo->prepare(
                'UPDATE linkedin_account SET profile_url = ?, follow_confirmed_at = COALESCE(follow_confirmed_at,'
                . ' UTC_TIMESTAMP(3)), updated_at = UTC_TIMESTAMP(3) WHERE user_id = ?'
            )->execute([$url, $user['id']]);
            $pdo->prepare(
                'UPDATE `user` SET consent_at = UTC_TIMESTAMP(3), consent_version = ?,'
                . ' onboarded_at = COALESCE(onboarded_at, UTC_TIMESTAMP(3)), updated_at = UTC_TIMESTAMP(3) WHERE id = ?'
            )->execute([$consentVersion, $user['id']]);
            Audit::log($pdo, $user, 'onboarding.complete', 'user:' . $user['id'], ['consent_version' => $consentVersion]);
        });
    }

    /**
     * Changes the public LinkedIn URL later (rule 12); old and new value go to the audit log.
     *
     * @param array{id: int, organisation_id: int, ...} $user
     */
    public static function changeUrl(PDO $pdo, array $user, string $profileUrl): string
    {
        $url = LinkedInUrl::normalise($profileUrl) ?? throw ApiError::validation(
            'profile_url',
            'Enter your public LinkedIn profile link, like https://www.linkedin.com/in/your-name.'
        );

        return Transaction::run($pdo, function () use ($pdo, $user, $url): string {
            $stmt = $pdo->prepare('SELECT profile_url FROM linkedin_account WHERE user_id = ? FOR UPDATE');
            $stmt->execute([$user['id']]);
            $old = $stmt->fetchColumn();
            if ($old === false) {
                throw new ApiError(409, 'LINKEDIN_NOT_LINKED', 'Sign in with LinkedIn first to link your account.');
            }
            if ($old !== $url) {
                self::assertUrlFree($pdo, $user, $url);
                $pdo->prepare('UPDATE linkedin_account SET profile_url = ?, updated_at = UTC_TIMESTAMP(3) WHERE user_id = ?')
                    ->execute([$url, $user['id']]);
                Audit::log($pdo, $user, 'linkedin.url_change', 'user:' . $user['id'], ['from' => $old, 'to' => $url]);
            }

            return $url;
        });
    }

    /**
     * Alumni confirm their job every alumni_job_confirm_days days (rule 11).
     *
     * @param array{id: int, role: string, ...} $user
     */
    public static function jobConfirmationDue(PDO $pdo, array $user, int $days, int $now): bool
    {
        if ($user['role'] !== 'alumni') {
            return false;
        }
        $stmt = $pdo->prepare('SELECT job_confirmed_at FROM career_profile WHERE user_id = ?');
        $stmt->execute([$user['id']]);
        $last = $stmt->fetchColumn();
        if (!is_string($last)) {
            return true;
        }

        return strtotime($last . ' UTC') < $now - $days * 86400;
    }

    /**
     * One public profile URL per person: another user's URL cannot be claimed.
     *
     * @param array{id: int, organisation_id: int, ...} $user
     */
    private static function assertUrlFree(PDO $pdo, array $user, string $url): void
    {
        $stmt = $pdo->prepare('SELECT 1 FROM linkedin_account WHERE organisation_id = ? AND profile_url = ? AND user_id <> ?');
        $stmt->execute([$user['organisation_id'], $url, $user['id']]);
        if ($stmt->fetchColumn() !== false) {
            throw new ApiError(409, 'LINKEDIN_URL_IN_USE', 'This LinkedIn profile is already linked to another person.');
        }
    }
}
