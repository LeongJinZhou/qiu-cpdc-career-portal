<?php

declare(strict_types=1);

namespace Cpdc\Interview;

use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use Cpdc\Http\Paginator;
use PDO;

/**
 * The interview question bank CPDC keeps. Questions are switched off, never deleted. Every change is audited.
 *
 * @phpstan-type Actor array{id: int, organisation_id: int, ...}
 * @phpstan-type Fields array{field?: string, question?: string, tip?: string, active?: bool}
 */
final class QuestionBank
{
    private const COLUMNS = 'id, field, question, tip, active, updated_at';

    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @return array{items: list<mixed>, page: int, per_page: int, total: int} */
    public function list(int $org, ?string $field, Paginator $page): array
    {
        $where = ' WHERE organisation_id = ?' . ($field === null || $field === '' ? '' : ' AND field = ?');
        $args = $field === null || $field === '' ? [$org] : [$org, $field];
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM interview_question' . $where);
        $count->execute($args);
        $stmt = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM interview_question' . $where
            . ' ORDER BY field, active DESC, id LIMIT ' . $page->perPage . ' OFFSET ' . $page->offset()
        );
        $stmt->execute($args);

        $items = array_values(array_map(self::row(...), $stmt->fetchAll(PDO::FETCH_ASSOC)));

        return $page->envelope($items, (int) $count->fetchColumn());
    }

    /**
     * @param Actor $admin
     * @param Fields $fields
     * @return array<string, mixed>
     */
    public function create(array $admin, array $fields): array
    {
        $field = self::clean($fields['field'] ?? '');
        $question = self::clean($fields['question'] ?? '');
        if ($field === '') {
            throw ApiError::validation('field', 'Add the field, for example "Business".');
        }
        if (mb_strlen($question) < 10) {
            throw ApiError::validation('question', 'Write the question (at least 10 characters).');
        }

        return Transaction::run($this->pdo, function () use ($admin, $fields, $field, $question): array {
            $this->pdo->prepare(
                'INSERT INTO interview_question (organisation_id, field, question, tip, active, created_by)'
                . ' VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([
                $admin['organisation_id'],
                $field,
                $question,
                self::tip($fields['tip'] ?? null),
                (int) ($fields['active'] ?? true),
                $admin['id'],
            ]);
            $id = (int) $this->pdo->lastInsertId();
            Audit::log($this->pdo, $admin, 'interview.question_create', "interview_question:$id", ['field' => $field]);

            return $this->get($admin['organisation_id'], $id);
        });
    }

    /**
     * @param Actor $admin
     * @param Fields $fields
     * @return array<string, mixed>
     */
    public function update(array $admin, int $id, array $fields): array
    {
        return Transaction::run($this->pdo, function () use ($admin, $id, $fields): array {
            $before = $this->get($admin['organisation_id'], $id);
            $after = [
                'field' => isset($fields['field']) ? self::clean($fields['field']) : $before['field'],
                'question' => isset($fields['question']) ? self::clean($fields['question']) : $before['question'],
                'tip' => array_key_exists('tip', $fields) ? self::tip($fields['tip']) : $before['tip'],
                'active' => $fields['active'] ?? $before['active'],
            ];
            if ($after['field'] === '' || mb_strlen((string) $after['question']) < 10) {
                throw ApiError::validation('question', 'A question needs a field and at least 10 characters.');
            }
            $this->pdo->prepare(
                'UPDATE interview_question SET field = ?, question = ?, tip = ?, active = ?,'
                . ' updated_at = UTC_TIMESTAMP(3) WHERE id = ? AND organisation_id = ?'
            )->execute([
                $after['field'], $after['question'], $after['tip'], (int) $after['active'], $id,
                $admin['organisation_id'],
            ]);
            $changed = array_keys(
                array_filter($after, static fn ($v, $k) => $before[$k] !== $v, ARRAY_FILTER_USE_BOTH)
            );
            Audit::log($this->pdo, $admin, 'interview.question_update', "interview_question:$id", [
                'changed' => $changed,
                'active' => ['old' => $before['active'], 'new' => $after['active']],
            ]);

            return $this->get($admin['organisation_id'], $id);
        });
    }

    /** @return array<string, mixed> */
    private function get(int $org, int $id): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM interview_question WHERE id = ? AND organisation_id = ?'
        );
        $stmt->execute([$id, $org]);

        return self::row($stmt->fetch(PDO::FETCH_ASSOC) ?: throw new ApiError(404, 'NOT_FOUND', 'Not found.'));
    }

    /**
     * @param array<string, mixed> $r
     * @return array<string, mixed>
     */
    private static function row(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'field' => (string) $r['field'],
            'question' => (string) $r['question'],
            'tip' => $r['tip'] === null ? null : (string) $r['tip'],
            'active' => (bool) $r['active'],
            'updated_at' => $r['updated_at'],
        ];
    }

    private static function clean(string $text): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }

    private static function tip(?string $tip): ?string
    {
        $tip = self::clean((string) $tip);

        return $tip === '' ? null : $tip;
    }
}
