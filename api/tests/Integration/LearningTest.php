<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

use Cpdc\Http\Response;

/** Courses and certificates with a link or PDF proof, and CPDC's verification (slice 2b). */
final class LearningTest extends ModuleTestCase
{
    private const LINK = 'https://example.test/cert/1';

    /**
     * @param array<string, string> $extra
     * @return array<string, string>
     */
    private function record(array $extra = []): array
    {
        return $extra + ['kind' => 'certificate', 'name' => 'Fake Cloud Basics', 'provider' => 'Fake Academy',
            'completed_on' => '2026-10-01'];
    }

    /**
     * @param array<string, string> $extra
     * @param array<string, string> $files
     */
    private function add(array $extra = [], array $files = []): Response
    {
        return $this->upload('/api/learning', $this->record($extra), $files);
    }

    public function testAStudentLogsCoursesWithALinkOrAPdf(): void
    {
        $this->signInAs('student', 'student');
        $link = $this->add(['link_url' => self::LINK]);
        $this->assertSame(201, $link->status, $link->body);
        $pdf = $this->add(['kind' => 'course', 'name' => 'Fake SQL'], ['proof' => self::PDF]);
        $this->assertSame(201, $pdf->status, $pdf->body);

        $items = $this->body($this->send('GET', '/api/learning'))['items'];
        $this->assertCount(2, $items);
        $this->assertSame('submitted', $items[0]['status']);
        $withPdf = array_values(array_filter($items, fn (array $i) => $i['has_proof']))[0];
        $this->assertSame('proof.pdf', $withPdf['proof_name']);
        $download = $this->send('GET', '/api/learning/' . $withPdf['id'] . '/proof');
        $this->assertSame(200, $download->status);
        $this->assertStringStartsWith('%PDF-', $download->body);
    }

    public function testEveryRecordNeedsProofAndRealInput(): void
    {
        $this->signInAs('student', 'student');
        $this->assertError($this->add(), 400, 'VALIDATION');
        $this->assertError($this->add(['link_url' => 'javascript:alert(1)']), 400, 'VALIDATION');
        $this->assertError($this->add(['completed_on' => '2099-01-01', 'link_url' => self::LINK]), 400, 'VALIDATION');
        $this->assertError($this->add(['completed_on' => '2026-02-30', 'link_url' => self::LINK]), 400, 'VALIDATION');
        $this->assertError($this->add(['status' => 'verified', 'link_url' => self::LINK]), 400, 'VALIDATION');
        $this->assertError($this->add([], ['proof' => 'bytes:MZ not a pdf']), 400, 'VALIDATION');
        $this->assertSame([], $this->body($this->send('GET', '/api/learning'))['items']);
        $this->assertSame([], glob($this->storage . '/uploads/learning/*.pdf') ?: []);
    }

    public function testCpdcVerifiesAndTheRecordIsThenLocked(): void
    {
        $this->signInAs('student', 'student');
        $id = $this->body($this->add([], ['proof' => self::PDF]))['id'];

        $this->signInAs('admin', 'admin');
        $queue = $this->body($this->send('GET', '/api/learning/review', '', ['status' => 'submitted']));
        $this->assertSame(1, $queue['total']);
        $this->assertSame('Fake Student', $queue['items'][0]['display_name']);
        $this->assertSame(200, $this->send('GET', "/api/learning/$id/proof")->status);
        $this->assertSame(204, $this->decide($id, ['decision' => 'verified'])->status);
        $actions = $this->sql("SELECT action FROM audit_log WHERE target = 'learning:$id' ORDER BY id")
            ->fetchAll(\PDO::FETCH_COLUMN);
        $this->assertSame(['learning.proof_download', 'learning.verified'], $actions);

        $this->signInAs('student', 'student');
        $this->assertSame('verified', $this->body($this->send('GET', '/api/learning'))['items'][0]['status']);
        $this->assertError($this->send('DELETE', "/api/learning/$id"), 409, 'VERIFIED');
    }

    public function testARejectionNeedsANoteThePersonCanRead(): void
    {
        $this->signInAs('student', 'student');
        $id = $this->body($this->add(['link_url' => self::LINK]))['id'];
        $this->signInAs('admin', 'admin');
        $this->assertError($this->decide($id, ['decision' => 'rejected']), 400, 'VALIDATION');
        $this->assertError($this->decide($id, ['decision' => 'maybe']), 400, 'VALIDATION');
        $this->assertError($this->decide(999999, ['decision' => 'verified']), 404, 'NOT_FOUND');
        $done = $this->decide($id, ['decision' => 'rejected', 'note' => 'Link does not open.']);
        $this->assertSame(204, $done->status, $done->body);

        $this->signInAs('student', 'student');
        $item = $this->body($this->send('GET', '/api/learning'))['items'][0];
        $this->assertSame('rejected', $item['status']);
        $this->assertSame('Link does not open.', $item['review_note']);
        $this->assertSame(204, $this->send('DELETE', "/api/learning/$id")->status);
    }

    public function testDeletingRemovesTheProofFile(): void
    {
        $this->signInAs('student', 'student');
        $id = $this->body($this->add([], ['proof' => self::PDF]))['id'];
        $this->assertCount(1, glob($this->storage . '/uploads/learning/*.pdf') ?: []);
        $this->assertSame(204, $this->send('DELETE', "/api/learning/$id")->status);
        $this->assertSame([], glob($this->storage . '/uploads/learning/*.pdf') ?: []);
        $this->assertError($this->send('DELETE', "/api/learning/$id"), 404, 'NOT_FOUND');
    }

    public function testRecordsArePrivateAndOnlyCpdcVerifies(): void
    {
        $this->signInAs('student', 'student');
        $id = $this->body($this->add([], ['proof' => self::PDF]))['id'];

        $this->signInAs('student-b', 'student');
        $this->assertSame([], $this->body($this->send('GET', '/api/learning'))['items']);
        $this->assertError($this->send('GET', "/api/learning/$id/proof"), 404, 'NOT_FOUND');
        $this->assertError($this->send('DELETE', "/api/learning/$id"), 404, 'NOT_FOUND');
        $this->assertError($this->send('GET', '/api/learning/review'), 403, 'FORBIDDEN');
        $this->assertError($this->decide($id, ['decision' => 'verified']), 403, 'FORBIDDEN');

        $this->signInAs('staff', 'staff');
        $this->assertError($this->send('GET', '/api/learning'), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', "/api/learning/$id/proof"), 403, 'FORBIDDEN');
        $this->signInAs('admin', 'admin');
        $this->assertError($this->add(['link_url' => self::LINK]), 403, 'FORBIDDEN');
        $this->jar = [];
        $this->assertError($this->send('GET', '/api/learning'), 401, 'UNAUTHENTICATED');
    }

    public function testNobodyVerifiesTheirOwnRecord(): void
    {
        $this->signInAs('admin', 'admin');
        $adminId = (int) $this->body($this->send('GET', '/api/me'))['user']['id'];
        $this->pdo->exec(
            "INSERT INTO learning_record (organisation_id, user_id, kind, name, provider, completed_on, link_url)"
            . " VALUES (1, $adminId, 'course', 'Fake', 'Fake', '2026-01-01', 'https://example.test')"
        );
        $id = (int) $this->pdo->lastInsertId();
        $this->assertError($this->decide($id, ['decision' => 'verified']), 403, 'FORBIDDEN');
    }
}
