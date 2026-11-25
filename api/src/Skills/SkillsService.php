<?php

declare(strict_types=1);

namespace Cpdc\Skills;

use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use Cpdc\Jobs\JobService;
use Cpdc\Jobs\SkillRequirements;
use PDO;

/** A person's own skills self-ratings over time, and the gap against a job's skills. */
final class SkillsService
{
    /** How many past ratings the page shows. */
    private const HISTORY = 20;

    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @return list<array{id: int, name: string, description: string}> */
    public function areas(int $org): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, name, description FROM skill_area WHERE organisation_id = ? ORDER BY position, id'
        );
        $stmt->execute([$org]);

        return array_values(array_map(static fn (array $r): array => [
            'id' => (int) $r['id'],
            'name' => (string) $r['name'],
            'description' => (string) $r['description'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    /**
     * The person's ratings, newest first: each with its levels by area id.
     *
     * @return list<array{id: int, created_at: string, ratings: array<string, int>}>
     */
    public function history(int $org, int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT a.id, a.created_at, r.area_id, r.level FROM (SELECT id, created_at FROM skill_assessment'
            . ' WHERE user_id = ? AND organisation_id = ? ORDER BY created_at DESC, id DESC LIMIT ' . self::HISTORY
            . ') a JOIN skill_rating r ON r.assessment_id = a.id ORDER BY a.created_at DESC, a.id DESC'
        );
        $stmt->execute([$userId, $org]);
        $out = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $id = (int) $r['id'];
            $out[$id] ??= ['id' => $id, 'created_at' => (string) $r['created_at'], 'ratings' => []];
            $out[$id]['ratings'][(string) $r['area_id']] = (int) $r['level'];
        }

        return array_values($out);
    }

    /**
     * Saves one self-rating. Every area must belong to the organisation and appear once.
     *
     * @param array{id: int, organisation_id: int, ...} $user
     * @param list<array{area_id: int, level: int}> $ratings
     */
    public function rate(array $user, array $ratings, string $nowUtc): int
    {
        $org = $user['organisation_id'];
        $ids = array_map(static fn (array $r): int => $r['area_id'], $ratings);
        if (count($ids) !== count(array_unique($ids))) {
            throw ApiError::validation('ratings', 'Rate each skill area once.');
        }
        if (count(SkillRequirements::knownAreas($this->pdo, $org, $ids)) !== count($ids)) {
            throw ApiError::validation('ratings', 'Rate the skill areas from the list.');
        }

        return Transaction::run($this->pdo, function () use ($user, $org, $ratings, $nowUtc): int {
            $this->pdo->prepare('INSERT INTO skill_assessment (organisation_id, user_id, created_at) VALUES (?, ?, ?)')
                ->execute([$org, $user['id'], $nowUtc]);
            $id = (int) $this->pdo->lastInsertId();
            $insert = $this->pdo->prepare('INSERT INTO skill_rating (assessment_id, area_id, level) VALUES (?, ?, ?)');
            foreach ($ratings as $rating) {
                $insert->execute([$id, $rating['area_id'], $rating['level']]);
            }

            return $id;
        });
    }

    /**
     * Open jobs that ask for skills: the ones the gap view can compare against.
     *
     * @return list<array{id: int, title: string, employer_name: string}>
     */
    public function comparableJobs(int $org, string $today): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT j.id, j.title, e.name AS employer_name FROM job_posting j JOIN employer e ON e.id = j.employer_id'
            . " WHERE j.organisation_id = ? AND j.status = 'open' AND j.closing_date >= ? AND e.active = 1"
            . ' AND EXISTS (SELECT 1 FROM job_skill s WHERE s.job_id = j.id) ORDER BY j.title, j.id LIMIT 200'
        );
        $stmt->execute([$org, $today]);

        return array_values(array_map(static fn (array $r): array => [
            'id' => (int) $r['id'],
            'title' => (string) $r['title'],
            'employer_name' => (string) $r['employer_name'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    /**
     * The gap view for one open job.
     *
     * @return array<string, mixed>
     */
    public function gap(int $org, int $userId, int $jobId, string $today): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT j.id, j.title, j.status, j.closing_date, e.name AS employer_name, e.active'
            . ' FROM job_posting j JOIN employer e ON e.id = j.employer_id WHERE j.id = ? AND j.organisation_id = ?'
        );
        $stmt->execute([$jobId, $org]);
        $job = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($job) || !JobService::isOpen($job, $today)) {
            throw new ApiError(404, 'NOT_FOUND', 'Not found.');
        }
        $latest = $this->history($org, $userId)[0] ?? null;
        $mine = [];
        foreach ($latest['ratings'] ?? [] as $area => $level) {
            $mine[(int) $area] = $level;
        }

        return [
            'job' => ['id' => (int) $job['id'], 'title' => (string) $job['title'],
                'employer_name' => (string) $job['employer_name']],
            'rated_at' => $latest['created_at'] ?? null,
        ] + Gap::compute((new SkillRequirements($this->pdo))->forJob($jobId), $mine);
    }
}
