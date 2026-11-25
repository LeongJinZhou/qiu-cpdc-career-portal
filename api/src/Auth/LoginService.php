<?php

declare(strict_types=1);

namespace Cpdc\Auth;

use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use PDO;

/**
 * Google sign-in: upsert of the signed-in user (docs/SPEC.md rules 1-3) and the login log.
 *
 * @phpstan-import-type Profile from DirectoryProfile
 * @phpstan-type Row array{id: int, google_sub: string|null, display_name: string, role: string, active: int,
 *     picture_url: string|null, employee_id: string|null, matric_no: string|null, employee_type: string|null,
 *     department: string|null, job_title: string|null}
 */
final class LoginService
{
    private const PROFILE_FIELDS = ['picture_url', 'employee_id', 'matric_no', 'employee_type', 'department',
        'job_title'];

    public function __construct(private readonly PDO $pdo, private readonly string $superadminEmail)
    {
    }

    /**
     * SUPERADMIN_EMAIL wins; a superadmin whose email no longer matches drops to admin; other stored roles are
     * kept; a new user is a student by directory employee type, else staff.
     *
     * @param list<mixed> $studentTypes setting student_employee_types
     */
    public static function decideRole(
        ?string $current,
        string $email,
        string $superadminEmail,
        ?string $employeeType,
        array $studentTypes
    ): string {
        if ($superadminEmail !== '' && strcasecmp($email, $superadminEmail) === 0) {
            return 'superadmin';
        }
        if ($current === 'superadmin') {
            return 'admin';
        }
        if ($current !== null) {
            return $current;
        }

        return in_array($employeeType, $studentTypes, true) ? 'student' : 'staff';
    }

    /**
     * Directory values overwrite stored ones only when non-empty.
     *
     * @param array<string, mixed> $stored
     * @param array<string, mixed> $directory
     * @return array<string, mixed>
     */
    public static function merge(array $stored, array $directory): array
    {
        $merged = [];
        foreach (array_keys($stored + $directory) as $field) {
            $new = $directory[$field] ?? null;
            $merged[$field] = $new !== null && $new !== '' ? $new : ($stored[$field] ?? null);
        }

        return $merged;
    }

    /**
     * A student's (or alumnus's) directory ID is the matric number; everyone else's the employee ID.
     *
     * @return array{employee_id: string|null, matric_no: string|null}
     */
    public static function directoryIds(string $role, ?string $externalId): array
    {
        $student = in_array($role, ['student', 'alumni'], true);

        return ['employee_id' => $student ? null : $externalId, 'matric_no' => $student ? $externalId : null];
    }

    /**
     * Finds the user by Google sub, else links the row with the same email and no sub, else inserts.
     *
     * @param array{sub: string, email: string, name: string|null} $claims verified ID token claims
     * @param Profile $profile
     * @param list<mixed> $studentTypes
     * @return array{id: int, organisation_id: int}
     */
    public function login(int $org, array $claims, array $profile, array $studentTypes): array
    {
        try {
            return $this->attempt($org, $claims, $profile, $studentTypes);
        } catch (\PDOException $e) {
            // Two first sign-ins at once: the loser hits a deadlock (40001) or a unique key (23000). Once more
            // finds the winner's row.
            if (!in_array($e->errorInfo[0] ?? null, ['40001', '23000'], true)) {
                throw $e;
            }

            return $this->attempt($org, $claims, $profile, $studentTypes);
        }
    }

    /**
     * @param array{sub: string, email: string, name: string|null} $claims
     * @param Profile $profile
     * @param list<mixed> $studentTypes
     * @return array{id: int, organisation_id: int}
     */
    private function attempt(int $org, array $claims, array $profile, array $studentTypes): array
    {
        return Transaction::run($this->pdo, fn (): array => $this->upsert($org, $claims, $profile, $studentTypes));
    }

    /**
     * @param array{sub: string, email: string, name: string|null} $claims
     * @param Profile $profile
     * @param list<mixed> $studentTypes
     * @return array{id: int, organisation_id: int}
     */
    private function upsert(int $org, array $claims, array $profile, array $studentTypes): array
    {
        $email = $claims['email'];
        $bySub = $this->find($org, 'google_sub', $claims['sub']);
        $byEmail = $this->find($org, 'email', $email);
        $taken = $byEmail !== null
            && ($bySub === null ? $byEmail['google_sub'] !== null : (int) $bySub['id'] !== (int) $byEmail['id']);
        if ($taken) {
            throw new LoginRefused('sub_mismatch', $email); // the email belongs to another Google account
        }
        $row = $bySub ?? $byEmail;
        $rowId = $row === null ? null : (int) $row['id'];
        if ($row !== null && ((int) $row['active'] !== 1 || $row['role'] === 'pending')) {
            throw new LoginRefused('inactive', $email, $rowId);
        }

        $role = self::decideRole(
            $row['role'] ?? null,
            $email,
            $this->superadminEmail,
            $profile['employee_type'],
            $studentTypes
        );
        $stored = [];
        foreach (self::PROFILE_FIELDS as $field) {
            $stored[$field] = $row[$field] ?? null;
        }
        $directory = self::directoryIds($role, $profile['external_id']) + array_intersect_key($profile, $stored);
        if ($stored['picture_url'] !== null) {
            unset($directory['picture_url']); // a photo is only filled in: a LinkedIn photo is never replaced
        }
        $merged = self::merge($stored, $directory);
        $clashes = $this->heldIds($org, $rowId ?? 0, $merged, $stored);
        foreach ($clashes as $column) {
            $merged[$column] = $stored[$column];
        }
        $name = $profile['display_name'] ?? $row['display_name'] ?? $claims['name'] ?? strstr($email, '@', true);
        $values = [
            'google_sub' => $claims['sub'],
            'email' => $email,
            'display_name' => mb_substr((string) $name, 0, 200),
            'role' => $role,
        ] + $merged;

        // Exactly one superadmin: demote the previous one first, so the unique guard never trips.
        $previous = $role === 'superadmin' ? $this->otherSuperadmin($org, $rowId ?? 0) : null;
        if ($previous !== null) {
            $this->pdo->prepare("UPDATE `user` SET role = 'admin', updated_at = UTC_TIMESTAMP(3) WHERE id = ?")
                ->execute([$previous]);
        }
        $id = $rowId === null ? $this->insert($org, $values) : $this->update($rowId, $values);
        if ($clashes !== []) { // the user id and the column names only, never a value
            error_log("login: directory IDs of user $id held by another user, stored values kept: "
                . implode(', ', $clashes));
        }
        $actor = ['id' => $id, 'organisation_id' => $org];
        $demoted = ['from' => 'superadmin', 'to' => 'admin'];
        if ($previous !== null) {
            Audit::log($this->pdo, $actor, 'superadmin.transfer', 'user:' . $previous, $demoted);
        }
        if (($row['role'] ?? null) === 'superadmin' && $role !== 'superadmin') {
            Audit::log($this->pdo, $actor, 'superadmin.demote', 'user:' . $id, $demoted);
        }

        return ['id' => $id, 'organisation_id' => $org];
    }

    /**
     * ID columns whose new value another user of the organisation already holds: never copied.
     *
     * @param array<string, mixed> $merged
     * @param array<string, mixed> $stored
     * @return list<string>
     */
    private function heldIds(int $org, int $userId, array $merged, array $stored): array
    {
        $held = [];
        foreach (['matric_no'] as $column) { // only matric_no is unique (SPEC section 6)
            $value = $merged[$column];
            if (!is_string($value) || $value === $stored[$column]) {
                continue;
            }
            $stmt = $this->pdo->prepare("SELECT 1 FROM `user` WHERE organisation_id = ? AND $column = ? AND id <> ?");
            $stmt->execute([$org, $value, $userId]);
            if ($stmt->fetchColumn() !== false) {
                $held[] = $column;
            }
        }

        return $held;
    }

    /**
     * One row per sign-in attempt. Only a verified email or LinkedIn id, never tokens or codes.
     *
     * @param 'google'|'linkedin' $provider
     */
    public static function log(
        PDO $pdo,
        int $org,
        ?int $userId,
        string $provider,
        ?string $email,
        string $result,
        string $ip,
        ?string $linkedinSub = null
    ): void {
        $packed = filter_var($ip, FILTER_VALIDATE_IP) === false ? "\0\0\0\0" : (string) inet_pton($ip);
        $pdo->prepare(
            'INSERT INTO login_log (organisation_id, user_id, provider, email, linkedin_sub, result, ip, created_at)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))'
        )->execute([
            $org,
            $userId,
            $provider,
            $email === null ? null : mb_substr($email, 0, 254),
            $linkedinSub === null ? null : mb_substr($linkedinSub, 0, 64),
            $result,
            $packed,
        ]);
        if ($userId !== null && $result === 'success') {
            $pdo->prepare('UPDATE `user` SET last_sign_in_at = UTC_TIMESTAMP(3) WHERE id = ?')->execute([$userId]);
        }
    }

    /**
     * @param 'email'|'google_sub' $column fixed in attempt(), never from input
     * @return Row|null
     */
    private function find(int $org, string $column, string $value): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, google_sub, display_name, role, active, ' . implode(', ', self::PROFILE_FIELDS)
            . " FROM `user` WHERE organisation_id = ? AND $column = ? FOR UPDATE"
        );
        $stmt->execute([$org, $value]);
        /** @var Row|false $row */
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    private function otherSuperadmin(int $org, int $exceptId): ?int
    {
        $stmt = $this->pdo->prepare(
            "SELECT id FROM `user` WHERE organisation_id = ? AND role = 'superadmin' AND id <> ? FOR UPDATE"
        );
        $stmt->execute([$org, $exceptId]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    /** @param array<string, mixed> $values column => value; column names are fixed in attempt() */
    private function insert(int $org, array $values): int
    {
        $columns = array_keys($values);
        $this->pdo->prepare(
            'INSERT INTO `user` (organisation_id, ' . implode(', ', $columns) . ') VALUES (?'
            . str_repeat(', ?', count($columns)) . ')'
        )->execute([$org, ...array_values($values)]);

        return (int) $this->pdo->lastInsertId();
    }

    /** @param array<string, mixed> $values column => value; column names are fixed in attempt() */
    private function update(int $id, array $values): int
    {
        $set = implode(', ', array_map(fn (string $c): string => "$c = ?", array_keys($values)));
        $this->pdo->prepare("UPDATE `user` SET $set, updated_at = UTC_TIMESTAMP(3) WHERE id = ?")
            ->execute([...array_values($values), $id]);

        return $id;
    }
}
