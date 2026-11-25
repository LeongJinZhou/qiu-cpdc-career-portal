<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Cpdc\Auth\DirectoryProfile;

final class DirectoryProfileTest extends TestCase
{
    public function testMapsTheFixedFieldsAndIgnoresPhoneLocationManagers(): void
    {
        $profile = DirectoryProfile::fromPerson([
            'names' => [
                ['displayName' => 'Other'],
                ['displayName' => ' Fake Student ', 'metadata' => ['primary' => true]],
            ],
            'photos' => [['url' => 'https://lh3.googleusercontent.com/a/x', 'metadata' => ['primary' => true]]],
            'externalIds' => [
                ['value' => 'L-1', 'type' => 'loginId'],
                ['value' => 'FAKE-S-1', 'type' => 'organization'],
            ],
            'organizations' => [
                ['department' => 'Faculty of Fake', 'title' => 'BSc Fake', 'jobDescription' => 'Student'],
            ],
            'phoneNumbers' => [['value' => '+60 3-0000 0000']],
            'locations' => [['value' => 'Fake Block F']],
            'relations' => [['person' => 'manager@example.test', 'type' => 'manager']],
        ]);

        $this->assertSame([
            'display_name' => 'Fake Student',
            'picture_url' => 'https://lh3.googleusercontent.com/a/x',
            'external_id' => 'FAKE-S-1',
            'employee_type' => 'Student',
            'department' => 'Faculty of Fake',
            'job_title' => 'BSc Fake',
        ], $profile);
    }

    public function testMissingOrMalformedFieldsBecomeNull(): void
    {
        $empty = array_fill_keys(
            ['display_name', 'picture_url', 'external_id', 'employee_type', 'department', 'job_title'],
            null
        );
        $this->assertSame($empty, DirectoryProfile::fromPerson([]));
        $this->assertSame($empty, DirectoryProfile::fromPerson([
            'names' => 'x', 'photos' => [['url' => 5]], 'externalIds' => [['value' => 'L-1', 'type' => 'loginId']],
            'organizations' => [['department' => '  ', 'title' => ['x']]],
        ]));
    }

    public function testLongValuesAreCutToTheColumnSize(): void
    {
        $profile = DirectoryProfile::fromPerson([
            'names' => [['displayName' => str_repeat('n', 300)]],
            'externalIds' => [['value' => str_repeat('i', 100), 'type' => 'organization']],
        ]);

        $this->assertSame(200, mb_strlen((string) $profile['display_name']));
        $this->assertSame(64, mb_strlen((string) $profile['external_id']));
    }

    /** @return iterable<string, array{string, bool}> */
    public static function photos(): iterable
    {
        yield 'google photo' => ['https://lh3.googleusercontent.com/a/abc=s96-c', true];
        yield 'http' => ['http://lh3.googleusercontent.com/a/abc', false];
        yield 'look-alike host' => ['https://lh3.googleusercontent.com.evil.test/a', false];
        yield 'suffix without dot' => ['https://evilgoogleusercontent.com/a', false];
        yield 'bare domain' => ['https://googleusercontent.com/a', false];
        yield 'userinfo' => ['https://lh3.googleusercontent.com@evil.test/a', false];
        yield 'userinfo before host' => ['https://evil.test@lh3.googleusercontent.com/a', false];
        yield 'port' => ['https://lh3.googleusercontent.com:8443/a', false];
        yield 'no path' => ['https://lh3.googleusercontent.com', false];
        yield 'backslash' => ['https://lh3.googleusercontent.com\\@evil.test/a', false];
        yield 'quote' => ['https://lh3.googleusercontent.com/a"onerror=x', false];
        yield 'too long' => ['https://lh3.googleusercontent.com/' . str_repeat('a', 500), false];
        yield 'javascript' => ['javascript:alert(1)//lh3.googleusercontent.com/', false];
    }

    #[DataProvider('photos')]
    public function testPhotoKeptOnlyIfHttpsOnGoogleusercontent(string $url, bool $kept): void
    {
        $this->assertSame($kept, DirectoryProfile::photoAllowed($url));
        $profile = DirectoryProfile::fromPerson(['photos' => [['url' => $url]]]);
        $this->assertSame($kept ? $url : null, $profile['picture_url']);
    }

    public function testFieldsSeenNamesTheKeysAndIdTypesAndLeaksNoValue(): void
    {
        $person = [
            'resourceName' => 'people/fake-secret-sub',
            'names' => [['displayName' => 'Fake Secret Name', 'metadata' => ['primary' => true]]],
            'organizations' => [
                ['department' => 'Other Dept', 'costCenter' => 'CC-SECRET'],
                [
                    'department' => 'Fake Secret Dept',
                    'title' => 'Fake Secret Title',
                    'jobDescription' => 'Student',
                    'metadata' => ['primary' => true],
                ],
            ],
            'externalIds' => [
                ['value' => 'FAKE-SECRET-ID-1', 'type' => 'organization'],
                ['value' => 'FAKE-SECRET-ID-2', 'type' => 'custom', 'customType' => 'Fake Secret Label'],
                ['value' => 'FAKE-SECRET-ID-3', 'type' => 'organization'],
                ['value' => 'FAKE-SECRET-ID-4'],
                ['value' => 'FAKE-SECRET-ID-5', 'type' => 'has space <script>'],
            ],
            'phoneNumbers' => [['value' => '+60 3-0000 0000']],
        ];

        $fields = DirectoryProfile::fieldsSeen($person);

        $this->assertSame([
            'person' => ['externalIds', 'names', 'organizations', 'phoneNumbers', 'resourceName'],
            'organization' => ['department', 'jobDescription', 'metadata', 'title'],
            'external_id_types' => ['custom', 'organization'],
        ], $fields);
        $json = json_encode($fields, JSON_THROW_ON_ERROR);
        foreach (['SECRET', '+60', 'Student', 'people/'] as $value) {
            $this->assertStringNotContainsString($value, $json);
        }
    }

    public function testFieldsSeenOfAnEmptyOrOddPersonIsEmptyLists(): void
    {
        $empty = ['person' => [], 'organization' => [], 'external_id_types' => []];
        $this->assertSame($empty, DirectoryProfile::fieldsSeen([]));
        $this->assertSame(
            ['person' => ['externalIds', 'organizations'], 'organization' => [], 'external_id_types' => []],
            DirectoryProfile::fieldsSeen([
                'organizations' => 'x',
                'externalIds' => [['type' => 5], 'y'],
                7 => 'numeric key',
                'bad key!' => 1,
                str_repeat('k', 65) => 1,
            ])
        );
    }

    public function testFieldsSeenKeepsAtMostFiftyNamesPerList(): void
    {
        $person = [];
        for ($i = 0; $i < 80; $i++) {
            $person['k' . $i] = 1;
        }

        $this->assertCount(50, DirectoryProfile::fieldsSeen($person)['person']);
    }

    public function testWithDirectoryTakesTheEntrysExternalIdsAndFillsOnlyAMissingOrganisation(): void
    {
        $me = ['names' => [['displayName' => 'A']], 'organizations' => [['department' => 'From me']]];
        $entry = [
            'externalIds' => [['value' => 'QIU-202404-000157', 'type' => 'organization']],
            'organizations' => [['department' => 'From directory']],
            'phoneNumbers' => [['value' => '+60']],
        ];

        $merged = DirectoryProfile::withDirectory($me, $entry);

        $this->assertSame('QIU-202404-000157', DirectoryProfile::fromPerson($merged)['external_id']);
        $this->assertSame('From me', DirectoryProfile::fromPerson($merged)['department']);
        $this->assertArrayNotHasKey('phoneNumbers', $merged, 'only the two fields are taken');
        $noOrg = DirectoryProfile::withDirectory(['names' => []], $entry);
        $this->assertSame('From directory', DirectoryProfile::fromPerson($noOrg)['department']);
        $this->assertSame($me, DirectoryProfile::withDirectory($me, null));
        $this->assertSame($me, DirectoryProfile::withDirectory($me, ['externalIds' => []]));
    }

    public function testHasEmailMatchesExactlyIgnoringCase(): void
    {
        $person = ['emailAddresses' => [['value' => 'x'], 'bad', ['value' => ' Student@Example.TEST ']]];

        $this->assertTrue(DirectoryProfile::hasEmail($person, 'student@example.test'));
        $this->assertFalse(DirectoryProfile::hasEmail($person, 'student@example.tes'));
        $this->assertFalse(DirectoryProfile::hasEmail($person, 'other.student@example.test'));
        $this->assertFalse(DirectoryProfile::hasEmail(['emailAddresses' => 'x'], 'x'));
        $this->assertFalse(DirectoryProfile::hasEmail([], 'x'));
    }
}
