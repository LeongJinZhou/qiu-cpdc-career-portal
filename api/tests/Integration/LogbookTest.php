<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

use Cpdc\Logbook\LogbookService;
use Cpdc\Logbook\Mail\LogMailer;
use Cpdc\Logbook\Mail\Mailer;
use Cpdc\Logbook\Mail\Mailers;

/**
 * Internship logbook: weeks, the supervisor's single-use link, CPDC's progress view (docs/SPEC.md section 9).
 * The test clock (1_800_000_000) is Friday 15 January 2027; the internship runs 4 January to 26 March 2027.
 */
final class LogbookTest extends HttpTestCase
{
    use SignsInAs;

    private const INTERNSHIP = [
        'company' => 'Fake Engineering Sdn Bhd',
        'supervisor_name' => 'Fake Supervisor',
        'supervisor_email' => 'supervisor@company.example',
        'start_date' => '2027-01-04',
        'end_date' => '2027-03-26',
    ];
    private const WEEK = [
        'week_start' => '2027-01-04',
        'hours' => 40,
        'activities' => 'Set up the build pipeline and fixed two bugs.',
        'learnings' => 'How code review works in a team.',
    ];

    /** @return int the new week's id */
    private function studentWithWeek(string $persona = 'student'): int
    {
        $this->signInAs($persona);
        $this->assertSame(200, $this->json('PUT', '/api/logbook/internship', self::INTERNSHIP)->status);
        $created = $this->json('POST', '/api/logbook/entries', self::WEEK);
        $this->assertSame(201, $created->status, $created->body);

        return (int) $this->body($created)['id'];
    }

    /** @return list<array{to: string, subject: string, text: string}> */
    private function mails(): array
    {
        return (new LogMailer(Mailers::logFile($this->storage)))->messages();
    }

    private function lastToken(): string
    {
        $mails = $this->mails();
        $last = $mails[count($mails) - 1] ?? null;
        $this->assertNotNull($last, 'no mail sent');
        $this->assertSame(1, preg_match('#/review/([A-Za-z0-9_-]{43})#', $last['text'], $m));

        return (string) ($m[1] ?? '');
    }

    public function testTheSupervisorApprovesAWeekOnceByEmailLinkWithoutSigningIn(): void
    {
        $id = $this->studentWithWeek();
        $sent = $this->json('POST', "/api/logbook/entries/$id/submit");
        $this->assertSame(200, $sent->status, $sent->body);
        $this->assertSame('submitted', $this->body($sent)['status']);
        $this->assertTrue($this->body($sent)['link_active']);
        $mail = $this->mails()[0];
        $this->assertSame('supervisor@company.example', $mail['to']);
        $this->assertStringContainsString(self::APP_URL . '/review/', $mail['text']);
        $token = $this->lastToken();
        $hash = $this->sql('SELECT token_hash FROM logbook_review_link')->fetchColumn();
        $this->assertSame(hash('sha256', $token), $hash, 'only the hash is stored');

        $this->signOutLocally();
        $view = $this->send('GET', "/api/logbook/review/$token");
        $this->assertSame(200, $view->status, $view->body);
        $this->assertSame('Fake Student', $this->body($view)['student_name']);
        $this->assertStringNotContainsString('student@example.test', $view->body);
        $this->assertStringNotContainsString('FAKE-S-0001', $view->body);

        $approved = $this->json('POST', "/api/logbook/review/$token", ['decision' => 'approve']);
        $this->assertSame(200, $approved->status, $approved->body);
        $this->assertSame('approved', $this->body($approved)['status']);
        $this->refused('POST', "/api/logbook/review/$token", ['decision' => 'approve'], 410, 'LINK_USED');
        $this->assertError($this->send('GET', "/api/logbook/review/$token"), 410, 'LINK_USED');
        $this->assertSame('student@example.test', $this->mails()[1]['to'], 'the student hears the decision');
        $audit = $this->sql(
            "SELECT actor_id, meta_json FROM audit_log WHERE action = 'logbook.supervisor_approve' AND target = "
            . "'logbook_entry:$id'"
        )->fetch(\PDO::FETCH_ASSOC);
        $this->assertIsArray($audit, 'the supervisor decision is audited');
        $this->assertNull($audit['actor_id']);
        $this->assertStringContainsString('supervisor@company.example', (string) $audit['meta_json']);

        $this->signInAs('student');
        $this->assertSame('approved', $this->body($this->send('GET', '/api/logbook'))['entries'][0]['status']);
    }

    public function testAFailedNoticeToTheStudentDoesNotUndoTheSupervisorsDecision(): void
    {
        $id = $this->studentWithWeek();
        $this->json('POST', "/api/logbook/entries/$id/submit");
        $token = $this->lastToken();
        $broken = new class implements Mailer {
            public function send(string $to, string $subject, string $text): void
            {
                throw new \RuntimeException('mail server down');
            }
        };
        $service = new LogbookService($this->pdo, $broken, self::APP_URL, $this->now, 'Asia/Kuala_Lumpur');
        $logged = ini_set('error_log', $this->storage . '/php-error.log');
        try {
            $view = $service->decide($token, 'approve', '');
        } finally {
            ini_set('error_log', (string) $logged);
        }

        $this->assertSame('approved', $view['status']);
        $this->assertSame('approved', $this->sql("SELECT status FROM logbook_entry WHERE id = $id")->fetchColumn());
        $this->assertNotNull($this->sql('SELECT used_at FROM logbook_review_link')->fetchColumn(), 'link spent');
    }

    public function testAReturnedWeekNeedsACommentAndCanBeFixedAndSentAgain(): void
    {
        $id = $this->studentWithWeek();
        $this->json('POST', "/api/logbook/entries/$id/submit");
        $first = $this->lastToken();
        $this->signOutLocally();
        $this->refused('POST', "/api/logbook/review/$first", ['decision' => 'return'], 400, 'VALIDATION');
        $returned = $this->json('POST', "/api/logbook/review/$first", [
            'decision' => 'return', 'comment' => 'Please list the bugs you fixed.',
        ]);
        $this->assertSame('returned', $this->body($returned)['status']);

        $this->signInAs('student');
        $entry = $this->body($this->send('GET', '/api/logbook'))['entries'][0];
        $this->assertSame('Please list the bugs you fixed.', $entry['supervisor_comment']);
        $fixed = $this->json('PUT', "/api/logbook/entries/$id", ['activities' => 'Fixed bugs 12 and 15.'] + self::WEEK);
        $this->assertSame(200, $fixed->status, $fixed->body);
        $this->assertSame('submitted', $this->body($this->json('POST', "/api/logbook/entries/$id/submit"))['status']);
        $second = $this->lastToken();
        $this->assertNotSame($first, $second);

        $this->signOutLocally();
        $this->assertError($this->send('GET', "/api/logbook/review/$first"), 410, 'LINK_USED');
        $this->assertSame(200, $this->send('GET', "/api/logbook/review/$second")->status);
    }

    public function testALinkExpiresAndTheStudentSendsANewOne(): void
    {
        $id = $this->studentWithWeek();
        $this->json('POST', "/api/logbook/entries/$id/submit");
        $old = $this->lastToken();
        $this->now += 15 * 86400; // links last 14 days (logbook_review_link_days)

        $this->signInAs('student'); // the old session timed out meanwhile
        $this->assertFalse($this->body($this->send('GET', '/api/logbook'))['entries'][0]['link_active']);
        $this->signOutLocally();
        $this->assertError($this->send('GET', "/api/logbook/review/$old"), 410, 'LINK_EXPIRED');
        $this->refused('POST', "/api/logbook/review/$old", ['decision' => 'approve'], 410, 'LINK_EXPIRED');

        $this->signInAs('student');
        $resent = $this->json('POST', "/api/logbook/entries/$id/resend");
        $this->assertSame(200, $resent->status, $resent->body);
        $this->assertTrue($this->body($resent)['link_active']);
        $new = $this->lastToken();
        $this->signOutLocally();
        $this->assertError($this->send('GET', "/api/logbook/review/$old"), 404, 'LINK_INVALID');
        $this->assertSame(200, $this->send('GET', "/api/logbook/review/$new")->status);
    }

    public function testANewSupervisorEmailVoidsTheOldLinks(): void
    {
        $id = $this->studentWithWeek();
        $this->json('POST', "/api/logbook/entries/$id/submit");
        $old = $this->lastToken();
        $changed = $this->json('PUT', '/api/logbook/internship', ['supervisor_email' => 'new.boss@company.example']
            + self::INTERNSHIP);
        $this->assertFalse($this->body($changed)['entries'][0]['link_active']);
        $this->signOutLocally();
        $this->assertError($this->send('GET', "/api/logbook/review/$old"), 404, 'LINK_INVALID');
    }

    public function testWeeksMustBeMondaysInsideTheInternshipAndAlreadyStarted(): void
    {
        $this->signInAs('student');
        $this->assertError($this->json('POST', '/api/logbook/entries', self::WEEK), 409, 'NO_INTERNSHIP');
        $this->json('PUT', '/api/logbook/internship', self::INTERNSHIP);
        foreach (['2027-01-05', '2026-12-28', '2027-01-18', '2027-02-30'] as $week) {
            $refused = $this->json('POST', '/api/logbook/entries', ['week_start' => $week] + self::WEEK);
            $this->assertError($refused, 400, 'VALIDATION');
            $this->assertSame('week_start', $this->body($refused)['error']['field'] ?? null, $week);
        }
        $this->assertSame(201, $this->json('POST', '/api/logbook/entries', ['week_start' => '2027-01-11'] + self::WEEK)
            ->status, 'the current week may be logged');
        $this->json('POST', '/api/logbook/entries', self::WEEK);
        $this->assertError($this->json('POST', '/api/logbook/entries', self::WEEK), 409, 'WEEK_TAKEN');
        $this->refused('POST', '/api/logbook/entries', ['hours' => 81] + self::WEEK, 400, 'VALIDATION');
        $this->refused('POST', '/api/logbook/entries', ['status' => 'approved'] + self::WEEK, 400, 'VALIDATION');
    }

    public function testInternshipDatesAndSupervisorEmailAreChecked(): void
    {
        $this->signInAs('student');
        $bad = [
            ['end_date' => '2026-12-01'],
            ['start_date' => '2027-13-01'],
            ['supervisor_email' => 'Student@Example.test'], // the student's own address
            ['supervisor_email' => 'nope'],
        ];
        foreach ($bad as $change) {
            $this->refused('PUT', '/api/logbook/internship', $change + self::INTERNSHIP, 400, 'VALIDATION');
        }
    }

    public function testAWeekWithTheSupervisorOrApprovedCannotBeChanged(): void
    {
        $id = $this->studentWithWeek();
        $this->json('POST', "/api/logbook/entries/$id/submit");
        $this->assertError($this->json('PUT', "/api/logbook/entries/$id", self::WEEK), 409, 'ENTRY_LOCKED');
        $this->assertError($this->json('POST', "/api/logbook/entries/$id/submit"), 409, 'ENTRY_LOCKED');
        $next = $this->json('POST', '/api/logbook/entries', ['week_start' => '2027-01-11'] + self::WEEK);
        $draft = (int) $this->body($next)['id'];
        $this->assertError($this->json('POST', "/api/logbook/entries/$draft/resend"), 409, 'ENTRY_LOCKED');
    }

    public function testAStudentCannotReachAnotherStudentsWeeks(): void
    {
        $id = $this->studentWithWeek('student');
        $this->studentWithWeek('student-b');
        $this->assertError($this->json('PUT', "/api/logbook/entries/$id", self::WEEK), 404, 'NOT_FOUND');
        $this->assertError($this->json('POST', "/api/logbook/entries/$id/submit"), 404, 'NOT_FOUND');
        $this->assertSame(1, count($this->body($this->send('GET', '/api/logbook'))['entries']));
    }

    public function testReviewLinksRefuseUnknownTokensAndOtherSites(): void
    {
        $id = $this->studentWithWeek();
        $this->json('POST', "/api/logbook/entries/$id/submit");
        $token = $this->lastToken();
        $this->signOutLocally();
        $this->assertError($this->send('GET', '/api/logbook/review/' . str_repeat('A', 43)), 404, 'LINK_INVALID');
        $this->assertError($this->send('GET', '/api/logbook/review/short'), 404, 'NOT_FOUND');
        $forged = $this->foreign('POST', "/api/logbook/review/$token", '{"decision":"approve"}');
        $this->assertError($forged, 403, 'CSRF');
        $this->refused('POST', "/api/logbook/review/$token", ['decision' => 'maybe'], 400, 'VALIDATION');
        $this->assertSame('submitted', $this->sql("SELECT status FROM logbook_entry WHERE id = $id")->fetchColumn());
    }

    public function testOnlyStudentsKeepALogbookAndOnlyCpdcSeesEveryone(): void
    {
        $this->assertError($this->send('GET', '/api/logbook'), 401, 'UNAUTHENTICATED');
        $this->signInAs('staff');
        $this->assertError($this->send('GET', '/api/logbook'), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', '/api/logbook/students'), 403, 'FORBIDDEN');
        $entryId = $this->studentWithWeek();
        $studentId = (int) $this->sql("SELECT id FROM `user` WHERE google_sub = 'g-sub-student'")->fetchColumn();
        $this->assertError($this->send('GET', '/api/logbook/students'), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', "/api/logbook/students/$studentId"), 403, 'FORBIDDEN');
        $this->json('POST', "/api/logbook/entries/$entryId/submit");

        $this->signInAs('admin', 'admin');
        $list = $this->body($this->send('GET', '/api/logbook/students', '', ['q' => 'Fake Student']));
        $this->assertSame(1, $list['total']);
        $row = $list['items'][0];
        $counts = [$row['submitted'], $row['approved'], $row['returned'], $row['weeks_expected']];
        $this->assertSame([1, 0, 0, 2], $counts);
        $this->assertSame('Fake Engineering Sdn Bhd', $row['company']);
        $this->assertSame('supervisor@company.example', $row['supervisor_email']);
        $this->assertFalse($row['supervisor_email_personal']);
        $attention = $this->send('GET', '/api/logbook/students', '', ['attention' => '1']);
        $this->assertSame(0, $this->body($attention)['total']);
        $detail = $this->body($this->send('GET', "/api/logbook/students/$studentId"));
        $this->assertSame('Fake Student', $detail['student']['display_name']);
        $this->assertCount(1, $detail['entries']);
        $this->assertSame(
            1,
            $this->countRows("SELECT COUNT(*) FROM audit_log WHERE action = 'logbook.view'"
                . " AND target = 'user:$studentId'")
        );
        $this->assertError($this->send('GET', '/api/logbook/students/999999'), 404, 'NOT_FOUND');
    }
}
