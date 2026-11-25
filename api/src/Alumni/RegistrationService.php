<?php

declare(strict_types=1);

namespace Cpdc\Alumni;

use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use PDO;

/**
 * "Register as a QIU graduate" for a LinkedIn account nobody holds (docs/SPEC.md rule 9, section 6): a pending
 * user waits for a CPDC admin. Approve matches an existing student row by matric number when there is one.
 *
 * @phpstan-import-type LinkedInIdentity from \Cpdc\Auth\LinkedInOidc
 */
final class RegistrationService
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @param LinkedInIdentity $identity from the LinkedIn sign-in that found no account
     * @param array{matric_no: string, programme: string, faculty?: string, graduation_year: int} $form
     */
    public function register(int $org, array $identity, array $form): void
    {
        Transaction::run($this->pdo, function () use ($org, $identity, $form): void {
            $held = $this->pdo->prepare(
                'SELECT 1 FROM linkedin_account WHERE organisation_id = ? AND linkedin_sub = ? FOR UPDATE'
            );
            $held->execute([$org, $identity['sub']]);
            if ($held->fetchColumn() !== false) {
                throw new ApiError(409, 'ALREADY_REGISTERED', 'This LinkedIn account is already registered.');
            }
            $name = $identity['name'] ?? 'QIU graduate';
            $this->pdo->prepare(
                "INSERT INTO `user` (organisation_id, display_name, picture_url, role) VALUES (?, ?, ?, 'pending')"
            )->execute([$org, $name, $identity['picture']]);
            $userId = (int) $this->pdo->lastInsertId();
            $this->pdo->prepare(
                'INSERT INTO linkedin_account (user_id, organisation_id, linkedin_sub, name, linked_at, updated_at)'
                . ' VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))'
            )->execute([$userId, $org, $identity['sub'], $identity['name']]);
            $this->pdo->prepare(
                'INSERT INTO career_profile (user_id, organisation_id, personal_email, programme, faculty,'
                . ' graduation_year) VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([$userId, $org, $identity['email'], $form['programme'], self::faculty($form),
                $form['graduation_year']]);
            $this->pdo->prepare(
                'INSERT INTO graduate_registration (organisation_id, user_id, matric_no, name, programme, faculty,'
                . ' graduation_year, matched_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([$org, $userId, strtoupper(trim($form['matric_no'])), $name, $form['programme'],
                self::faculty($form), $form['graduation_year'], $this->studentByMatric($org, $form['matric_no'])]);
        });
    }

    /**
     * @param array{id: int, organisation_id: int, ...} $admin
     * @return array{user_id: int, merged: bool}
     */
    public function approve(array $admin, int $registrationId, ?string $faculty): array
    {
        return Transaction::run($this->pdo, function () use ($admin, $registrationId, $faculty): array {
            $reg = $this->waiting($admin['organisation_id'], $registrationId);
            $pendingId = (int) $reg['user_id'];
            $faculty = $faculty !== null && trim($faculty) !== '' ? trim($faculty) : $reg['faculty'];
            $match = $reg['matched_user_id'] === null ? null : (int) $reg['matched_user_id'];
            if (
                $match !== null
                && !$this->stillMatches($admin['organisation_id'], $match, (string) $reg['matric_no'])
            ) {
                $match = null; // the student row changed since the registration: approve as a new alumnus
            }
            if ($match !== null) {
                $this->mergeInto($admin, $pendingId, $match, $faculty);
                $userId = $match;
            } else {
                $this->pdo->prepare(
                    "UPDATE `user` SET role = 'alumni', matric_no = ?, alumni_since = UTC_TIMESTAMP(3),"
                    . ' updated_at = UTC_TIMESTAMP(3) WHERE id = ?'
                )->execute([$this->freeMatric($admin['organisation_id'], (string) $reg['matric_no']), $pendingId]);
                $this->pdo->prepare('UPDATE career_profile SET faculty = ? WHERE user_id = ?')
                    ->execute([$faculty, $pendingId]);
                $userId = $pendingId;
            }
            $this->decide($admin, $registrationId, 'approved', $match ?? $pendingId);
            Audit::log($this->pdo, $admin, 'registration.approve', 'registration:' . $registrationId, [
                'user_id' => $userId, 'merged' => $match !== null,
            ]);

            return ['user_id' => $userId, 'merged' => $match !== null];
        });
    }

    /**
     * Refused: the pending user and its LinkedIn link are deleted, so that LinkedIn account is free again; the
     * registration row stays (user_id NULL) for the audit trail.
     *
     * @param array{id: int, organisation_id: int, ...} $admin
     */
    public function refuse(array $admin, int $registrationId): void
    {
        Transaction::run($this->pdo, function () use ($admin, $registrationId): void {
            $reg = $this->waiting($admin['organisation_id'], $registrationId);
            $this->decide($admin, $registrationId, 'refused', null);
            $this->pdo->prepare("DELETE FROM `user` WHERE id = ? AND role = 'pending'")->execute([$reg['user_id']]);
            Audit::log($this->pdo, $admin, 'registration.refuse', 'registration:' . $registrationId);
        });
    }

    /**
     * The student row keeps its own data; it gains the newly proven LinkedIn link (replacing an older one) and
     * becomes alumni. The pending user is deleted.
     *
     * @param array{id: int, organisation_id: int, ...} $admin
     */
    private function mergeInto(array $admin, int $pendingId, int $studentId, ?string $faculty): void
    {
        $this->pdo->prepare('DELETE FROM linkedin_account WHERE user_id = ?')->execute([$studentId]);
        $this->pdo->prepare('UPDATE linkedin_account SET user_id = ? WHERE user_id = ?')
            ->execute([$studentId, $pendingId]);
        $this->pdo->prepare(
            "UPDATE `user` SET role = 'alumni', alumni_since = COALESCE(alumni_since, UTC_TIMESTAMP(3)),"
            . ' updated_at = UTC_TIMESTAMP(3) WHERE id = ?'
        )->execute([$studentId]);
        $this->pdo->prepare('INSERT IGNORE INTO career_profile (user_id, organisation_id) VALUES (?, ?)')
            ->execute([$studentId, $admin['organisation_id']]);
        $this->pdo->prepare(
            'UPDATE career_profile s JOIN career_profile p ON p.user_id = ? SET'
            . ' s.faculty = COALESCE(?, s.faculty), s.graduation_year = COALESCE(s.graduation_year, p.graduation_year),'
            . ' s.programme = COALESCE(s.programme, p.programme),'
            . ' s.personal_email = COALESCE(s.personal_email, p.personal_email) WHERE s.user_id = ?'
        )->execute([$pendingId, $faculty, $studentId]);
        $this->pdo->prepare('UPDATE graduate_registration SET user_id = NULL WHERE user_id = ?')->execute([$pendingId]);
        $this->pdo->prepare("DELETE FROM `user` WHERE id = ? AND role = 'pending'")->execute([$pendingId]);
    }

    /** @return array<string, mixed> */
    private function waiting(int $org, int $id): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM graduate_registration WHERE id = ? AND organisation_id = ? AND status = 'waiting' FOR UPDATE"
        );
        $stmt->execute([$id, $org]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : throw new ApiError(404, 'NOT_FOUND', 'This registration is not waiting.');
    }

    /** @param array{id: int, organisation_id: int, ...} $admin */
    private function decide(array $admin, int $id, string $status, ?int $userId): void
    {
        $this->pdo->prepare(
            'UPDATE graduate_registration SET status = ?, user_id = ?, decided_by = ?, decided_at = UTC_TIMESTAMP(3)'
            . ' WHERE id = ?'
        )->execute([$status, $userId, $admin['id'], $id]);
    }

    private function studentByMatric(int $org, string $matric): ?int
    {
        $stmt = $this->pdo->prepare(
            "SELECT id FROM `user` WHERE organisation_id = ? AND matric_no = ? AND role IN ('student', 'alumni')"
        );
        $stmt->execute([$org, strtoupper(trim($matric))]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    private function stillMatches(int $org, int $userId, string $matric): bool
    {
        return $this->studentByMatric($org, $matric) === $userId;
    }

    /** The matric number when no other user holds it, else none (the unique key would refuse it). */
    private function freeMatric(int $org, string $matric): ?string
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM `user` WHERE organisation_id = ? AND matric_no = ?');
        $stmt->execute([$org, $matric]);

        return $stmt->fetchColumn() === false ? $matric : null;
    }

    /** @param array{faculty?: string} $form */
    private static function faculty(array $form): ?string
    {
        $faculty = trim($form['faculty'] ?? '');

        return $faculty === '' ? null : mb_substr($faculty, 0, 200);
    }
}
