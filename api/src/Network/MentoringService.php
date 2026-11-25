<?php

declare(strict_types=1);

namespace Cpdc\Network;

use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use PDO;

/**
 * Mentoring: alumni offer slots per month, students ask with a short message, the mentor accepts or declines.
 * Contact details (email) are shared only inside an accepted match, and only between its two people.
 *
 * @phpstan-type Actor array{id: int, organisation_id: int, role: string, ...}
 */
final class MentoringService
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @param Actor $alumnus
     * @param array{active: bool, topics: list<string>, slots_per_month: int} $offer
     */
    public function saveOffer(array $alumnus, array $offer): void
    {
        $topics = [];
        foreach ($offer['topics'] as $topic) {
            $topic = trim((string) preg_replace('/\s+/u', ' ', $topic));
            if ($topic !== '' && !in_array(mb_strtolower($topic), array_map('mb_strtolower', $topics), true)) {
                $topics[] = $topic;
            }
        }
        $this->pdo->prepare(
            'INSERT INTO mentor_offer (user_id, organisation_id, active, topics_json, slots_per_month, updated_at)'
            . ' VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE active = VALUES(active),'
            . ' topics_json = VALUES(topics_json), slots_per_month = VALUES(slots_per_month),'
            . ' updated_at = VALUES(updated_at)'
        )->execute([
            $alumnus['id'],
            $alumnus['organisation_id'],
            (int) $offer['active'],
            json_encode($topics, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            $offer['slots_per_month'],
        ]);
    }

    /**
     * @param Actor $student
     * @return int the new request id
     */
    public function request(array $student, int $mentorId, string $message, string $now, int $maxOpen): int
    {
        $org = $student['organisation_id'];

        return Transaction::run($this->pdo, function () use ($student, $mentorId, $message, $now, $maxOpen, $org) {
            $slots = $this->lockOffer($org, $mentorId, requireVisible: true);
            if ($slots === null) {
                throw new ApiError(404, 'NOT_FOUND', 'This mentor is not taking requests.');
            }
            if ($this->taken($mentorId, $now) >= $slots) {
                throw new ApiError(409, 'MENTOR_FULL', 'This mentor has no free slots this month.');
            }
            $open = $this->pdo->prepare(
                "SELECT COUNT(*) FROM mentor_request WHERE student_id = ? AND status = 'waiting'"
            );
            $open->execute([$student['id']]);
            if ((int) $open->fetchColumn() >= $maxOpen) {
                throw new ApiError(409, 'TOO_MANY_OPEN', "You can have $maxOpen open requests at a time.");
            }
            try {
                $this->pdo->prepare(
                    'INSERT INTO mentor_request (organisation_id, student_id, mentor_id, message, created_at)'
                    . ' VALUES (?, ?, ?, ?, ?)'
                )->execute([$org, $student['id'], $mentorId, trim($message), $now]);
            } catch (\PDOException $e) {
                if (($e->errorInfo[1] ?? null) === 1062) {
                    throw new ApiError(409, 'ALREADY_ASKED', 'You already asked this mentor. Wait for the answer.');
                }
                throw $e;
            }

            return (int) $this->pdo->lastInsertId();
        });
    }

    /** @param Actor $mentor */
    public function decide(array $mentor, int $requestId, bool $accept, ?string $reply, string $now): void
    {
        Transaction::run($this->pdo, function () use ($mentor, $requestId, $accept, $reply, $now): void {
            $row = $this->pdo->prepare(
                "SELECT id FROM mentor_request WHERE id = ? AND mentor_id = ? AND organisation_id = ?"
                . " AND status = 'waiting' FOR UPDATE"
            );
            $row->execute([$requestId, $mentor['id'], $mentor['organisation_id']]);
            if ($row->fetchColumn() === false) {
                throw new ApiError(404, 'NOT_FOUND', 'This request is not waiting for you.');
            }
            if ($accept) {
                $slots = $this->lockOffer($mentor['organisation_id'], $mentor['id'], requireVisible: false) ?? 0;
                if ($this->taken($mentor['id'], $now) >= $slots) {
                    throw new ApiError(409, 'MENTOR_FULL', 'Your slots for this month are full. Add a slot first.');
                }
            }
            $reply = $reply === null || trim($reply) === '' ? null : trim($reply);
            $this->pdo->prepare('UPDATE mentor_request SET status = ?, reply = ?, decided_at = ? WHERE id = ?')
                ->execute([$accept ? 'accepted' : 'declined', $reply, $now, $requestId]);
        });
    }

    /** @param Actor $student */
    public function withdraw(array $student, int $requestId, string $now): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE mentor_request SET status = 'withdrawn', decided_at = ? WHERE id = ? AND student_id = ?"
            . " AND organisation_id = ? AND status = 'waiting'"
        );
        $stmt->execute([$now, $requestId, $student['id'], $student['organisation_id']]);
        if ($stmt->rowCount() !== 1) {
            throw new ApiError(404, 'NOT_FOUND', 'This request is not waiting.');
        }
    }

    /**
     * Requests the user sent (as a student) and received (as a mentor). The other person's email shows only once
     * the request is accepted.
     *
     * @param Actor $user
     * @return array{sent: list<array<string, mixed>>, received: list<array<string, mixed>>}
     */
    public function mine(array $user): array
    {
        $select = 'SELECT r.id, r.status, r.message, r.reply, r.created_at, r.decided_at, o.id AS other_id,'
            . ' o.display_name, l.profile_url AS linkedin_url, COALESCE(p.faculty, o.department) AS faculty,'
            . " IF(r.status = 'accepted', %s, NULL) AS email"
            . ' FROM mentor_request r JOIN `user` o ON o.id = r.%s'
            . ' LEFT JOIN linkedin_account l ON l.user_id = o.id LEFT JOIN career_profile p ON p.user_id = o.id'
            . ' WHERE r.%s = ? AND r.organisation_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 100';
        $args = [$user['id'], $user['organisation_id']];
        $sent = $this->pdo->prepare(sprintf($select, 'p.personal_email', 'mentor_id', 'student_id'));
        $sent->execute($args);
        $received = $this->pdo->prepare(sprintf($select, 'o.email', 'student_id', 'mentor_id'));
        $received->execute($args);

        return [
            'sent' => array_values(array_map(self::row(...), $sent->fetchAll(PDO::FETCH_ASSOC))),
            'received' => array_values(array_map(self::row(...), $received->fetchAll(PDO::FETCH_ASSOC))),
        ];
    }

    /**
     * CPDC overview: counts and recent matches with names and LinkedIn links. Messages stay private.
     *
     * @return array<string, mixed>
     */
    public function activity(int $org, string $now): array
    {
        $mentors = $this->pdo->prepare(
            'SELECT COUNT(*) FROM mentor_offer m JOIN network_profile n ON n.user_id = m.user_id'
            . " JOIN `user` u ON u.id = m.user_id WHERE m.organisation_id = ? AND m.active = 1 AND n.visible = 1"
            . " AND u.role = 'alumni' AND u.active = 1"
        );
        $mentors->execute([$org]);
        $counts = $this->pdo->prepare(
            'SELECT status, COUNT(*) AS total, SUM(created_at >= ?) AS this_month FROM mentor_request'
            . ' WHERE organisation_id = ? GROUP BY status'
        );
        $counts->execute([self::monthStart($now), $org]);
        $byStatus = ['waiting' => 0, 'accepted' => 0, 'declined' => 0, 'withdrawn' => 0];
        $month = $byStatus;
        foreach ($counts->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $byStatus[(string) $r['status']] = (int) $r['total'];
            $month[(string) $r['status']] = (int) $r['this_month'];
        }
        $matches = $this->pdo->prepare(
            'SELECT r.id, r.decided_at, s.display_name AS student_name, sl.profile_url AS student_linkedin,'
            . ' s.department AS student_faculty, m.display_name AS mentor_name, ml.profile_url AS mentor_linkedin'
            . ' FROM mentor_request r JOIN `user` s ON s.id = r.student_id JOIN `user` m ON m.id = r.mentor_id'
            . ' LEFT JOIN linkedin_account sl ON sl.user_id = s.id LEFT JOIN linkedin_account ml ON ml.user_id = m.id'
            . " WHERE r.organisation_id = ? AND r.status = 'accepted' ORDER BY r.decided_at DESC, r.id DESC LIMIT 50"
        );
        $matches->execute([$org]);

        return [
            'mentors' => (int) $mentors->fetchColumn(),
            'requests' => $byStatus,
            'this_month' => $month,
            'matches' => array_map(static fn (array $r): array => [
                'id' => (int) $r['id'],
                'decided_at' => $r['decided_at'],
                'student' => ['display_name' => $r['student_name'], 'linkedin_url' => $r['student_linkedin'],
                    'faculty' => $r['student_faculty']],
                'mentor' => ['display_name' => $r['mentor_name'], 'linkedin_url' => $r['mentor_linkedin']],
            ], $matches->fetchAll(PDO::FETCH_ASSOC)),
        ];
    }

    /** First instant of the UTC month that contains $now ("Y-m-d H:i:s"). */
    public static function monthStart(string $now): string
    {
        return substr($now, 0, 7) . '-01 00:00:00';
    }

    /**
     * Locks the mentor's offer row; returns its monthly slots, or null when the mentor cannot be asked.
     */
    private function lockOffer(int $org, int $mentorId, bool $requireVisible): ?int
    {
        $sql = 'SELECT m.slots_per_month FROM mentor_offer m JOIN `user` u ON u.id = m.user_id'
            . ' LEFT JOIN network_profile n ON n.user_id = m.user_id'
            . " WHERE m.user_id = ? AND m.organisation_id = ? AND u.role = 'alumni' AND u.active = 1";
        if ($requireVisible) {
            $sql .= ' AND m.active = 1 AND n.visible = 1';
        }
        $stmt = $this->pdo->prepare($sql . ' FOR UPDATE');
        $stmt->execute([$mentorId, $org]);
        $slots = $stmt->fetchColumn();

        return $slots === false ? null : (int) $slots;
    }

    /** Requests the mentor accepted this month. */
    private function taken(int $mentorId, string $now): int
    {
        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM mentor_request WHERE mentor_id = ? AND status = 'accepted' AND decided_at >= ?"
        );
        $stmt->execute([$mentorId, self::monthStart($now)]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * @param array<string, mixed> $r
     * @return array<string, mixed>
     */
    private static function row(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'status' => $r['status'],
            'message' => $r['message'],
            'reply' => $r['reply'],
            'created_at' => $r['created_at'],
            'decided_at' => $r['decided_at'],
            'person' => [
                'id' => (int) $r['other_id'],
                'display_name' => $r['display_name'],
                'linkedin_url' => $r['linkedin_url'],
                'faculty' => $r['faculty'],
                'email' => $r['email'],
            ],
        ];
    }
}
