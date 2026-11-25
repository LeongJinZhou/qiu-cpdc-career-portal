<?php

declare(strict_types=1);

namespace Cpdc\Learning;

use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use Cpdc\Http\Paginator;
use PDO;

/**
 * Courses and certificates a person logs, with a link or a PDF proof, and CPDC's verification. A verified record
 * is locked: the person can no longer delete it.
 *
 * @phpstan-type User array{id: int, organisation_id: int, role: string, ...}
 */
final class LearningService
{
    private const COLUMNS = 'r.id, r.kind, r.name, r.provider, r.completed_on, r.link_url, r.proof_name,'
        . ' (r.proof_file IS NOT NULL) AS has_proof, r.status, r.review_note, r.reviewed_at, r.created_at';

    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @return list<array<string, mixed>> the person's own records, newest completion first */
    public function mine(int $org, int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM learning_record r WHERE r.user_id = ? AND r.organisation_id = ?'
            . ' ORDER BY r.completed_on DESC, r.id DESC LIMIT 500'
        );
        $stmt->execute([$userId, $org]);

        return array_values(array_map(self::record(...), $stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    /**
     * @param User $user
     * @param array{kind: string, name: string, provider: string, completed_on: string, link_url: string|null} $data
     * @param array{key: string, name: string, size: int}|null $proof an already stored PDF; the caller deletes it
     *     if this throws
     */
    public function add(array $user, array $data, ?array $proof): int
    {
        if ($data['link_url'] === null && $proof === null) {
            throw ApiError::validation('link_url', 'Add a link or a PDF as proof.');
        }
        $this->pdo->prepare(
            'INSERT INTO learning_record (organisation_id, user_id, kind, name, provider, completed_on, link_url,'
            . ' proof_file, proof_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $user['organisation_id'], $user['id'], $data['kind'], $data['name'], $data['provider'],
            $data['completed_on'], $data['link_url'], $proof['key'] ?? null, $proof['name'] ?? null,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Deletes the person's own record unless CPDC verified it.
     *
     * @param User $user
     * @return string|null the stored proof key, for the caller to remove after the commit
     */
    public function delete(array $user, int $id): ?string
    {
        return Transaction::run($this->pdo, function () use ($user, $id): ?string {
            $stmt = $this->pdo->prepare(
                'SELECT status, proof_file FROM learning_record WHERE id = ? AND user_id = ? AND organisation_id = ?'
                . ' FOR UPDATE'
            );
            $stmt->execute([$id, $user['id'], $user['organisation_id']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                throw new ApiError(404, 'NOT_FOUND', 'Not found.');
            }
            if ($row['status'] === 'verified') {
                throw new ApiError(409, 'VERIFIED', 'CPDC has verified this record, so it stays on your profile.');
            }
            $this->pdo->prepare('DELETE FROM learning_record WHERE id = ?')->execute([$id]);

            return $row['proof_file'];
        });
    }

    /**
     * A record's proof file: the owner's own, or any in the organisation when $anyOwner (CPDC).
     *
     * @return array{proof_file: string|null, proof_name: string|null}
     */
    public function proof(int $org, int $userId, int $id, bool $anyOwner): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT proof_file, proof_name FROM learning_record WHERE id = ? AND organisation_id = ?'
            . ' AND (? OR user_id = ?)'
        );
        $stmt->execute([$id, $org, (int) $anyOwner, $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row) || $row['proof_file'] === null) {
            throw new ApiError(404, 'NOT_FOUND', 'Not found.');
        }

        return ['proof_file' => $row['proof_file'], 'proof_name' => $row['proof_name']];
    }

    /** @return array{items: list<mixed>, page: int, per_page: int, total: int} */
    public function review(int $org, ?string $status, string $q, Paginator $page): array
    {
        $where = 'r.organisation_id = ?';
        $args = [$org];
        if ($status !== null) {
            $where .= ' AND r.status = ?';
            $args[] = $status;
        }
        if ($q !== '') {
            $like = '%' . addcslashes($q, '%_\\') . '%';
            $where .= ' AND (u.display_name LIKE ? OR u.matric_no LIKE ? OR r.name LIKE ? OR r.provider LIKE ?)';
            array_push($args, $like, $like, $like, $like);
        }
        $from = ' FROM learning_record r JOIN `user` u ON u.id = r.user_id';
        $count = $this->pdo->prepare("SELECT COUNT(*) $from WHERE $where");
        $count->execute($args);
        $stmt = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ', u.id AS user_id, u.display_name, u.picture_url, u.matric_no,'
            . ' l.profile_url AS linkedin_url' . $from . ' LEFT JOIN linkedin_account l ON l.user_id = u.id'
            . " WHERE $where ORDER BY r.created_at, r.id LIMIT " . $page->perPage . ' OFFSET ' . $page->offset()
        );
        $stmt->execute($args);
        $items = array_values(array_map(static fn (array $r): array => self::record($r) + [
            'user_id' => (int) $r['user_id'],
            'display_name' => (string) $r['display_name'],
            'picture_url' => $r['picture_url'],
            'matric_no' => $r['matric_no'],
            'linkedin_url' => $r['linkedin_url'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)));

        return $page->envelope($items, (int) $count->fetchColumn());
    }

    /**
     * CPDC verifies or rejects a record. A rejection needs a note that tells the person why. Nobody decides on
     * their own record.
     *
     * @param User $actor
     */
    public function decide(array $actor, int $id, string $decision, string $note): void
    {
        if ($decision === 'rejected' && $note === '') {
            throw ApiError::validation('note', 'Say why, so the person can fix it.');
        }
        Transaction::run($this->pdo, function () use ($actor, $id, $decision, $note): void {
            $stmt = $this->pdo->prepare(
                'SELECT user_id, status FROM learning_record WHERE id = ? AND organisation_id = ? FOR UPDATE'
            );
            $stmt->execute([$id, $actor['organisation_id']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                throw new ApiError(404, 'NOT_FOUND', 'Not found.');
            }
            if ((int) $row['user_id'] === $actor['id']) {
                throw new ApiError(403, 'FORBIDDEN', 'You cannot verify your own record.');
            }
            $this->pdo->prepare(
                'UPDATE learning_record SET status = ?, review_note = ?, reviewed_by = ?,'
                . ' reviewed_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE id = ?'
            )->execute([$decision, $note === '' ? null : $note, $actor['id'], $id]);
            Audit::log($this->pdo, $actor, 'learning.' . $decision, 'learning:' . $id, ['from' => $row['status']]);
        });
    }

    /**
     * @param array<string, mixed> $r
     * @return array<string, mixed>
     */
    private static function record(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'kind' => (string) $r['kind'],
            'name' => (string) $r['name'],
            'provider' => (string) $r['provider'],
            'completed_on' => (string) $r['completed_on'],
            'link_url' => $r['link_url'],
            'proof_name' => $r['proof_name'],
            'has_proof' => (bool) $r['has_proof'],
            'status' => (string) $r['status'],
            'review_note' => $r['review_note'],
            'reviewed_at' => $r['reviewed_at'],
            'created_at' => (string) $r['created_at'],
        ];
    }
}
