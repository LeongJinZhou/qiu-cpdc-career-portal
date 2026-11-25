<?php

declare(strict_types=1);

namespace Cpdc\CareerPath;

use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use PDO;

/**
 * Career paths by programme: target roles with skills and steps (written by CPDC) and each person's ticks.
 *
 * @phpstan-type User array{id: int, organisation_id: int, ...}
 * @phpstan-type Saved array{programme: string, title: string, summary?: string, skills: list<string>,
 *     steps: list<array{id?: int, title: string, detail?: string}>}
 */
final class CareerPathService
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * The programmes that have paths, and the paths of one: the asked one, else the person's own programme when it
     * has paths, else the first.
     *
     * @param User $user
     * @return array{programmes: list<string>, programme: string|null, my_programme: string|null,
     *     paths: list<array<string, mixed>>}
     */
    public function overview(array $user, ?string $asked): array
    {
        $org = $user['organisation_id'];
        $stmt = $this->pdo->prepare(
            'SELECT DISTINCT programme FROM career_path WHERE organisation_id = ? ORDER BY programme'
        );
        $stmt->execute([$org]);
        $programmes = array_values(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN)));
        $mine = $this->pdo->prepare('SELECT programme FROM career_profile WHERE user_id = ? AND organisation_id = ?');
        $mine->execute([$user['id'], $org]);
        $myProgramme = $mine->fetchColumn();
        $myProgramme = is_string($myProgramme) && trim($myProgramme) !== '' ? trim($myProgramme) : null;

        $chosen = self::pick($programmes, $asked) ?? self::pick($programmes, $myProgramme) ?? ($programmes[0] ?? null);

        return [
            'programmes' => $programmes,
            'programme' => $chosen,
            'my_programme' => $myProgramme,
            'paths' => $chosen === null ? [] : $this->paths($user, $chosen),
        ];
    }

    /**
     * @param User $admin
     * @param Saved $data
     */
    public function create(array $admin, array $data): int
    {
        return Transaction::run($this->pdo, function () use ($admin, $data): int {
            $this->pdo->prepare(
                'INSERT INTO career_path (organisation_id, programme, title, summary, skills_json, created_by)'
                . ' VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([
                $admin['organisation_id'], trim($data['programme']), trim($data['title']),
                self::text($data['summary'] ?? ''), self::skills($data['skills']), $admin['id'],
            ]);
            $id = (int) $this->pdo->lastInsertId();
            $this->replaceSteps($admin, $id, $data['steps']);
            Audit::log($this->pdo, $admin, 'careerpath.create', "career_path:$id");

            return $id;
        });
    }

    /**
     * @param User $admin
     * @param Saved $data
     */
    public function update(array $admin, int $id, array $data): void
    {
        Transaction::run($this->pdo, function () use ($admin, $id, $data): void {
            $this->assertExists($admin, $id);
            $this->pdo->prepare(
                'UPDATE career_path SET programme = ?, title = ?, summary = ?, skills_json = ?,'
                . ' updated_at = UTC_TIMESTAMP(3) WHERE id = ? AND organisation_id = ?'
            )->execute([
                trim($data['programme']), trim($data['title']), self::text($data['summary'] ?? ''),
                self::skills($data['skills']), $id, $admin['organisation_id'],
            ]);
            $this->replaceSteps($admin, $id, $data['steps']);
            Audit::log($this->pdo, $admin, 'careerpath.update', "career_path:$id");
        });
    }

    /** @param User $admin */
    public function delete(array $admin, int $id): void
    {
        Transaction::run($this->pdo, function () use ($admin, $id): void {
            $this->assertExists($admin, $id);
            $this->pdo->prepare('DELETE FROM career_path WHERE id = ? AND organisation_id = ?')
                ->execute([$id, $admin['organisation_id']]);
            Audit::log($this->pdo, $admin, 'careerpath.delete', "career_path:$id");
        });
    }

    /**
     * The person ticks a step done, or takes the tick away. Only their own progress.
     *
     * @param User $user
     */
    public function setDone(array $user, int $stepId, bool $done, int $now): void
    {
        $step = $this->pdo->prepare('SELECT id FROM career_path_step WHERE id = ? AND organisation_id = ?');
        $step->execute([$stepId, $user['organisation_id']]);
        if ($step->fetchColumn() === false) {
            throw new ApiError(404, 'NOT_FOUND', 'Not found.');
        }
        if ($done) {
            $this->pdo->prepare(
                'INSERT IGNORE INTO career_path_progress (user_id, step_id, organisation_id, done_at)'
                . ' VALUES (?, ?, ?, ?)'
            )->execute([$user['id'], $stepId, $user['organisation_id'], gmdate('Y-m-d H:i:s', $now)]);
        } else {
            $this->pdo->prepare('DELETE FROM career_path_progress WHERE user_id = ? AND step_id = ?')
                ->execute([$user['id'], $stepId]);
        }
    }

    /**
     * The stored programme name that matches $name (any case), or null.
     *
     * @param list<string> $programmes
     */
    public static function pick(array $programmes, ?string $name): ?string
    {
        if ($name === null) {
            return null;
        }
        foreach ($programmes as $programme) {
            if (mb_strtolower($programme) === mb_strtolower(trim($name))) {
                return $programme;
            }
        }

        return null;
    }

    /**
     * Skill names of a path marked with whether the person lists them in their profile (any case).
     *
     * @param list<string> $pathSkills
     * @param list<string> $mySkills
     * @return list<array{name: string, have: bool}>
     */
    public static function matchSkills(array $pathSkills, array $mySkills): array
    {
        $have = array_flip(array_map('mb_strtolower', $mySkills));

        return array_map(
            static fn (string $s): array => ['name' => $s, 'have' => isset($have[mb_strtolower($s)])],
            $pathSkills
        );
    }

    /**
     * @param User $user
     * @return list<array<string, mixed>>
     */
    private function paths(array $user, string $programme): array
    {
        $org = $user['organisation_id'];
        $stmt = $this->pdo->prepare(
            'SELECT id, programme, title, summary, skills_json FROM career_path'
            . ' WHERE organisation_id = ? AND programme = ? ORDER BY title, id'
        );
        $stmt->execute([$org, $programme]);
        $paths = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if ($paths === []) {
            return [];
        }
        $ids = array_map(static fn (array $p): int => (int) $p['id'], $paths);
        $marks = implode(', ', array_fill(0, count($ids), '?'));
        $steps = $this->pdo->prepare(
            'SELECT s.id, s.path_id, s.title, s.detail, p.done_at FROM career_path_step s'
            . ' LEFT JOIN career_path_progress p ON p.step_id = s.id AND p.user_id = ?'
            . " WHERE s.organisation_id = ? AND s.path_id IN ($marks) ORDER BY s.position, s.id"
        );
        $steps->execute([$user['id'], $org, ...$ids]);
        $byPath = [];
        foreach ($steps->fetchAll(PDO::FETCH_ASSOC) as $s) {
            $byPath[(int) $s['path_id']][] = [
                'id' => (int) $s['id'],
                'title' => $s['title'],
                'detail' => $s['detail'],
                'done' => $s['done_at'] !== null,
            ];
        }
        $skills = $this->pdo->prepare('SELECT skill FROM career_skill WHERE user_id = ?');
        $skills->execute([$user['id']]);
        $mySkills = array_values(array_map('strval', $skills->fetchAll(PDO::FETCH_COLUMN)));

        return array_values(array_map(static function (array $p) use ($byPath, $mySkills): array {
            $id = (int) $p['id'];
            $steps = $byPath[$id] ?? [];
            /** @var list<string> $pathSkills */
            $pathSkills = json_decode((string) $p['skills_json'], true, 4, JSON_THROW_ON_ERROR);

            return [
                'id' => $id,
                'programme' => $p['programme'],
                'title' => $p['title'],
                'summary' => $p['summary'],
                'skills' => self::matchSkills($pathSkills, $mySkills),
                'steps' => $steps,
                'step_count' => count($steps),
                'done_count' => count(array_filter($steps, static fn (array $s): bool => $s['done'])),
            ];
        }, $paths));
    }

    /** @param User $admin */
    private function assertExists(array $admin, int $id): void
    {
        $stmt = $this->pdo->prepare('SELECT id FROM career_path WHERE id = ? AND organisation_id = ? FOR UPDATE');
        $stmt->execute([$id, $admin['organisation_id']]);
        if ($stmt->fetchColumn() === false) {
            throw new ApiError(404, 'NOT_FOUND', 'Not found.');
        }
    }

    /**
     * Steps with an id of this path are updated (ticks stay); new steps are added; the rest are removed.
     *
     * @param User $admin
     * @param list<array{id?: int, title: string, detail?: string}> $steps
     */
    private function replaceSteps(array $admin, int $pathId, array $steps): void
    {
        $existing = $this->pdo->prepare('SELECT id FROM career_path_step WHERE path_id = ?');
        $existing->execute([$pathId]);
        $known = array_map('intval', $existing->fetchAll(PDO::FETCH_COLUMN));
        $kept = [];
        $update = $this->pdo->prepare(
            'UPDATE career_path_step SET title = ?, detail = ?, position = ? WHERE id = ? AND path_id = ?'
        );
        $insert = $this->pdo->prepare(
            'INSERT INTO career_path_step (organisation_id, path_id, title, detail, position) VALUES (?, ?, ?, ?, ?)'
        );
        foreach ($steps as $i => $step) {
            $title = trim($step['title']);
            if ($title === '') {
                throw ApiError::validation("steps.$i.title", 'Every step needs a title.');
            }
            $detail = self::text($step['detail'] ?? '');
            $id = $step['id'] ?? null;
            if ($id !== null && in_array($id, $known, true)) {
                $update->execute([$title, $detail, $i, $id, $pathId]);
                $kept[] = $id;
            } else {
                $insert->execute([$admin['organisation_id'], $pathId, $title, $detail, $i]);
            }
        }
        $gone = array_values(array_diff($known, $kept));
        if ($gone !== []) {
            $marks = implode(', ', array_fill(0, count($gone), '?'));
            $this->pdo->prepare("DELETE FROM career_path_step WHERE path_id = ? AND id IN ($marks)")
                ->execute([$pathId, ...$gone]);
        }
    }

    private static function text(string $value): ?string
    {
        $text = trim($value);

        return $text === '' ? null : $text;
    }

    /** @param list<string> $skills */
    private static function skills(array $skills): string
    {
        $seen = [];
        foreach ($skills as $skill) {
            $name = trim($skill);
            if ($name !== '' && !isset($seen[mb_strtolower($name)])) {
                $seen[mb_strtolower($name)] = $name;
            }
        }

        return json_encode(array_values($seen), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    }
}
