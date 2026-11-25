<?php

declare(strict_types=1);

namespace Cpdc\Interview;

use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use Cpdc\Interview\Ai\Coach;
use Cpdc\Interview\Ai\CoachUnavailable;
use PDO;

/**
 * A person's own practice sessions. Every query is scoped to the signed-in user. AI calls are capped per user per
 * rolling 24 hours; the answer is claimed before the call (so a double click cannot spend two calls) and freed again
 * when the provider fails.
 *
 * @phpstan-type Actor array{id: int, organisation_id: int, ...}
 */
final class InterviewService
{
    /** A claimed answer with no feedback after this long (a request that died) can be answered again. */
    public const CLAIM_SECONDS = 120;

    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * Fields of the bank with their number of active questions.
     *
     * @return list<array{field: string, questions: int}>
     */
    public function fields(int $org): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT field, COUNT(*) AS questions FROM interview_question WHERE organisation_id = ? AND active = 1'
            . ' GROUP BY field ORDER BY field'
        );
        $stmt->execute([$org]);

        return array_values(array_map(
            static fn (array $r): array => ['field' => (string) $r['field'], 'questions' => (int) $r['questions']],
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        ));
    }

    /** AI feedback given to this user in the 24 hours before $now. */
    public function usedToday(int $userId, string $now): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM interview_item WHERE user_id = ? AND answered_at > DATE_SUB(?, INTERVAL 1 DAY)'
        );
        $stmt->execute([$userId, $now]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Starts a session with up to $count random active questions of $field.
     *
     * @param Actor $user
     * @return int session id
     */
    public function start(array $user, string $field, int $count, string $now): int
    {
        $org = $user['organisation_id'];
        $stmt = $this->pdo->prepare(
            'SELECT id, field, question, tip FROM interview_question WHERE organisation_id = ? AND active = 1'
            . ' AND field = ? ORDER BY RAND() LIMIT ' . max(1, $count)
        );
        $stmt->execute([$org, $field]);
        $questions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if ($questions === []) {
            throw ApiError::validation('field', 'There are no questions for this field yet.');
        }

        return Transaction::run($this->pdo, function () use ($user, $org, $questions, $now): int {
            $this->pdo->prepare(
                'INSERT INTO interview_session (organisation_id, user_id, field, started_at) VALUES (?, ?, ?, ?)'
            )->execute([$org, $user['id'], $questions[0]['field'], $now]);
            $session = (int) $this->pdo->lastInsertId();
            $item = $this->pdo->prepare(
                'INSERT INTO interview_item (organisation_id, session_id, user_id, position, question_id, question,'
                . ' tip) VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($questions as $i => $q) {
                $item->execute([$org, $session, $user['id'], $i + 1, $q['id'], $q['question'], $q['tip']]);
            }

            return $session;
        });
    }

    /**
     * @param Actor $user
     * @return list<array<string, mixed>>
     */
    public function sessions(array $user): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT s.id, s.field, s.started_at, COUNT(i.id) AS questions,"
            . " SUM(i.feedback_json IS NOT NULL) AS answered,"
            . " AVG(CAST(JSON_EXTRACT(i.feedback_json, '$.score') AS UNSIGNED)) AS average"
            . ' FROM interview_session s JOIN interview_item i ON i.session_id = s.id'
            . ' WHERE s.user_id = ? AND s.organisation_id = ? GROUP BY s.id, s.field, s.started_at'
            . ' ORDER BY s.started_at DESC, s.id DESC LIMIT 50'
        );
        $stmt->execute([$user['id'], $user['organisation_id']]);

        return array_values(array_map(static fn (array $r): array => [
            'id' => (int) $r['id'],
            'field' => $r['field'],
            'started_at' => $r['started_at'],
            'questions' => (int) $r['questions'],
            'answered' => (int) $r['answered'],
            'average' => $r['average'] === null ? null : round((float) $r['average'], 1),
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    /**
     * @param Actor $user
     * @return array<string, mixed>
     */
    public function session(array $user, int $id): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, field, started_at FROM interview_session WHERE id = ? AND user_id = ? AND organisation_id = ?'
        );
        $stmt->execute([$id, $user['id'], $user['organisation_id']]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC) ?: throw new ApiError(404, 'NOT_FOUND', 'Not found.');
        $items = $this->pdo->prepare(
            'SELECT id, position, question, tip, answer, feedback_json, answered_at FROM interview_item'
            . ' WHERE session_id = ? AND user_id = ? ORDER BY position'
        );
        $items->execute([$id, $user['id']]);

        return [
            'id' => (int) $session['id'],
            'field' => $session['field'],
            'started_at' => $session['started_at'],
            'items' => array_map(self::item(...), $items->fetchAll(PDO::FETCH_ASSOC)),
        ];
    }

    /**
     * Saves the answer and the coach's feedback on it.
     *
     * @param Actor $user
     * @return array<string, mixed> the answered item
     */
    public function answer(
        array $user,
        int $sessionId,
        int $itemId,
        string $answer,
        Coach $coach,
        int $dailyLimit,
        string $now
    ): array {
        $row = Transaction::run($this->pdo, function () use ($user, $sessionId, $itemId, $answer, $dailyLimit, $now) {
            // One user row lock serialises this person's claims, so the daily cap holds under parallel requests.
            $this->pdo->prepare('SELECT id FROM `user` WHERE id = ? FOR UPDATE')->execute([$user['id']]);
            $stmt = $this->pdo->prepare(
                'SELECT i.id, i.question, s.field, (i.feedback_json IS NOT NULL'
                . ' OR i.answered_at > DATE_SUB(?, INTERVAL ' . self::CLAIM_SECONDS . ' SECOND)) AS taken'
                . ' FROM interview_item i JOIN interview_session s ON s.id = i.session_id'
                . ' WHERE i.id = ? AND i.session_id = ? AND i.user_id = ? AND s.organisation_id = ?'
            );
            $stmt->execute([$now, $itemId, $sessionId, $user['id'], $user['organisation_id']]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC) ?: throw new ApiError(404, 'NOT_FOUND', 'Not found.');
            // An answer without feedback older than the claim window was a call that died: it may be tried again.
            if ((int) $item['taken'] === 1) {
                throw new ApiError(409, 'ALREADY_ANSWERED', 'This question already has an answer.');
            }
            if ($this->usedToday($user['id'], $now) >= $dailyLimit) {
                throw new ApiError(
                    429,
                    'AI_DAILY_LIMIT',
                    "You have used today's $dailyLimit feedback answers. Try again tomorrow."
                );
            }
            $this->pdo->prepare('UPDATE interview_item SET answer = ?, answered_at = ? WHERE id = ?')
                ->execute([$answer, $now, $itemId]);

            return $item;
        });

        try {
            $feedback = $coach->feedback((string) $row['field'], (string) $row['question'], $answer);
        } catch (CoachUnavailable) {
            $this->pdo->prepare('UPDATE interview_item SET answer = NULL, answered_at = NULL WHERE id = ?')
                ->execute([$itemId]);
            throw new ApiError(502, 'AI_UNAVAILABLE', 'Feedback is not available right now. Please try again.');
        }
        $this->pdo->prepare('UPDATE interview_item SET feedback_json = ?, ai_driver = ? WHERE id = ?')->execute([
            json_encode($feedback->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            $coach->name(),
            $itemId,
        ]);

        $stmt = $this->pdo->prepare(
            'SELECT id, position, question, tip, answer, feedback_json, answered_at FROM interview_item WHERE id = ?'
        );
        $stmt->execute([$itemId]);

        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($item) ? self::item($item) : throw new \LogicException('answered item vanished');
    }

    /**
     * @param array<string, mixed> $r
     * @return array<string, mixed>
     */
    private static function item(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'position' => (int) $r['position'],
            'question' => $r['question'],
            'tip' => $r['tip'],
            'answer' => $r['answer'],
            'feedback' => $r['feedback_json'] === null ? null : json_decode((string) $r['feedback_json'], true),
            'answered_at' => $r['answered_at'],
        ];
    }
}
