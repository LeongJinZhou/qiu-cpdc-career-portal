<?php

declare(strict_types=1);

namespace Cpdc\Network;

use Cpdc\Http\Paginator;
use PDO;

/**
 * The opt-in alumni directory. Only active alumni with network_profile.visible = 1 are listed, and each field is
 * returned (and searchable) only when its show_* flag is set. The name always links to LinkedIn (SPEC rule 13).
 *
 * @phpstan-type Filters array{q?: string, faculty?: string, year?: int, mentors?: string}
 */
final class DirectoryService
{
    public const FLAGS = ['visible', 'show_title', 'show_company', 'show_faculty', 'show_year'];

    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @param Filters $filters
     * @return array{items: list<mixed>, page: int, per_page: int, total: int}
     */
    public function list(int $org, array $filters, Paginator $page, string $monthStart): array
    {
        [$where, $args] = $this->where($org, $filters);
        $from = ' FROM network_profile n JOIN `user` u ON u.id = n.user_id AND u.organisation_id = n.organisation_id'
            . ' LEFT JOIN career_profile p ON p.user_id = u.id'
            . ' LEFT JOIN linkedin_account l ON l.user_id = u.id'
            . ' LEFT JOIN mentor_offer m ON m.user_id = u.id AND m.active = 1';
        $count = $this->pdo->prepare('SELECT COUNT(*)' . $from . $where);
        $count->execute($args);

        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.display_name, l.profile_url AS linkedin_url,'
            . ' IF(n.show_title, p.current_title, NULL) AS title,'
            . ' IF(n.show_company, p.current_company, NULL) AS company,'
            . ' IF(n.show_faculty, COALESCE(p.faculty, u.department), NULL) AS faculty,'
            . ' IF(n.show_year, p.graduation_year, NULL) AS graduation_year,'
            . ' m.topics_json, m.slots_per_month,'
            . " (SELECT COUNT(*) FROM mentor_request r WHERE r.mentor_id = u.id AND r.status = 'accepted'"
            . ' AND r.decided_at >= ?) AS taken'
            . $from . $where
            . ' ORDER BY u.display_name, u.id LIMIT ' . $page->perPage . ' OFFSET ' . $page->offset()
        );
        $stmt->execute([$monthStart, ...$args]);
        $items = array_values(array_map(static function (array $r): array {
            $mentor = null;
            if ($r['topics_json'] !== null) {
                $slots = (int) $r['slots_per_month'];
                $mentor = [
                    'topics' => json_decode((string) $r['topics_json'], true),
                    'slots_left' => max(0, $slots - (int) $r['taken']),
                ];
            }

            return [
                'id' => (int) $r['id'],
                'display_name' => (string) $r['display_name'],
                'linkedin_url' => $r['linkedin_url'],
                'title' => $r['title'],
                'company' => $r['company'],
                'faculty' => $r['faculty'],
                'graduation_year' => $r['graduation_year'] === null ? null : (int) $r['graduation_year'],
                'mentor' => $mentor,
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC)));

        return $page->envelope($items, (int) $count->fetchColumn());
    }

    /**
     * The alumnus's own choices, what others would see, and their mentoring offer.
     *
     * @return array<string, mixed>
     */
    public function own(int $org, int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT u.display_name, l.profile_url AS linkedin_url, p.current_title, p.current_company,'
            . ' COALESCE(p.faculty, u.department) AS faculty, p.graduation_year,'
            . ' COALESCE(n.visible, 0) AS visible, COALESCE(n.show_title, 0) AS show_title,'
            . ' COALESCE(n.show_company, 0) AS show_company, COALESCE(n.show_faculty, 0) AS show_faculty,'
            . ' COALESCE(n.show_year, 0) AS show_year, m.active AS mentor_active, m.topics_json, m.slots_per_month'
            . ' FROM `user` u LEFT JOIN network_profile n ON n.user_id = u.id'
            . ' LEFT JOIN career_profile p ON p.user_id = u.id LEFT JOIN linkedin_account l ON l.user_id = u.id'
            . ' LEFT JOIN mentor_offer m ON m.user_id = u.id WHERE u.id = ? AND u.organisation_id = ?'
        );
        $stmt->execute([$userId, $org]);
        $r = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($r === false) {
            throw new \LogicException('signed-in user row is missing');
        }
        $choices = [];
        foreach (self::FLAGS as $flag) {
            $choices[$flag] = (bool) $r[$flag];
        }

        return [
            'choices' => $choices,
            'fields' => [
                'display_name' => $r['display_name'],
                'linkedin_url' => $r['linkedin_url'],
                'title' => $r['current_title'],
                'company' => $r['current_company'],
                'faculty' => $r['faculty'],
                'graduation_year' => $r['graduation_year'] === null ? null : (int) $r['graduation_year'],
            ],
            'mentoring' => $r['topics_json'] === null ? null : [
                'active' => (bool) $r['mentor_active'],
                'topics' => json_decode((string) $r['topics_json'], true),
                'slots_per_month' => (int) $r['slots_per_month'],
            ],
        ];
    }

    /**
     * Faculties that visible alumni chose to show, for the filter.
     *
     * @return list<string>
     */
    public function faculties(int $org): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT DISTINCT COALESCE(p.faculty, u.department) AS faculty FROM network_profile n'
            . ' JOIN `user` u ON u.id = n.user_id AND u.organisation_id = n.organisation_id'
            . ' LEFT JOIN career_profile p ON p.user_id = u.id'
            . " WHERE n.organisation_id = ? AND n.visible = 1 AND n.show_faculty = 1 AND u.role = 'alumni'"
            . ' AND u.active = 1 AND COALESCE(p.faculty, u.department) IS NOT NULL ORDER BY faculty'
        );
        $stmt->execute([$org]);

        return array_values(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN)));
    }

    /** @param array<string, bool> $choices validated network-profile.json */
    public function save(int $org, int $userId, array $choices): void
    {
        $values = array_map(static fn (string $flag): int => (int) $choices[$flag], self::FLAGS);
        $this->pdo->prepare(
            'INSERT INTO network_profile (user_id, organisation_id, visible, show_title, show_company, show_faculty,'
            . ' show_year, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE'
            . ' visible = VALUES(visible), show_title = VALUES(show_title), show_company = VALUES(show_company),'
            . ' show_faculty = VALUES(show_faculty), show_year = VALUES(show_year), updated_at = VALUES(updated_at)'
        )->execute([$userId, $org, ...$values]);
    }

    /**
     * @param Filters $filters
     * @return array{0: string, 1: list<mixed>}
     */
    private function where(int $org, array $filters): array
    {
        $where = " WHERE n.organisation_id = ? AND n.visible = 1 AND u.role = 'alumni' AND u.active = 1";
        $args = [$org];
        if (($filters['q'] ?? '') !== '') {
            $like = '%' . addcslashes((string) $filters['q'], '\\%_') . '%';
            $where .= ' AND (u.display_name LIKE ? OR (n.show_title = 1 AND p.current_title LIKE ?)'
                . ' OR (n.show_company = 1 AND p.current_company LIKE ?))';
            array_push($args, $like, $like, $like);
        }
        if (($filters['faculty'] ?? '') !== '') {
            $where .= ' AND n.show_faculty = 1 AND COALESCE(p.faculty, u.department) = ?';
            $args[] = $filters['faculty'];
        }
        if (isset($filters['year'])) {
            $where .= ' AND n.show_year = 1 AND p.graduation_year = ?';
            $args[] = $filters['year'];
        }
        if (($filters['mentors'] ?? '') === '1') {
            $where .= ' AND m.user_id IS NOT NULL';
        }

        return [$where, $args];
    }
}
