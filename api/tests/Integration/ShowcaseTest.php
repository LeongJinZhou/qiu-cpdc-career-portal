<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

/** FYP showcase and talent feed (docs/SPEC.md section 9). */
final class ShowcaseTest extends HttpTestCase
{
    use SignsInAs;

    /** A real 1x1 PNG. */
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/'
        . 'iZk9HQAAAABJRU5ErkJggg==';

    private const PROJECT = [
        'title' => 'Fake Crop Disease Detector',
        'summary' => 'A phone app that spots leaf disease from a photo, trained on fake sample data.',
        'tech' => ['Python', 'TensorFlow', ' python ', 'React  Native'],
        'project_year' => 2026,
        'repo_url' => 'https://github.com/fake/crop-detector',
        'demo_url' => '',
        'published' => false,
    ];

    /**
     * @param array<string, mixed> $changes
     * @return array<string, mixed> the saved project
     */
    private function save(array $changes = []): array
    {
        $saved = $this->json('PUT', '/api/showcase/mine', $changes + self::PROJECT);
        $this->assertSame(200, $saved->status, $saved->body);

        return $this->body($saved)['project'];
    }

    public function testAStudentPublishesAProjectAndStaffFindItInTheFeed(): void
    {
        $this->signInAs('student');
        $this->assertNull($this->body($this->send('GET', '/api/showcase/mine'))['project']);
        $draft = $this->save();
        $this->assertSame(['Python', 'React Native', 'TensorFlow'], $draft['tech'], 'trimmed, deduplicated, sorted');
        $this->assertSame('Faculty of Fake Studies', $draft['faculty']);
        $this->assertNull($draft['published_at']);

        $this->signInAs('staff');
        $this->assertSame(0, $this->body($this->send('GET', '/api/showcase'))['total'], 'drafts are not in the feed');
        $this->assertError($this->send('GET', '/api/showcase/' . $draft['id']), 404, 'NOT_FOUND');

        $this->signInAs('student');
        $published = $this->save(['published' => true]);
        $this->assertNotNull($published['published_at']);
        $this->assertSame($published['published_at'], $this->save(['published' => true])['published_at']);

        $this->signInAs('staff');
        $feed = $this->body($this->send('GET', '/api/showcase'));
        $this->assertSame(1, $feed['total']);
        $this->assertSame('Fake Student', $feed['items'][0]['student']['display_name']);
        $this->assertArrayNotHasKey('email', $feed['items'][0]['student']);
        $this->assertSame(1, $this->body($this->send('GET', '/api/showcase', '', ['tech' => 'Python']))['total']);
        $this->assertSame(0, $this->body($this->send('GET', '/api/showcase', '', ['tech' => 'Rust']))['total']);
        $this->assertSame(1, $this->body($this->send('GET', '/api/showcase', '', ['q' => 'leaf']))['total']);
        $this->assertSame(0, $this->body($this->send('GET', '/api/showcase', '', ['year' => '2025']))['total']);
        $this->assertSame(
            1,
            $this->body($this->send('GET', '/api/showcase', '', ['faculty' => 'Faculty of Fake Studies']))['total']
        );
        $filters = $this->body($this->send('GET', '/api/showcase/filters'));
        $this->assertSame(['Faculty of Fake Studies'], $filters['faculties']);
        $this->assertSame([2026], $filters['years']);
        $this->assertContains(['tech' => 'Python', 'count' => 1], $filters['tech']);
        $this->assertSame(200, $this->send('GET', '/api/showcase/' . $draft['id'])->status);
    }

    public function testLinksMustBeHttpsAndUnknownFieldsAreRefused(): void
    {
        $this->signInAs('student');
        foreach (['http://fake.example', 'javascript:alert(1)', 'https://', 'https://user:pw@fake.example'] as $url) {
            $refused = $this->json('PUT', '/api/showcase/mine', ['repo_url' => $url] + self::PROJECT);
            $this->assertError($refused, 400, 'VALIDATION');
        }
        $this->refused('PUT', '/api/showcase/mine', ['faculty' => 'X'] + self::PROJECT, 400, 'VALIDATION');
        $this->refused('PUT', '/api/showcase/mine', ['summary' => 'too short'] + self::PROJECT, 400, 'VALIDATION');
    }

    public function testTheImageIsCheckedByItsBytesAndServedOnlyToThoseWhoMaySeeTheProject(): void
    {
        $this->signInAs('student');
        $png = (string) base64_decode(self::PNG);
        $this->assertError($this->upload('/api/showcase/mine/image', $png), 409, 'NO_PROJECT');
        $id = $this->save()['id'];
        $this->assertError($this->upload('/api/showcase/mine/image', '<?php echo 1; ?>'), 415, 'UNSUPPORTED_IMAGE');
        $this->assertError($this->upload('/api/showcase/mine/image', 'x', UPLOAD_ERR_INI_SIZE), 413, 'FILE_TOO_LARGE');
        $this->assertError(
            $this->upload('/api/showcase/mine/image', (string) base64_decode(self::PNG), size: 3 * 1048576),
            413,
            'FILE_TOO_LARGE'
        );
        $up = $this->upload('/api/showcase/mine/image', (string) base64_decode(self::PNG));
        $this->assertSame(200, $up->status, $up->body);
        $url = (string) $this->body($up)['project']['image_url'];
        $this->assertStringStartsWith("/api/showcase/$id/image?v=", $url);
        $stored = (string) $this->sql("SELECT image_name FROM showcase_project WHERE id = $id")->fetchColumn();
        $this->assertMatchesRegularExpression('/^[0-9a-f]{32}\.png$/', $stored);
        $this->assertFileExists($this->storage . '/showcase/' . $stored);

        $own = $this->send('GET', "/api/showcase/$id/image");
        $this->assertSame(200, $own->status);
        $this->assertSame('image/png', $own->headers['Content-Type']);
        $this->assertSame(base64_decode(self::PNG), $own->body);

        $this->signInAs('student-b');
        $this->assertError($this->send('GET', "/api/showcase/$id/image"), 404, 'NOT_FOUND');
        $this->signInAs('staff');
        $this->assertError($this->send('GET', "/api/showcase/$id/image"), 404, 'NOT_FOUND'); // still a draft

        $this->signInAs('student');
        $this->save(['published' => true]);
        $this->signInAs('staff');
        $this->assertSame(200, $this->send('GET', "/api/showcase/$id/image")->status);
        $this->signInAs('student-b');
        $this->assertError($this->send('GET', "/api/showcase/$id"), 404, 'NOT_FOUND');

        $this->signInAs('student');
        $removed = $this->json('DELETE', '/api/showcase/mine/image');
        $this->assertNull($this->body($removed)['project']['image_url']);
        $this->assertFileDoesNotExist($this->storage . '/showcase/' . $stored);
    }

    public function testOnlyStudentsPublishAndOnlyStaffAndCpdcBrowse(): void
    {
        $this->assertError($this->send('GET', '/api/showcase'), 401, 'UNAUTHENTICATED');
        $this->signInAs('student');
        $this->assertError($this->send('GET', '/api/showcase'), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', '/api/showcase/filters'), 403, 'FORBIDDEN');
        $this->signInAs('staff');
        $this->assertError($this->json('PUT', '/api/showcase/mine', self::PROJECT), 403, 'FORBIDDEN');
        $this->assertError($this->upload('/api/showcase/mine/image', 'x'), 403, 'FORBIDDEN');
        $this->signInAs('admin', 'admin');
        $this->assertSame(200, $this->send('GET', '/api/showcase')->status);
        $this->signInAs('graduate', 'alumni');
        $this->assertError($this->send('GET', '/api/showcase'), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', '/api/showcase/mine'), 403, 'FORBIDDEN');
    }
}
