<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

/**
 * Workshops: create, RSVP with capacity and waitlist, no RSVP after the start, check-in, attendance CSV.
 * The test clock is 2027-01-15 08:00 UTC (16:00 Malaysia time).
 */
final class WorkshopsTest extends HttpTestCase
{
    use SignsInAs;

    /** 2027-01-16 10:00 Malaysia time = 02:00 UTC. */
    private const START_UNIX = 1_800_064_800;

    /** @param array<string, mixed> $overrides */
    private function createWorkshop(array $overrides = []): int
    {
        $this->signInAs('admin', 'admin');
        $created = $this->json('POST', '/api/workshops', $overrides + [
            'title' => 'CV clinic',
            'description' => 'Bring your CV.',
            'starts_at' => '2027-01-16T10:00',
            'ends_at' => '2027-01-16T12:00',
            'mode' => 'in_person',
            'venue' => 'Fake Hall 1',
            'capacity' => 30,
            'audience' => ['student', 'staff', 'alumni'],
        ]);
        $this->assertSame(201, $created->status, $created->body);

        return (int) $this->body($created)['id'];
    }

    public function testCpdcCreatesAWorkshopInMalaysiaTimeAndStudentsSeeIt(): void
    {
        $id = $this->createWorkshop();
        $stored = $this->sql("SELECT starts_at FROM workshop WHERE id = $id")->fetchColumn();
        $this->assertSame('2027-01-16 02:00:00.000', $stored);

        $this->signInAs('student', 'student');
        $list = $this->body($this->send('GET', '/api/workshops'));
        $this->assertSame(1, $list['total']);
        $item = $list['items'][0];
        $this->assertSame('2027-01-16T02:00:00Z', $item['starts_at']);
        $this->assertSame('2027-01-16T10:00', $item['starts_local']);
        $this->assertSame(30, $item['spots_left']);
        $this->assertNull($item['my_rsvp']);
        $this->assertArrayNotHasKey('checkin_code', $item, 'the code is for CPDC only');
        $this->assertSame(1, (int) $this->sql("SELECT COUNT(*) FROM audit_log WHERE action = 'workshop.create'")
            ->fetchColumn());
    }

    public function testOnlyCpdcManagesWorkshops(): void
    {
        $id = $this->createWorkshop();
        $this->signInAs('student', 'student');
        $this->assertError($this->json('POST', '/api/workshops', ['title' => 'x']), 403, 'FORBIDDEN');
        $this->assertError($this->json('PUT', "/api/workshops/$id", ['title' => 'x']), 403, 'FORBIDDEN');
        $this->assertError($this->json('POST', "/api/workshops/$id/cancel"), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', "/api/workshops/$id/attendees"), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', "/api/workshops/$id/export"), 403, 'FORBIDDEN');
        $this->assertError(
            $this->json('PUT', "/api/workshops/$id/attendance", ['user_id' => 1, 'present' => true]),
            403,
            'FORBIDDEN'
        );
        $this->signInAs('staff', 'staff');
        $this->assertError($this->send('GET', "/api/workshops/$id/attendees"), 403, 'FORBIDDEN');
    }

    public function testAPendingAccountSeesNoWorkshops(): void
    {
        $this->createWorkshop();
        $this->signInAs('graduate', 'pending');
        $this->assertError($this->send('GET', '/api/workshops'), 403, 'FORBIDDEN');
        $this->jar = [];
        $this->assertError($this->send('GET', '/api/workshops'), 401, 'UNAUTHENTICATED');
    }

    public function testCapacityIsEnforcedAndAFreedSeatGoesToTheWaitlist(): void
    {
        $id = $this->createWorkshop(['capacity' => 1]);
        $first = $this->signInAs('student', 'student');
        $this->assertSame('going', $this->body($this->json('POST', "/api/workshops/$id/rsvp"))['my_rsvp']['status']);
        $again = $this->body($this->json('POST', "/api/workshops/$id/rsvp"));
        $this->assertSame('going', $again['my_rsvp']['status'], 'asking twice keeps the seat');
        $this->assertSame(1, $again['going_count']);

        $this->signInAs('student-b', 'student');
        $waiting = $this->body($this->json('POST', "/api/workshops/$id/rsvp"));
        $this->assertSame('waitlist', $waiting['my_rsvp']['status']);
        $this->assertSame(1, $waiting['my_rsvp']['waitlist_position']);
        $this->assertSame(0, $waiting['spots_left']);

        $this->signInAs('staff', 'staff');
        $second = $this->body($this->json('POST', "/api/workshops/$id/rsvp"));
        $this->assertSame(2, $second['my_rsvp']['waitlist_position']);

        $this->signInAs('student', 'student');
        $cancelled = $this->body($this->send('DELETE', "/api/workshops/$id/rsvp"));
        $this->assertNull($cancelled['my_rsvp']);
        $this->assertSame(
            ['going'],
            $this->sql("SELECT r.status FROM workshop_rsvp r JOIN `user` u ON u.id = r.user_id"
                . " WHERE r.workshop_id = $id AND u.email = 'other.student@example.test'")
                ->fetchAll(\PDO::FETCH_COLUMN),
            'the first on the waitlist moves up'
        );

        // Coming back after cancelling joins the end of the waitlist.
        $back = $this->body($this->json('POST', "/api/workshops/$id/rsvp"));
        $this->assertSame('waitlist', $back['my_rsvp']['status']);
        $this->assertSame(2, $back['my_rsvp']['waitlist_position']);
        $this->assertGreaterThan(0, $first);
    }

    public function testNoRsvpOrCancelOnceTheWorkshopHasStarted(): void
    {
        $id = $this->createWorkshop();
        $this->now = self::START_UNIX - 1; // one second before the start: still open
        $this->signInAs('student', 'student');
        $this->assertSame(200, $this->json('POST', "/api/workshops/$id/rsvp")->status);

        $this->now = self::START_UNIX;
        $this->assertError($this->send('DELETE', "/api/workshops/$id/rsvp"), 409, 'WORKSHOP_STARTED');
        $this->signInAs('student-b', 'student');
        $this->assertError($this->json('POST', "/api/workshops/$id/rsvp"), 409, 'WORKSHOP_STARTED');
        $started = $this->body($this->send('GET', "/api/workshops/$id"));
        $this->assertTrue($started['started']);

        // Days later the workshop is in the past list, and RSVP stays closed.
        $this->now = self::START_UNIX + 3 * 86400;
        $this->signInAs('student-b', 'student'); // the old session timed out meanwhile
        $this->assertError($this->json('POST', "/api/workshops/$id/rsvp"), 409, 'WORKSHOP_STARTED');
        $this->assertSame(0, $this->body($this->send('GET', '/api/workshops'))['total']);
        $past = $this->body($this->send('GET', '/api/workshops', '', ['when' => 'past']));
        $this->assertSame($id, $past['items'][0]['id']);
        $this->assertTrue($past['items'][0]['ended']);
    }

    public function testAWorkshopCannotBeCreatedInThePastOrWithBadTimes(): void
    {
        $this->signInAs('admin', 'admin');
        $base = ['title' => 'Talk', 'mode' => 'in_person', 'venue' => 'Fake Hall', 'capacity' => 10,
            'audience' => ['student']];
        $past = $this->json('POST', '/api/workshops', $base + ['starts_at' => '2027-01-15T15:59',
            'ends_at' => '2027-01-15T17:00']);
        $this->assertError($past, 400, 'VALIDATION');
        $this->assertSame('starts_at', $this->body($past)['error']['field']);
        $this->assertError($this->json('POST', '/api/workshops', $base + ['starts_at' => '2027-01-16T10:00',
            'ends_at' => '2027-01-16T09:00']), 400, 'VALIDATION');
        $this->assertError($this->json('POST', '/api/workshops', $base + ['starts_at' => '2027-02-30T10:00',
            'ends_at' => '2027-03-01T10:00']), 400, 'VALIDATION');
        $this->assertError($this->json('POST', '/api/workshops', $base + ['starts_at' => '2027-01-16T10:00',
            'ends_at' => '2027-01-16T11:00', 'checkin_code' => 'AAAAAA']), 400, 'VALIDATION');
        $online = ['mode' => 'online', 'venue' => '', 'starts_at' => '2027-01-16T10:00',
            'ends_at' => '2027-01-16T11:00'];
        $this->assertError($this->json('POST', '/api/workshops', $online + $base), 400, 'VALIDATION');
        $this->assertError(
            $this->json('POST', '/api/workshops', $online + ['online_url' => 'javascript:alert(1)'] + $base),
            400,
            'VALIDATION'
        );
    }

    public function testTheOnlineLinkIsOnlyForPeopleWithASeat(): void
    {
        $link = 'https://meet.example.test/abc';
        $id = $this->createWorkshop(['mode' => 'online', 'online_url' => $link, 'venue' => '']);
        $this->assertSame($link, $this->body($this->send('GET', "/api/workshops/$id"))['online_url']);
        $this->signInAs('student', 'student');
        $this->assertNull($this->body($this->send('GET', "/api/workshops/$id"))['online_url']);
        $this->assertSame(
            'https://meet.example.test/abc',
            $this->body($this->json('POST', "/api/workshops/$id/rsvp"))['online_url']
        );
    }

    public function testTheAudienceDecidesWhoSeesAndRsvps(): void
    {
        $id = $this->createWorkshop(['audience' => ['alumni']]);
        $this->signInAs('student', 'student');
        $this->assertSame(0, $this->body($this->send('GET', '/api/workshops'))['total']);
        $this->assertError($this->send('GET', "/api/workshops/$id"), 404, 'NOT_FOUND');
        $this->assertError($this->json('POST', "/api/workshops/$id/rsvp"), 404, 'NOT_FOUND');
        $this->signInAs('graduate', 'alumni');
        $this->assertSame('going', $this->body($this->json('POST', "/api/workshops/$id/rsvp"))['my_rsvp']['status']);
    }

    public function testAWorkshopOfAnotherOrganisationIsNotFound(): void
    {
        $other = $this->insertOrganisation('Fake Other University');
        $owner = $this->insertUser('owner@other.example.test', 'admin', $other);
        $this->pdo->prepare(
            'INSERT INTO workshop (organisation_id, title, starts_at, ends_at, mode, venue, capacity, audience,'
            . ' checkin_code, created_by) VALUES (?, "Other", "2027-02-01 02:00:00", "2027-02-01 04:00:00",'
            . ' "in_person", "Elsewhere", 5, "student,staff,alumni", "ABCDEF", ?)'
        )->execute([$other, $owner]);
        $id = (int) $this->pdo->lastInsertId();
        $this->signInAs('admin', 'admin');
        $this->assertSame(0, $this->body($this->send('GET', '/api/workshops'))['total']);
        $this->assertError($this->send('GET', "/api/workshops/$id/attendees"), 404, 'NOT_FOUND');
        $this->assertError($this->send('GET', "/api/workshops/$id/export"), 404, 'NOT_FOUND');
        $this->signInAs('student', 'student');
        $this->assertError($this->json('POST', "/api/workshops/$id/rsvp"), 404, 'NOT_FOUND');
    }

    public function testPeopleCheckInWithTheCodeOnlyAroundTheWorkshopTime(): void
    {
        $id = $this->createWorkshop(['capacity' => 1]);
        $code = (string) $this->body($this->send('GET', "/api/workshops/$id"))['checkin_code'];
        $this->assertMatchesRegularExpression('/^[A-HJ-NP-Z2-9]{6}$/', $code);
        $this->now = self::START_UNIX - 31 * 60; // 31 minutes before: not open yet (setting: 30)
        $this->signInAs('student', 'student');
        $this->json('POST', "/api/workshops/$id/rsvp");
        $checkIn = fn (string $typed) => $this->json('POST', "/api/workshops/$id/check-in", ['code' => $typed]);
        $this->assertError($checkIn($code), 409, 'CHECKIN_CLOSED');

        $this->now = self::START_UNIX - 20 * 60;
        $this->assertError($checkIn('WRONG1'), 400, 'VALIDATION');
        $this->assertTrue($this->body($checkIn(strtolower($code)))['my_rsvp']['checked_in']);

        $this->now = self::START_UNIX - 10 * 60;
        $this->signInAs('student-b', 'student');
        $this->json('POST', "/api/workshops/$id/rsvp"); // waitlist
        $this->now = self::START_UNIX;
        $this->assertError($checkIn($code), 409, 'NO_SEAT');
        $this->now = self::START_UNIX + 2 * 3600; // ended
        $this->signInAs('student', 'student');
        $this->assertError($checkIn($code), 409, 'CHECKIN_CLOSED');
    }

    public function testCpdcTicksTheListAndDownloadsAFormulaSafeAttendanceCsv(): void
    {
        $id = $this->createWorkshop();
        $student = $this->signInAs('student', 'student');
        $this->json('POST', "/api/workshops/$id/rsvp");
        $this->pdo->exec("UPDATE `user` SET display_name = '=HYPERLINK(\"http://evil.test\")' WHERE id = $student");
        $this->signInAs('staff', 'staff');
        $this->json('POST', "/api/workshops/$id/rsvp");

        $this->signInAs('admin', 'admin');
        $ticked = $this->json('PUT', "/api/workshops/$id/attendance", ['user_id' => $student, 'present' => true]);
        $this->assertSame(200, $ticked->status, $ticked->body);
        $rows = $this->body($ticked)['items'];
        $this->assertCount(2, $rows);
        $this->assertNotNull($rows[0]['checked_in_at']);
        $this->assertSame('list', $rows[0]['checkin_method']);
        $this->assertError(
            $this->json('PUT', "/api/workshops/$id/attendance", ['user_id' => 999999, 'present' => true]),
            404,
            'NOT_FOUND'
        );

        $csv = $this->send('GET', "/api/workshops/$id/export");
        $this->assertSame(200, $csv->status);
        $this->assertSame('text/csv; charset=utf-8', $csv->headers['Content-Type'] ?? null);
        $this->assertStringContainsString('"\'=HYPERLINK(""http://evil.test"")"', $csv->body);
        $this->assertStringContainsString('"Yes","2027-01-15 16:00","list"', $csv->body, 'Malaysia time');
        $this->assertSame(1, (int) $this->sql("SELECT COUNT(*) FROM audit_log WHERE action = 'workshop.export'")
            ->fetchColumn());
        $this->assertSame(1, (int) $this->sql("SELECT COUNT(*) FROM audit_log WHERE action = 'workshop.attendance'")
            ->fetchColumn());

        $this->json('PUT', "/api/workshops/$id/attendance", ['user_id' => $student, 'present' => false]);
        $this->assertNull($this->body($this->send('GET', "/api/workshops/$id/attendees"))['items'][0]['checked_in_at']);
    }

    public function testCapacityCannotDropBelowThoseGoingAndARaiseMovesTheWaitlistUp(): void
    {
        $id = $this->createWorkshop(['capacity' => 1]);
        $this->signInAs('student', 'student');
        $this->json('POST', "/api/workshops/$id/rsvp");
        $this->signInAs('student-b', 'student');
        $this->json('POST', "/api/workshops/$id/rsvp");

        $this->signInAs('admin', 'admin');
        $edit = ['title' => 'CV clinic', 'starts_at' => '2027-01-16T10:00', 'ends_at' => '2027-01-16T12:00',
            'mode' => 'in_person', 'venue' => 'Fake Hall 1', 'audience' => ['student', 'staff', 'alumni']];
        $this->json('POST', "/api/workshops/$id/rsvp"); // the admin joins the waitlist too
        $raised = $this->body($this->json('PUT', "/api/workshops/$id", $edit + ['capacity' => 2]));
        $this->assertSame(2, $raised['going_count']);
        $this->assertSame(1, $raised['waitlist_count']);
        $lowered = $this->json('PUT', "/api/workshops/$id", $edit + ['capacity' => 1]);
        $this->assertError($lowered, 409, 'CAPACITY_BELOW_GOING');
    }

    public function testACancelledWorkshopDisappearsForPeopleAndTakesNoRsvp(): void
    {
        $id = $this->createWorkshop();
        $this->assertSame('cancelled', $this->body($this->json('POST', "/api/workshops/$id/cancel"))['status']);
        $this->assertSame(1, $this->body($this->send('GET', '/api/workshops'))['total'], 'CPDC still sees it');
        $this->signInAs('student', 'student');
        $this->assertSame(0, $this->body($this->send('GET', '/api/workshops'))['total']);
        $this->assertError($this->json('POST', "/api/workshops/$id/rsvp"), 404, 'NOT_FOUND');
    }
}
