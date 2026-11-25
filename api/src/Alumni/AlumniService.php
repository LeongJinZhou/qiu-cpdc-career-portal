<?php

declare(strict_types=1);

namespace Cpdc\Alumni;

use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use Cpdc\Http\Paginator;
use PDO;

/**
 * The alumni tracker (docs/SPEC.md rules 10, 13, 14 and the employment rate definition in section 6).
 *
 * @phpstan-type Filters array{q?: string, faculty?: string, year?: int, status?: string, linkedin?: string}
 */
final class AlumniService
{
    /** Counted as "in work or study" for the employment rate. */
    public const EMPLOYED = ['employed', 'self_employed', 'further_study'];

    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @param Filters $filters
     * @return array{items: list<array<string, mixed>>, page: int, per_page: int, total: int}
     */
    public function list(int $org, array $filters, Paginator $page): array
    {
        [$where, $args] = self::where($org, $filters);
        $count = $this->pdo->prepare("SELECT COUNT(*) FROM `user` u LEFT JOIN career_profile p ON p.user_id = u.id"
            . " LEFT JOIN linkedin_account l ON l.user_id = u.id WHERE $where");
        $count->execute($args);
        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.display_name, u.matric_no, u.picture_url, u.last_sign_in_at,'
            . ' COALESCE(p.faculty, u.department) AS faculty, p.programme, p.graduation_year, p.employment_status,'
            . ' p.current_title, p.current_company, p.location, p.personal_email, p.job_confirmed_at,'
            . ' l.profile_url AS linkedin_url, (l.user_id IS NOT NULL) AS linkedin_linked'
            . ' FROM `user` u LEFT JOIN career_profile p ON p.user_id = u.id'
            . " LEFT JOIN linkedin_account l ON l.user_id = u.id WHERE $where"
            . ' ORDER BY p.graduation_year DESC, u.display_name, u.id LIMIT ' . $page->perPage
            . ' OFFSET ' . $page->offset()
        );
        $stmt->execute($args);
        $rows = array_values(array_map([self::class, 'row'], $stmt->fetchAll(PDO::FETCH_ASSOC)));

        return $page->envelope($rows, (int) $count->fetchColumn());
    }

    /**
     * Every alumnus matching the filters, for the CSV (no paging; the tracker is one university's alumni).
     *
     * @param Filters $filters
     * @return list<array<string, mixed>>
     */
    public function all(int $org, array $filters): array
    {
        [$where, $args] = self::where($org, $filters);
        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.display_name, u.matric_no, COALESCE(p.faculty, u.department) AS faculty, p.programme,'
            . ' p.graduation_year, p.employment_status, p.current_title, p.current_company, p.location,'
            . ' p.personal_email, p.job_confirmed_at, l.profile_url AS linkedin_url,'
            . ' (l.user_id IS NOT NULL) AS linkedin_linked, u.last_sign_in_at, u.picture_url'
            . ' FROM `user` u LEFT JOIN career_profile p ON p.user_id = u.id'
            . " LEFT JOIN linkedin_account l ON l.user_id = u.id WHERE $where"
            . ' ORDER BY p.graduation_year DESC, u.display_name, u.id'
        );
        $stmt->execute($args);

        return array_values(array_map([self::class, 'row'], $stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    /**
     * Employment rate per faculty and graduation year: (employed + self employed + further study) over alumni
     * whose status is known; unknown counted on its own.
     *
     * @return list<array{faculty: string, graduation_year: int|null, alumni: int, known: int, in_work_or_study: int,
     *     unknown: int, linkedin_linked: int, rate: float|null}>
     */
    public function stats(int $org): array
    {
        $employed = "'" . implode("', '", self::EMPLOYED) . "'";
        $stmt = $this->pdo->prepare(
            "SELECT COALESCE(p.faculty, u.department, 'Not set') AS faculty, p.graduation_year, COUNT(*) AS alumni,"
            . " SUM(COALESCE(p.employment_status, 'unknown') <> 'unknown') AS known,"
            . " SUM(p.employment_status IN ($employed)) AS in_work_or_study,"
            . " SUM(COALESCE(p.employment_status, 'unknown') = 'unknown') AS unknown,"
            . ' SUM(l.user_id IS NOT NULL) AS linkedin_linked'
            . ' FROM `user` u LEFT JOIN career_profile p ON p.user_id = u.id'
            . ' LEFT JOIN linkedin_account l ON l.user_id = u.id'
            . " WHERE u.organisation_id = ? AND u.role = 'alumni' AND u.active = 1"
            . ' GROUP BY 1, 2 ORDER BY 2 DESC, 1'
        );
        $stmt->execute([$org]);

        return array_values(array_map(static function (array $r): array {
            $known = (int) $r['known'];

            return [
                'faculty' => (string) $r['faculty'],
                'graduation_year' => $r['graduation_year'] === null ? null : (int) $r['graduation_year'],
                'alumni' => (int) $r['alumni'],
                'known' => $known,
                'in_work_or_study' => (int) $r['in_work_or_study'],
                'unknown' => (int) $r['unknown'],
                'linkedin_linked' => (int) $r['linkedin_linked'],
                'rate' => $known === 0 ? null : round((int) $r['in_work_or_study'] / $known, 3),
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    /**
     * Makes a student an alumnus (rule 10). Everything they entered stays. Returns whether they can still sign in
     * after graduation (a linked LinkedIn).
     *
     * @param array{id: int, organisation_id: int, ...} $admin
     * @return array{user_id: int, linkedin_linked: bool}
     */
    public function convert(array $admin, int $userId, int $graduationYear): array
    {
        return Transaction::run($this->pdo, function () use ($admin, $userId, $graduationYear): array {
            $stmt = $this->pdo->prepare(
                'SELECT u.role, u.department, (l.user_id IS NOT NULL) AS linked FROM `user` u'
                . ' LEFT JOIN linkedin_account l ON l.user_id = u.id'
                . ' WHERE u.id = ? AND u.organisation_id = ? FOR UPDATE'
            );
            $stmt->execute([$userId, $admin['organisation_id']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                throw new ApiError(404, 'NOT_FOUND', 'Not found.');
            }
            if (!in_array($row['role'], ['student', 'alumni'], true)) {
                throw new ApiError(409, 'NOT_A_STUDENT', 'Only a student can become an alumnus.');
            }
            $this->pdo->prepare(
                "UPDATE `user` SET role = 'alumni', alumni_since = COALESCE(alumni_since, UTC_TIMESTAMP(3)),"
                . ' updated_at = UTC_TIMESTAMP(3) WHERE id = ?'
            )->execute([$userId]);
            $this->pdo->prepare(
                'INSERT INTO career_profile (user_id, organisation_id, faculty, graduation_year) VALUES (?, ?, ?, ?)'
                . ' ON DUPLICATE KEY UPDATE faculty = COALESCE(faculty, VALUES(faculty)),'
                . ' graduation_year = VALUES(graduation_year)'
            )->execute([$userId, $admin['organisation_id'], $row['department'], $graduationYear]);
            if ($row['role'] !== 'alumni') {
                Audit::log($this->pdo, $admin, 'alumni.convert', 'user:' . $userId, [
                    'graduation_year' => $graduationYear, 'linkedin_linked' => (bool) $row['linked'],
                ]);
            }

            return ['user_id' => $userId, 'linkedin_linked' => (bool) $row['linked']];
        });
    }

    /**
     * Converts a list of matric numbers. Each row reports: converted, no LinkedIn (converted, but cannot sign in
     * after graduation), not found or not a student.
     *
     * @param array{id: int, organisation_id: int, ...} $admin
     * @param list<array{matric_no: string, graduation_year: int}> $rows
     * @return list<array{matric_no: string, result: string}>
     */
    public function convertList(array $admin, array $rows): array
    {
        $find = $this->pdo->prepare('SELECT id FROM `user` WHERE organisation_id = ? AND matric_no = ?');
        $results = [];
        foreach ($rows as $row) {
            $matric = strtoupper(trim($row['matric_no']));
            $find->execute([$admin['organisation_id'], $matric]);
            $id = $find->fetchColumn();
            if ($id === false) {
                $results[] = ['matric_no' => $matric, 'result' => 'not_found'];
                continue;
            }
            try {
                $done = $this->convert($admin, (int) $id, $row['graduation_year']);
                $results[] = [
                    'matric_no' => $matric,
                    'result' => $done['linkedin_linked'] ? 'converted' : 'no_linkedin',
                ];
            } catch (ApiError $e) {
                $results[] = [
                    'matric_no' => $matric,
                    'result' => $e->errorCode === 'NOT_A_STUDENT' ? 'not_student' : 'failed',
                ];
            }
        }

        return $results;
    }

    /**
     * @param Filters $filters
     * @return array{0: string, 1: list<mixed>}
     */
    private static function where(int $org, array $filters): array
    {
        $where = "u.organisation_id = ? AND u.role = 'alumni' AND u.active = 1";
        $args = [$org];
        if (($filters['q'] ?? '') !== '') {
            $like = '%' . addcslashes((string) $filters['q'], '%_\\') . '%';
            $where .= ' AND (u.display_name LIKE ? OR u.matric_no LIKE ? OR p.current_company LIKE ?'
                . ' OR p.current_title LIKE ?)';
            array_push($args, $like, $like, $like, $like);
        }
        if (($filters['faculty'] ?? '') !== '') {
            $where .= ' AND COALESCE(p.faculty, u.department) = ?';
            $args[] = $filters['faculty'];
        }
        if (isset($filters['year'])) {
            $where .= ' AND p.graduation_year = ?';
            $args[] = $filters['year'];
        }
        if (isset($filters['status'])) {
            $where .= " AND COALESCE(p.employment_status, 'unknown') = ?";
            $args[] = $filters['status'];
        }
        if (($filters['linkedin'] ?? null) === 'linked') {
            $where .= ' AND l.user_id IS NOT NULL';
        } elseif (($filters['linkedin'] ?? null) === 'missing') {
            $where .= ' AND l.user_id IS NULL';
        }

        return [$where, $args];
    }

    /**
     * @param array<string, mixed> $r
     * @return array<string, mixed>
     */
    private static function row(array $r): array
    {
        $r['id'] = (int) $r['id'];
        $r['graduation_year'] = $r['graduation_year'] === null ? null : (int) $r['graduation_year'];
        $r['employment_status'] ??= 'unknown';
        $r['linkedin_linked'] = (bool) $r['linkedin_linked'];

        return $r;
    }
}
