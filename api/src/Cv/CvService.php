<?php

declare(strict_types=1);

namespace Cpdc\Cv;

use Cpdc\Profile\ProfileService;
use PDO;

/**
 * The person's CV: the career profile (jobs, education, skills, read live) plus what the CV adds, kept in
 * cv_document. A person reads and writes only their own CV; there is no id in the API.
 *
 * @phpstan-type Content array{contact: array{email: string, phone: string, location: string, website: string},
 *     headline: string, summary: string, hidden_experience: list<int>, hidden_education: list<int>,
 *     show_skills: bool, sections: list<array{title: string, items: list<array{heading: string, sub?: string,
 *     period?: string, detail?: string}>}>}
 */
final class CvService
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @param array{id: int, organisation_id: int, ...} $user
     * @return array{profile: array<string, mixed>, cv: Content, saved_at: string|null}
     */
    public function get(array $user): array
    {
        $profile = (new ProfileService($this->pdo))->get($user['organisation_id'], $user['id']);
        $stmt = $this->pdo->prepare(
            'SELECT content_json, updated_at FROM cv_document WHERE user_id = ? AND organisation_id = ?'
        );
        $stmt->execute([$user['id'], $user['organisation_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        /** @var Content|null $saved */
        $saved = is_array($row) ? json_decode((string) $row['content_json'], true, 16, JSON_THROW_ON_ERROR) : null;

        return [
            'profile' => self::profilePart($profile),
            'cv' => $saved ?? self::defaults($profile),
            'saved_at' => is_array($row)
                ? gmdate('Y-m-d\TH:i:s\Z', (int) strtotime($row['updated_at'] . ' UTC'))
                : null,
        ];
    }

    /**
     * Stores the CV (already schema-validated). Text is trimmed; hidden ids that are not the person's own
     * profile entries are dropped; empty sections and items are left out.
     *
     * @param array{id: int, organisation_id: int, ...} $user
     * @param Content $content
     */
    public function save(array $user, array $content): void
    {
        $this->pdo->prepare(
            'INSERT INTO cv_document (user_id, organisation_id, content_json, updated_at)'
            . ' VALUES (?, ?, ?, UTC_TIMESTAMP(3))'
            . ' ON DUPLICATE KEY UPDATE content_json = VALUES(content_json), updated_at = UTC_TIMESTAMP(3)'
        )->execute([
            $user['id'],
            $user['organisation_id'],
            json_encode($this->clean($user, $content), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
        ]);
    }

    /**
     * @param array{id: int, organisation_id: int, ...} $user
     * @param Content $content
     * @return Content
     */
    private function clean(array $user, array $content): array
    {
        $sections = [];
        foreach ($content['sections'] as $section) {
            $items = [];
            foreach ($section['items'] as $item) {
                $heading = trim($item['heading']);
                if ($heading !== '') {
                    $items[] = [
                        'heading' => $heading,
                        'sub' => trim($item['sub'] ?? ''),
                        'period' => trim($item['period'] ?? ''),
                        'detail' => trim($item['detail'] ?? ''),
                    ];
                }
            }
            $title = trim($section['title']);
            if ($title !== '') {
                $sections[] = ['title' => $title, 'items' => $items];
            }
        }

        return [
            'contact' => array_map('trim', $content['contact']),
            'headline' => trim($content['headline']),
            'summary' => trim($content['summary']),
            'hidden_experience' => $this->own('career_experience', $user['id'], $content['hidden_experience']),
            'hidden_education' => $this->own('career_education', $user['id'], $content['hidden_education']),
            'show_skills' => $content['show_skills'],
            'sections' => $sections,
        ];
    }

    /**
     * What a CV starts with before the first save: the profile's headline, about, location and email.
     *
     * @param array<string, mixed> $profile
     * @return Content
     */
    public static function defaults(array $profile): array
    {
        return [
            'contact' => [
                'email' => (string) ($profile['personal_email'] ?? $profile['email'] ?? ''),
                'phone' => '',
                'location' => (string) ($profile['location'] ?? ''),
                'website' => '',
            ],
            'headline' => (string) ($profile['headline'] ?? ''),
            'summary' => (string) ($profile['about'] ?? ''),
            'hidden_experience' => [],
            'hidden_education' => [],
            'show_skills' => true,
            'sections' => [],
        ];
    }

    /**
     * @param array<string, mixed> $profile
     * @return array<string, mixed>
     */
    private static function profilePart(array $profile): array
    {
        return array_intersect_key($profile, array_flip([
            'display_name', 'email', 'personal_email', 'headline', 'about', 'location', 'linkedin_url', 'github_url',
            'faculty', 'programme', 'graduation_year', 'experience', 'education', 'skills',
        ]));
    }

    /**
     * @param 'career_experience'|'career_education' $table
     * @param list<int> $ids
     * @return list<int>
     */
    private function own(string $table, int $userId, array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        $marks = implode(', ', array_fill(0, count($ids), '?'));
        $stmt = $this->pdo->prepare("SELECT id FROM $table WHERE user_id = ? AND id IN ($marks) ORDER BY id");
        $stmt->execute([$userId, ...$ids]);

        return array_values(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN)));
    }
}
