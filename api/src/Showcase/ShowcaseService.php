<?php

declare(strict_types=1);

namespace Cpdc\Showcase;

use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use Cpdc\Http\UploadedFile;
use PDO;

/**
 * Final-year projects: the student's own (one each) and the talent feed of published ones (docs/SPEC.md section 9).
 * A draft is seen only by its student; the feed and project pages show published projects only.
 */
final class ShowcaseService
{
    private const SELECT = 'SELECT p.id, p.student_id, p.title, p.summary, p.faculty, p.project_year, p.repo_url,'
        . ' p.demo_url, p.image_name, p.published, p.published_at, p.updated_at, u.display_name, u.picture_url,'
        . ' l.profile_url AS linkedin_url FROM showcase_project p JOIN `user` u ON u.id = p.student_id'
        . ' LEFT JOIN linkedin_account l ON l.user_id = u.id';

    /** @param string $imageDir STORAGE_DIR/showcase, outside the web root */
    public function __construct(private readonly PDO $pdo, private readonly string $imageDir)
    {
    }

    /** @return array<string, mixed>|null */
    public function mine(int $org, int $studentId): ?array
    {
        $stmt = $this->pdo->prepare(self::SELECT . ' WHERE p.student_id = ? AND p.organisation_id = ?');
        $stmt->execute([$studentId, $org]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $this->shape($row, $this->tech([(int) $row['id']])) : null;
    }

    /**
     * Creates or replaces the student's project. Faculty comes from the directory, never from the request.
     *
     * @param array{id: int, organisation_id: int, ...} $student
     * @param array{title: string, summary: string, tech: list<string>, project_year: int, repo_url?: string,
     *     demo_url?: string, published: bool} $body
     * @return array<string, mixed>
     */
    public function save(array $student, array $body): array
    {
        $org = $student['organisation_id'];
        $id = $student['id'];
        $repo = self::httpsUrl('repo_url', $body['repo_url'] ?? '');
        $demo = self::httpsUrl('demo_url', $body['demo_url'] ?? '');
        $tech = self::tags($body['tech']);
        Transaction::run($this->pdo, function () use ($org, $id, $body, $repo, $demo, $tech): void {
            $faculty = $this->pdo->prepare('SELECT department FROM `user` WHERE id = ? AND organisation_id = ?');
            $faculty->execute([$id, $org]);
            $values = [trim($body['title']), trim($body['summary']), $faculty->fetchColumn() ?: null,
                $body['project_year'], $repo, $demo, (int) $body['published']];
            $this->pdo->prepare(
                'INSERT INTO showcase_project (organisation_id, student_id, title, summary, faculty, project_year,'
                . ' repo_url, demo_url, published, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,'
                . ' IF(? = 1, UTC_TIMESTAMP(3), NULL)) ON DUPLICATE KEY UPDATE title = VALUES(title),'
                . ' summary = VALUES(summary), faculty = VALUES(faculty), project_year = VALUES(project_year),'
                . ' repo_url = VALUES(repo_url), demo_url = VALUES(demo_url),'
                // First publish stamps the date; unpublishing clears it; staying published keeps it.
                . ' published_at = IF(VALUES(published) = 1, COALESCE(published_at, UTC_TIMESTAMP(3)), NULL),'
                . ' published = VALUES(published), updated_at = UTC_TIMESTAMP(3)'
            )->execute([$org, $id, ...$values, (int) $body['published']]);
            $projectId = $this->projectId($org, $id);
            $this->pdo->prepare('DELETE FROM showcase_tech WHERE project_id = ?')->execute([$projectId]);
            $insert = $this->pdo->prepare(
                'INSERT INTO showcase_tech (project_id, organisation_id, tech) VALUES (?, ?, ?)'
            );
            foreach ($tech as $t) {
                $insert->execute([$projectId, $org, $t]);
            }
        });

        return $this->mine($org, $id) ?? throw new \LogicException('project vanished');
    }

    /**
     * Stores a checked image for the student's project, replacing the old file.
     *
     * @param array{id: int, organisation_id: int, ...} $student
     * @return array<string, mixed>
     */
    public function setImage(array $student, ?UploadedFile $file, int $maxBytes): array
    {
        $org = $student['organisation_id'];
        $type = ImageCheck::check($file, $maxBytes);
        $projectId = $this->projectId($org, $student['id']);
        if (!is_dir($this->imageDir) && !@mkdir($this->imageDir, 0700, true) && !is_dir($this->imageDir)) {
            throw new \RuntimeException('showcase image folder cannot be created');
        }
        $name = ImageCheck::storedName($type['ext']);
        if (!copy($type['path'], $this->imageDir . '/' . $name)) {
            throw new \RuntimeException('showcase image cannot be stored');
        }
        @unlink($type['path']);
        $old = $this->swapImage($projectId, $name, $type['mime']);
        $this->deleteFile($old);

        return $this->mine($org, $student['id']) ?? throw new \LogicException('project vanished');
    }

    /**
     * @param array{id: int, organisation_id: int, ...} $student
     * @return array<string, mixed>
     */
    public function removeImage(array $student): array
    {
        $projectId = $this->projectId($student['organisation_id'], $student['id']);
        $this->deleteFile($this->swapImage($projectId, null, null));

        return $this->mine($student['organisation_id'], $student['id'])
            ?? throw new \LogicException('project vanished');
    }

    /**
     * The talent feed: published projects, newest first.
     *
     * @param array<mixed> $query validated showcase.query.json
     * @return array{rows: list<array<string, mixed>>, total: int}
     */
    public function feed(int $org, array $query, int $limit, int $offset): array
    {
        $where = 'p.organisation_id = ? AND p.published = 1';
        $args = [$org];
        if (($query['q'] ?? '') !== '') {
            $like = '%' . addcslashes((string) $query['q'], '%_\\') . '%';
            $where .= ' AND (p.title LIKE ? OR p.summary LIKE ? OR u.display_name LIKE ?)';
            array_push($args, $like, $like, $like);
        }
        if (($query['tech'] ?? '') !== '') {
            $where .= ' AND EXISTS (SELECT 1 FROM showcase_tech t WHERE t.project_id = p.id AND t.tech = ?)';
            $args[] = $query['tech'];
        }
        if (($query['faculty'] ?? '') !== '') {
            $where .= ' AND p.faculty = ?';
            $args[] = $query['faculty'];
        }
        if (isset($query['year'])) {
            $where .= ' AND p.project_year = ?';
            $args[] = $query['year'];
        }
        $count = $this->pdo->prepare(
            "SELECT COUNT(*) FROM showcase_project p JOIN `user` u ON u.id = p.student_id WHERE $where"
        );
        $count->execute($args);
        $stmt = $this->pdo->prepare(
            self::SELECT . " WHERE $where ORDER BY p.published_at DESC, p.id DESC LIMIT $limit OFFSET $offset"
        );
        $stmt->execute($args);
        $rows = array_values($stmt->fetchAll(PDO::FETCH_ASSOC));
        $tech = $this->tech(array_map(static fn (array $r): int => (int) $r['id'], $rows));

        return [
            'rows' => array_map(fn (array $r): array => $this->shape($r, $tech), $rows),
            'total' => (int) $count->fetchColumn(),
        ];
    }

    /** @return array{tech: list<array{tech: string, count: int}>, faculties: list<string>, years: list<int>} */
    public function filters(int $org): array
    {
        $tech = $this->pdo->prepare(
            'SELECT t.tech, COUNT(*) AS n FROM showcase_tech t JOIN showcase_project p ON p.id = t.project_id'
            . ' WHERE p.organisation_id = ? AND p.published = 1 GROUP BY t.tech ORDER BY n DESC, t.tech LIMIT 40'
        );
        $tech->execute([$org]);
        $faculties = $this->pdo->prepare(
            'SELECT DISTINCT faculty FROM showcase_project WHERE organisation_id = ? AND published = 1'
            . ' AND faculty IS NOT NULL ORDER BY faculty'
        );
        $faculties->execute([$org]);
        $years = $this->pdo->prepare(
            'SELECT DISTINCT project_year FROM showcase_project WHERE organisation_id = ? AND published = 1'
            . ' ORDER BY project_year DESC'
        );
        $years->execute([$org]);

        return [
            'tech' => array_values(array_map(
                static fn (array $r): array => ['tech' => (string) $r['tech'], 'count' => (int) $r['n']],
                $tech->fetchAll(PDO::FETCH_ASSOC)
            )),
            'faculties' => array_values(array_map('strval', $faculties->fetchAll(PDO::FETCH_COLUMN))),
            'years' => array_values(array_map('intval', $years->fetchAll(PDO::FETCH_COLUMN))),
        ];
    }

    /**
     * A project the viewer may see: their own, or (with $browse, the talent feed permission) any published one.
     *
     * @return array<string, mixed>
     */
    public function show(int $org, int $projectId, int $viewerId, bool $browse): array
    {
        $row = $this->visible($org, $projectId, $viewerId, $browse);

        return $this->shape($row, $this->tech([$projectId]));
    }

    /** @return array{path: string, mime: string} the image file of a project the viewer may see */
    public function image(int $org, int $projectId, int $viewerId, bool $browse): array
    {
        $row = $this->visible($org, $projectId, $viewerId, $browse);
        $stmt = $this->pdo->prepare('SELECT image_type FROM showcase_project WHERE id = ?');
        $stmt->execute([$projectId]);
        $mime = (string) $stmt->fetchColumn();
        $name = (string) ($row['image_name'] ?? '');
        $path = $this->imageDir . '/' . $name;
        if (
            !ImageCheck::isStoredName($name) || !in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)
            || !is_file($path)
        ) {
            throw new ApiError(404, 'NOT_FOUND', 'Not found.');
        }

        return ['path' => $path, 'mime' => $mime];
    }

    /**
     * Tags as typed, trimmed, one space inside, first spelling kept when two differ only in case.
     *
     * @param list<string> $tags
     * @return list<string>
     */
    public static function tags(array $tags): array
    {
        $out = [];
        foreach ($tags as $tag) {
            $tag = trim((string) preg_replace('/\s+/u', ' ', $tag));
            if ($tag !== '' && !isset($out[mb_strtolower($tag)])) {
                $out[mb_strtolower($tag)] = $tag;
            }
        }

        return array_values($out);
    }

    /** '' = no link; otherwise an https URL with a host, or a 400 naming the field. */
    public static function httpsUrl(string $field, string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }
        $parts = parse_url($url);
        if (
            filter_var($url, FILTER_VALIDATE_URL) === false || !is_array($parts)
            || strtolower($parts['scheme'] ?? '') !== 'https' || ($parts['host'] ?? '') === ''
            || isset($parts['user']) || isset($parts['pass'])
        ) {
            throw ApiError::validation($field, 'Use a full https:// link.');
        }

        return $url;
    }

    /** @return array<string, mixed> */
    private function visible(int $org, int $projectId, int $viewerId, bool $browse): array
    {
        $stmt = $this->pdo->prepare(
            self::SELECT . ' WHERE p.id = ? AND p.organisation_id = ?'
            . ' AND ((p.published = 1 AND ? = 1) OR p.student_id = ?)'
        );
        $stmt->execute([$projectId, $org, (int) $browse, $viewerId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : throw new ApiError(404, 'NOT_FOUND', 'Not found.');
    }

    private function projectId(int $org, int $studentId): int
    {
        $stmt = $this->pdo->prepare('SELECT id FROM showcase_project WHERE student_id = ? AND organisation_id = ?');
        $stmt->execute([$studentId, $org]);
        $id = $stmt->fetchColumn();

        return $id === false ? throw new ApiError(409, 'NO_PROJECT', 'Save your project first.') : (int) $id;
    }

    /** @return string|null the old stored name */
    private function swapImage(int $projectId, ?string $name, ?string $mime): ?string
    {
        return Transaction::run($this->pdo, function () use ($projectId, $name, $mime): ?string {
            $old = $this->pdo->prepare('SELECT image_name FROM showcase_project WHERE id = ? FOR UPDATE');
            $old->execute([$projectId]);
            $previous = $old->fetchColumn();
            $this->pdo->prepare(
                'UPDATE showcase_project SET image_name = ?, image_type = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?'
            )->execute([$name, $mime, $projectId]);

            return is_string($previous) ? $previous : null;
        });
    }

    private function deleteFile(?string $name): void
    {
        if ($name !== null && ImageCheck::isStoredName($name)) {
            @unlink($this->imageDir . '/' . $name);
        }
    }

    /**
     * @param list<int> $projectIds
     * @return array<int, list<string>>
     */
    private function tech(array $projectIds): array
    {
        if ($projectIds === []) {
            return [];
        }
        $marks = implode(',', array_fill(0, count($projectIds), '?'));
        $stmt = $this->pdo->prepare(
            "SELECT project_id, tech FROM showcase_tech WHERE project_id IN ($marks) ORDER BY tech"
        );
        $stmt->execute($projectIds);
        $out = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $out[(int) $r['project_id']][] = (string) $r['tech'];
        }

        return $out;
    }

    /**
     * @param array<string, mixed> $r
     * @param array<int, list<string>> $tech
     * @return array<string, mixed>
     */
    private function shape(array $r, array $tech): array
    {
        $id = (int) $r['id'];
        $image = is_string($r['image_name']) ? $r['image_name'] : null;

        return [
            'id' => $id,
            'title' => $r['title'],
            'summary' => $r['summary'],
            'tech' => $tech[$id] ?? [],
            'project_year' => (int) $r['project_year'],
            'faculty' => $r['faculty'],
            'repo_url' => $r['repo_url'],
            'demo_url' => $r['demo_url'],
            // The version in the URL changes with the file, so a browser never shows a replaced image.
            'image_url' => $image === null ? null : "/api/showcase/$id/image?v=" . substr($image, 0, 8),
            'published' => (bool) $r['published'],
            'published_at' => $r['published_at'],
            'updated_at' => $r['updated_at'],
            'student' => [
                'id' => (int) $r['student_id'],
                'display_name' => $r['display_name'],
                'picture_url' => $r['picture_url'],
                'linkedin_url' => $r['linkedin_url'],
            ],
        ];
    }
}
