<?php

declare(strict_types=1);

namespace Cpdc\Profile;

use Cpdc\Audit\Audit;
use Cpdc\Auth\QiuEmail;
use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use PDO;

/**
 * A person's career profile: the fields, jobs, education and skills (docs/SPEC.md section 6). Reads are by user
 * id; callers decide who may read whom (ProfileController: self; PeopleController: admins).
 *
 * @phpstan-type Job array{title: string, company: string, location?: string|null, start?: string|null,
 *     end?: string|null, description?: string|null}
 * @phpstan-type School array{school: string, degree?: string|null, field?: string|null, start_year?: int|null,
 *     end_year?: int|null}
 */
final class ProfileService
{
    /** Columns of career_profile a person may edit. */
    public const FIELDS = ['headline', 'about', 'location', 'industry', 'personal_email', 'programme',
        'graduation_year', 'employment_status', 'current_title', 'current_company', 'current_since'];

    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @return array<string, mixed> */
    public function get(int $org, int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.display_name, u.email, u.picture_url, u.role, u.matric_no, u.employee_id,'
            . ' u.department, u.job_title, u.alumni_since, u.last_sign_in_at, u.onboarded_at,'
            . ' l.profile_url AS linkedin_url, l.name AS linkedin_name, l.linked_at AS linkedin_linked_at,'
            . ' l.follow_confirmed_at, g.profile_url AS github_url,'
            . ' p.headline, p.about, p.location, p.industry, p.personal_email, p.faculty, p.programme,'
            . ' p.graduation_year, p.employment_status, p.current_title, p.current_company, p.current_since,'
            . ' p.job_confirmed_at, p.last_pdf_import_at, p.updated_at'
            . ' FROM `user` u LEFT JOIN linkedin_account l ON l.user_id = u.id'
            . ' LEFT JOIN github_account g ON g.user_id = u.id LEFT JOIN career_profile p ON p.user_id = u.id'
            . ' WHERE u.id = ? AND u.organisation_id = ?'
        );
        $stmt->execute([$userId, $org]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            throw new ApiError(404, 'NOT_FOUND', 'Not found.');
        }
        $row['id'] = (int) $row['id'];
        $row['graduation_year'] = $row['graduation_year'] === null ? null : (int) $row['graduation_year'];
        $row['employment_status'] ??= 'unknown';
        $row['linkedin_linked'] = $row['linkedin_linked_at'] !== null;
        $row['faculty'] ??= $row['department'];

        $jobs = $this->pdo->prepare(
            'SELECT id, title, company, location, DATE_FORMAT(start_month, "%Y-%m") AS start,'
            . ' DATE_FORMAT(end_month, "%Y-%m") AS end, description, source FROM career_experience'
            . ' WHERE user_id = ? ORDER BY position, id'
        );
        $jobs->execute([$userId]);
        $schools = $this->pdo->prepare(
            'SELECT id, school, degree, field, start_year, end_year, source FROM career_education'
            . ' WHERE user_id = ? ORDER BY position, id'
        );
        $schools->execute([$userId]);
        $skills = $this->pdo->prepare('SELECT skill FROM career_skill WHERE user_id = ? ORDER BY skill');
        $skills->execute([$userId]);

        $row['experience'] = array_map(static function (array $j): array {
            $j['id'] = (int) $j['id'];

            return $j;
        }, $jobs->fetchAll(PDO::FETCH_ASSOC));
        $row['education'] = array_map(static function (array $s): array {
            $s['id'] = (int) $s['id'];
            $s['start_year'] = $s['start_year'] === null ? null : (int) $s['start_year'];
            $s['end_year'] = $s['end_year'] === null ? null : (int) $s['end_year'];

            return $s;
        }, $schools->fetchAll(PDO::FETCH_ASSOC));
        $row['skills'] = $skills->fetchAll(PDO::FETCH_COLUMN);

        return $row;
    }

    /**
     * Updates the given profile fields (already schema-validated). Empty strings clear a field.
     *
     * @param array{id: int, organisation_id: int, ...} $user
     * @param array<string, mixed> $fields
     */
    public function update(array $user, array $fields): void
    {
        $values = self::clean($fields);
        if ($values === []) {
            return;
        }
        Transaction::run($this->pdo, function () use ($user, $values): void {
            $this->ensureRow($user);
            $set = implode(', ', array_map(fn (string $c): string => "$c = ?", array_keys($values)));
            $this->pdo->prepare("UPDATE career_profile SET $set, updated_at = UTC_TIMESTAMP(3) WHERE user_id = ?")
                ->execute([...array_values($values), $user['id']]);
        });
    }

    /**
     * Replaces jobs, education and skills (each only when given) and the fields, in one transaction.
     *
     * @param array{id: int, organisation_id: int, ...} $user
     * @param array<string, mixed> $fields
     * @param list<Job>|null $jobs
     * @param list<School>|null $schools
     * @param list<string>|null $skills
     * @param 'pdf'|'manual' $source
     */
    public function save(array $user, array $fields, ?array $jobs, ?array $schools, ?array $skills, string $source): void
    {
        Transaction::run($this->pdo, function () use ($user, $fields, $jobs, $schools, $skills, $source): void {
            $this->update($user, $fields);
            $this->ensureRow($user);
            if ($jobs !== null) {
                $this->replaceJobs($user, $jobs, $source);
            }
            if ($schools !== null) {
                $this->replaceSchools($user, $schools, $source);
            }
            if ($skills !== null) {
                $this->replaceSkills($user, $skills);
            }
            if ($source === 'pdf') {
                $this->pdo->prepare('UPDATE career_profile SET last_pdf_import_at = UTC_TIMESTAMP(3) WHERE user_id = ?')
                    ->execute([$user['id']]);
                Audit::log($this->pdo, $user, 'profile.pdf_import', 'user:' . $user['id'], [
                    'jobs' => $jobs === null ? 0 : count($jobs),
                    'schools' => $schools === null ? 0 : count($schools),
                ]);
            }
        });
    }

    /**
     * An alumnus confirms what they do now (rule 11): one job_confirmation row and the current job fields.
     *
     * @param array{id: int, organisation_id: int, ...} $user
     */
    public function confirmJob(array $user, string $status, ?string $title, ?string $company): void
    {
        $title = self::text($title, 200);
        $company = self::text($company, 200);
        if (in_array($status, ['employed', 'self_employed'], true) && $title === null) {
            throw ApiError::validation('title', 'Add your job title.');
        }
        Transaction::run($this->pdo, function () use ($user, $status, $title, $company): void {
            $this->ensureRow($user);
            $this->pdo->prepare(
                'UPDATE career_profile SET employment_status = ?, current_title = ?, current_company = ?,'
                . ' job_confirmed_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE user_id = ?'
            )->execute([$status, $title, $company, $user['id']]);
            $this->pdo->prepare(
                'INSERT INTO job_confirmation (organisation_id, user_id, employment_status, title, company, confirmed_at)'
                . ' VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))'
            )->execute([$user['organisation_id'], $user['id'], $status, $title, $company]);
        });
    }

    /**
     * @param array<string, mixed> $fields
     * @return array<string, mixed>
     */
    private static function clean(array $fields): array
    {
        $values = [];
        foreach (array_intersect_key($fields, array_flip(self::FIELDS)) as $column => $value) {
            if ($column === 'graduation_year') {
                $values[$column] = is_int($value) ? $value : null;
            } elseif ($column === 'current_since') {
                $values[$column] = is_string($value) && $value !== '' ? $value . '-01' : null;
            } elseif ($column === 'personal_email') {
                $email = is_string($value) ? strtolower(trim($value)) : '';
                if ($email !== '' && QiuEmail::is($email)) {
                    throw ApiError::validation('personal_email', 'Use a personal email, not your QIU email.');
                }
                $values[$column] = $email === '' ? null : $email;
            } elseif ($column === 'employment_status') {
                $values[$column] = is_string($value) ? $value : 'unknown';
            } else {
                $values[$column] = self::text($value, $column === 'about' ? 5000 : 300);
            }
        }

        return $values;
    }

    private static function text(mixed $value, int $max): ?string
    {
        $text = is_string($value) ? trim($value) : '';

        return $text === '' ? null : mb_substr($text, 0, $max);
    }

    /** @param array{id: int, organisation_id: int, ...} $user */
    private function ensureRow(array $user): void
    {
        $this->pdo->prepare('INSERT IGNORE INTO career_profile (user_id, organisation_id) VALUES (?, ?)')
            ->execute([$user['id'], $user['organisation_id']]);
    }

    /**
     * @param array{id: int, organisation_id: int, ...} $user
     * @param list<Job> $jobs
     */
    private function replaceJobs(array $user, array $jobs, string $source): void
    {
        $this->pdo->prepare('DELETE FROM career_experience WHERE user_id = ?')->execute([$user['id']]);
        $insert = $this->pdo->prepare(
            'INSERT INTO career_experience (organisation_id, user_id, title, company, location, start_month,'
            . ' end_month, description, source, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($jobs as $i => $job) {
            $insert->execute([
                $user['organisation_id'], $user['id'],
                self::text($job['title'], 200) ?? throw ApiError::validation("experience.$i.title"),
                self::text($job['company'], 200) ?? throw ApiError::validation("experience.$i.company"),
                self::text($job['location'] ?? null, 200),
                self::month($job['start'] ?? null),
                self::month($job['end'] ?? null),
                self::text($job['description'] ?? null, 2000),
                $source,
                $i,
            ]);
        }
    }

    /**
     * @param array{id: int, organisation_id: int, ...} $user
     * @param list<School> $schools
     */
    private function replaceSchools(array $user, array $schools, string $source): void
    {
        $this->pdo->prepare('DELETE FROM career_education WHERE user_id = ?')->execute([$user['id']]);
        $insert = $this->pdo->prepare(
            'INSERT INTO career_education (organisation_id, user_id, school, degree, field, start_year, end_year,'
            . ' source, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($schools as $i => $school) {
            $insert->execute([
                $user['organisation_id'], $user['id'],
                self::text($school['school'], 200) ?? throw ApiError::validation("education.$i.school"),
                self::text($school['degree'] ?? null, 200),
                self::text($school['field'] ?? null, 200),
                $school['start_year'] ?? null,
                $school['end_year'] ?? null,
                $source,
                $i,
            ]);
        }
    }

    /**
     * @param array{id: int, organisation_id: int, ...} $user
     * @param list<string> $skills
     */
    private function replaceSkills(array $user, array $skills): void
    {
        $this->pdo->prepare('DELETE FROM career_skill WHERE user_id = ?')->execute([$user['id']]);
        $insert = $this->pdo->prepare('INSERT IGNORE INTO career_skill (organisation_id, user_id, skill) VALUES (?, ?, ?)');
        foreach ($skills as $skill) {
            $name = self::text($skill, 80);
            if ($name !== null) {
                $insert->execute([$user['organisation_id'], $user['id'], $name]);
            }
        }
    }

    /** "2025-06" to the first day of that month; anything else is no date. */
    private static function month(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/D', $value) === 1 ? $value . '-01' : null;
    }
}
