<?php

declare(strict_types=1);

namespace Cpdc\Jobs;

use Cpdc\Http\ApiError;
use PDO;

/** The skill levels a job asks for (job_skill), read by the job pages and the skills gap view. */
final class SkillRequirements
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @return list<array{area_id: int, name: string, level: int}> in the areas' own order */
    public function forJob(int $jobId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT s.area_id, a.name, s.level FROM job_skill s JOIN skill_area a ON a.id = s.area_id'
            . ' WHERE s.job_id = ? ORDER BY a.position, a.id'
        );
        $stmt->execute([$jobId]);

        return array_values(array_map(static fn (array $r): array => [
            'area_id' => (int) $r['area_id'],
            'name' => (string) $r['name'],
            'level' => (int) $r['level'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    /**
     * Replaces the job's skills. Every area must belong to the organisation and appear once.
     *
     * @param list<array{area_id: int, level: int}> $skills
     */
    public function replace(int $org, int $jobId, array $skills): void
    {
        $ids = array_map(static fn (array $s): int => $s['area_id'], $skills);
        if (count($ids) !== count(array_unique($ids))) {
            throw ApiError::validation('skills', 'Each skill area can be chosen once.');
        }
        if ($ids !== [] && count(self::knownAreas($this->pdo, $org, $ids)) !== count($ids)) {
            throw ApiError::validation('skills', 'Choose skill areas from the list.');
        }
        $this->pdo->prepare('DELETE FROM job_skill WHERE job_id = ?')->execute([$jobId]);
        $insert = $this->pdo->prepare(
            'INSERT INTO job_skill (job_id, area_id, organisation_id, level) VALUES (?, ?, ?, ?)'
        );
        foreach ($skills as $skill) {
            $insert->execute([$jobId, $skill['area_id'], $org, $skill['level']]);
        }
    }

    /**
     * @param list<int> $ids
     * @return list<int> the ids among $ids that are skill areas of $org
     */
    public static function knownAreas(PDO $pdo, int $org, array $ids): array
    {
        $marks = implode(', ', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("SELECT id FROM skill_area WHERE organisation_id = ? AND id IN ($marks)");
        $stmt->execute([$org, ...$ids]);

        return array_values(array_map(intval(...), $stmt->fetchAll(PDO::FETCH_COLUMN)));
    }
}
