<?php

declare(strict_types=1);

namespace Cpdc\Auth;

/**
 * Maps the People API person to our profile columns (SPEC rule 2). Only the fixed field list is read;
 * phone numbers, locations, managers and anything else in the response are ignored.
 *
 * The directory ID (`external_id`) is a student's matric number or a staff member's employee ID; LoginService
 * stores it by role.
 *
 * @phpstan-type Profile array{display_name: string|null, picture_url: string|null, external_id: string|null,
 *     employee_type: string|null, department: string|null, job_title: string|null}
 * @phpstan-type Fields array{person: list<string>, organization: list<string>, external_id_types: list<string>}
 */
final class DirectoryProfile
{
    public const FIELDS = 'names,photos,emailAddresses,externalIds,organizations';
    /** Read mask of the directory search (GoogleOidc::directoryEntry): the admin-set fields only. */
    public const DIRECTORY_FIELDS = 'emailAddresses,externalIds,organizations';

    /**
     * people/me with the directory entry laid over it: the entry's externalIds win (people/me carries no admin-set
     * Employee ID), its organizations only fill a gap. No entry: people/me unchanged.
     *
     * @param array<mixed> $person decoded people/me response
     * @param array<mixed>|null $entry GoogleOidc::directoryEntry
     * @return array<mixed>
     */
    public static function withDirectory(array $person, ?array $entry): array
    {
        if ($entry === null) {
            return $person;
        }
        if (is_array($entry['externalIds'] ?? null) && $entry['externalIds'] !== []) {
            $person['externalIds'] = $entry['externalIds'];
        }
        if (self::primary($person, 'organizations') === [] && is_array($entry['organizations'] ?? null)) {
            $person['organizations'] = $entry['organizations'];
        }

        return $person;
    }

    /**
     * Whether a directory person lists exactly this email (case-insensitive).
     *
     * @param array<mixed> $person
     */
    public static function hasEmail(array $person, string $email): bool
    {
        foreach (is_array($person['emailAddresses'] ?? null) ? $person['emailAddresses'] : [] as $address) {
            if (
                is_array($address) && is_string($address['value'] ?? null)
                && strcasecmp(trim($address['value']), $email) === 0
            ) {
                return true;
            }
        }

        return false;
    }

    /** Most field names kept per list of fieldsSeen(). */
    private const MAX_NAMES = 50;

    /**
     * @param array<mixed> $person decoded people/me response
     * @return Profile
     */
    public static function fromPerson(array $person): array
    {
        $name = self::primary($person, 'names');
        $photo = self::primary($person, 'photos');
        $org = self::primary($person, 'organizations');
        $externalId = [];
        foreach (is_array($person['externalIds'] ?? null) ? $person['externalIds'] : [] as $id) {
            if (is_array($id) && ($id['type'] ?? null) === 'organization') {
                $externalId = $id;
                break;
            }
        }
        $url = is_string($photo['url'] ?? null) ? trim($photo['url']) : null; // never cut: a cut URL is another URL

        return [
            'display_name' => self::text($name['displayName'] ?? null, 200),
            'picture_url' => $url !== null && self::photoAllowed($url) ? $url : null,
            'external_id' => self::text($externalId['value'] ?? null, 64),
            // shortcut: employee type read from organizations.jobDescription; confirm with B1 (real account test).
            'employee_type' => self::text($org['jobDescription'] ?? null, 64),
            'department' => self::text($org['department'] ?? null, 200),
            'job_title' => self::text($org['title'] ?? null, 200),
        ];
    }

    /**
     * Which directory fields Google returned, as names only (employee ID evidence): the top-level person keys,
     * the keys of the primary organizations entry, and the `type` names found in externalIds. Never a value.
     * Only plain identifiers are kept, at most MAX_NAMES per list, sorted.
     *
     * @param array<mixed> $person decoded people/me response
     * @return Fields
     */
    public static function fieldsSeen(array $person): array
    {
        $types = [];
        foreach (is_array($person['externalIds'] ?? null) ? $person['externalIds'] : [] as $id) {
            $types[] = is_array($id) ? ($id['type'] ?? null) : null;
        }

        return [
            'person' => self::names(array_keys($person)),
            'organization' => self::names(array_keys(self::primary($person, 'organizations'))),
            'external_id_types' => self::names($types),
        ];
    }

    /** https on a *.googleusercontent.com host, no userinfo, no port, a path, no quote/space/backslash (rule 8). */
    public static function photoAllowed(string $url): bool
    {
        return strlen($url) <= 500
            && preg_match('#^https://([a-z0-9-]+\.)+googleusercontent\.com/[^\s"\'<>\\\\]*$#Di', $url) === 1;
    }

    /**
     * @param array<mixed> $person
     * @return array<mixed> the entry marked primary, else the first
     */
    private static function primary(array $person, string $field): array
    {
        $entries = is_array($person[$field] ?? null) ? array_values(array_filter($person[$field], 'is_array')) : [];
        foreach ($entries as $entry) {
            if (($entry['metadata']['primary'] ?? false) === true) {
                return $entry;
            }
        }

        return $entries[0] ?? [];
    }

    /**
     * @param array<mixed> $candidates
     * @return list<string> unique plain identifiers (a letter, then up to 63 letters, digits or _), sorted
     */
    private static function names(array $candidates): array
    {
        $names = array_filter(
            $candidates,
            fn ($n) => is_string($n) && preg_match('/^[A-Za-z][A-Za-z0-9_]{0,63}$/D', $n) === 1
        );
        $names = array_values(array_unique($names));
        sort($names);

        return array_slice($names, 0, self::MAX_NAMES);
    }

    private static function text(mixed $value, int $max): ?string
    {
        $value = is_string($value) ? trim($value) : '';

        return $value === '' ? null : mb_substr($value, 0, $max);
    }
}
