<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

use Cpdc\Http\Response;

/** Opt-in alumni directory and mentoring (docs/SPEC.md section 9). */
final class NetworkTest extends SliceThreeBTestCase
{
    private const ALL_HIDDEN = [
        'visible' => true, 'show_title' => false, 'show_company' => false, 'show_faculty' => false,
        'show_year' => false,
    ];
    private const MESSAGE = 'Hello, I study data science and would like advice on my first job search.';

    /** An alumnus with a full career profile (persona "graduate" unless given). */
    private function alumnus(string $persona = 'graduate'): int
    {
        $id = $this->person($persona, 'alumni');
        $this->pdo->prepare(
            'INSERT INTO career_profile (user_id, organisation_id, faculty, graduation_year, employment_status,'
            . " current_title, current_company, personal_email) VALUES (?, 1, 'Faculty of Fake Studies', 2022,"
            . " 'employed', 'Data Analyst', 'Hidden Company Sdn Bhd', ?)"
        )->execute([$id, $persona . '@personal.example']);

        return $id;
    }

    /** @param array<string, bool> $choices */
    private function optIn(array $choices = self::ALL_HIDDEN): void
    {
        $saved = $this->json('PUT', '/api/network/me', $choices + self::ALL_HIDDEN);
        $this->assertSame(200, $saved->status, $saved->body);
    }

    private function offer(int $slots = 3, bool $active = true): void
    {
        $saved = $this->json('PUT', '/api/network/mentoring', [
            'active' => $active, 'topics' => ['CV review', 'Data careers', 'cv review'], 'slots_per_month' => $slots,
        ]);
        $this->assertSame(200, $saved->status, $saved->body);
    }

    /** A visible mentor (persona) and a signed-in student; returns the mentor id. Leaves the student signed in. */
    private function mentorAndStudent(int $slots = 3, string $mentor = 'graduate'): int
    {
        $id = $this->alumnus($mentor);
        $this->optIn();
        $this->offer($slots);
        $this->person('student', 'student');

        return $id;
    }

    /** @param array<string, mixed> $body */
    private function ask(int $mentor, array $body = ['message' => self::MESSAGE]): Response
    {
        return $this->json('POST', "/api/network/mentors/$mentor/requests", $body);
    }

    /** Asks and returns the new request id. */
    private function askedId(int $mentor): int
    {
        $asked = $this->ask($mentor);
        $this->assertSame(201, $asked->status, $asked->body);

        return (int) $this->body($asked)['id'];
    }

    /** @param array<string, mixed> $body */
    private function act(int $request, string $action, array $body = []): Response
    {
        return $this->json('POST', "/api/network/requests/$request/$action", $body);
    }

    /**
     * @param array<string, string> $query
     * @return array<mixed>
     */
    private function directory(array $query = []): array
    {
        return $this->body($this->send('GET', '/api/network/directory', '', $query));
    }

    /** @return array<mixed> */
    private function requests(): array
    {
        return $this->body($this->send('GET', '/api/network/requests'));
    }

    public function testNobodyIsListedBeforeOptingIn(): void
    {
        $this->alumnus();
        $this->person('student', 'student');
        $list = $this->directory();
        $this->assertSame(0, $list['total']);
        $this->assertSame([], $list['items']);
    }

    public function testOnlyTheFieldsTheAlumnusChoseAreShown(): void
    {
        $id = $this->alumnus();
        $this->optIn(['show_title' => true]);
        $this->person('student', 'student');

        $this->assertSame([
            'id' => $id,
            'display_name' => 'Fake Graduate',
            'linkedin_url' => 'https://www.linkedin.com/in/fake-graduate',
            'title' => 'Data Analyst',
            'company' => null,
            'faculty' => null,
            'graduation_year' => null,
            'mentor' => null,
        ], $this->directory()['items'][0]);
    }

    public function testSearchAndFiltersNeverMatchHiddenFields(): void
    {
        $this->alumnus();
        $this->optIn(['show_title' => true]);
        $this->person('student', 'student');
        $count = fn (array $q): int => $this->directory($q)['total'];

        $this->assertSame(1, $count(['q' => 'Analyst']));
        $this->assertSame(0, $count(['q' => 'Hidden Company']));
        $this->assertSame(0, $count(['faculty' => 'Faculty of Fake Studies']));
        $this->assertSame(0, $count(['year' => '2022']));
        $this->assertSame([], $this->directory()['faculties']);

        $this->as('graduate');
        $this->optIn(['show_title' => true, 'show_faculty' => true, 'show_year' => true]);
        $this->as('student');
        $this->assertSame(1, $count(['faculty' => 'Faculty of Fake Studies', 'year' => '2022']));
        $this->assertSame(['Faculty of Fake Studies'], $this->directory()['faculties']);
    }

    public function testHidingAgainRemovesTheEntryAndStudentsAreNeverListed(): void
    {
        $this->alumnus();
        $this->optIn();
        $this->optIn(['visible' => false]);
        $this->person('student', 'student');
        $this->pdo->exec(
            'INSERT INTO network_profile (user_id, organisation_id, visible)'
            . " SELECT id, 1, 1 FROM `user` WHERE google_sub = 'g-sub-student'"
        );
        $this->assertSame(0, $this->directory()['total']);
    }

    public function testOnlyAlumniKeepADirectoryEntryOrOfferMentoring(): void
    {
        $this->person('student', 'student');
        $this->assertError($this->send('GET', '/api/network/me'), 403, 'FORBIDDEN');
        $this->assertError($this->json('PUT', '/api/network/me', self::ALL_HIDDEN), 403, 'FORBIDDEN');
        $this->person('staff', 'staff');
        $this->assertSame(200, $this->send('GET', '/api/network/directory')->status);
        $offer = ['active' => true, 'topics' => ['CV'], 'slots_per_month' => 1];
        $this->assertError($this->json('PUT', '/api/network/mentoring', $offer), 403, 'FORBIDDEN');
    }

    public function testUnknownFieldsAndShortMessagesAreRejected(): void
    {
        $mentor = $this->mentorAndStudent();
        $this->assertError($this->ask($mentor, ['message' => 'Hi']), 400, 'VALIDATION');
        $extra = ['message' => self::MESSAGE, 'status' => 'accepted'];
        $this->assertError($this->ask($mentor, $extra), 400, 'VALIDATION');
        $this->as('graduate');
        $this->assertError($this->json('PUT', '/api/network/me', ['visible' => true]), 400, 'VALIDATION');
    }

    public function testAStudentAsksTheMentorAcceptsAndBothSeeTheMatch(): void
    {
        $mentor = $this->mentorAndStudent();
        $listed = $this->directory(['mentors' => '1'])['items'][0]['mentor'];
        $this->assertSame(['topics' => ['CV review', 'Data careers'], 'slots_left' => 3], $listed);

        $id = $this->askedId($mentor);
        $sent = $this->requests()['sent'][0];
        $this->assertSame('waiting', $sent['status']);
        $this->assertNull($sent['person']['email'], 'no contact details before the mentor accepts');

        $this->as('graduate');
        $received = $this->requests()['received'][0];
        $this->assertSame(self::MESSAGE, $received['message']);
        $this->assertSame('https://www.linkedin.com/in/fake-student', $received['person']['linkedin_url']);
        $this->assertNull($received['person']['email']);
        $this->assertSame(204, $this->act($id, 'accept', ['reply' => 'Happy to help.'])->status);
        $this->assertSame('student@example.test', $this->requests()['received'][0]['person']['email']);

        $this->as('student');
        $sent = $this->requests()['sent'][0];
        $this->assertSame('accepted', $sent['status']);
        $this->assertSame('Happy to help.', $sent['reply']);
        $this->assertSame('graduate@personal.example', $sent['person']['email']);
        $this->assertSame(2, $this->directory()['items'][0]['mentor']['slots_left']);
    }

    public function testHiddenOrPausedMentorsCannotBeAsked(): void
    {
        $mentor = $this->alumnus();
        $this->offer();
        $this->person('student', 'student');
        $this->assertError($this->ask($mentor), 404, 'NOT_FOUND');

        $this->as('graduate');
        $this->optIn();
        $this->offer(3, false);
        $this->as('student');
        $this->assertError($this->ask($mentor), 404, 'NOT_FOUND');
        $this->assertSame(0, $this->directory(['mentors' => '1'])['total']);
    }

    public function testOneOpenRequestPerMentorAndACapOnOpenRequests(): void
    {
        $first = $this->mentorAndStudent();
        $this->askedId($first);
        $this->assertError($this->ask($first), 409, 'ALREADY_ASKED');

        $second = $this->alumnus('student-b');
        $this->optIn();
        $this->offer();
        $this->setting('mentor_open_requests_max', '1');
        $this->as('student');
        $this->assertError($this->ask($second), 409, 'TOO_MANY_OPEN');
    }

    public function testSlotsPerMonthLimitAcceptsAndFreeUpNextMonth(): void
    {
        $mentor = $this->mentorAndStudent(1);
        $id = $this->askedId($mentor);
        $this->person('admin', 'student'); // a second student
        $second = $this->askedId($mentor);

        $this->as('graduate');
        $this->assertSame(204, $this->act($id, 'accept')->status);
        $this->assertError($this->act($second, 'accept'), 409, 'MENTOR_FULL');

        $this->person('staff', 'student'); // a third student cannot ask a full mentor
        $this->assertError($this->ask($mentor), 409, 'MENTOR_FULL');

        $this->now += 32 * 86400;
        $this->person('graduate', 'alumni'); // sessions end after hours: sign in again next month
        $this->assertSame(204, $this->act($second, 'accept')->status);
    }

    public function testOnlyTheMentorDecidesAndOnlyTheStudentWithdraws(): void
    {
        $mentor = $this->mentorAndStudent();
        $id = $this->askedId($mentor);
        $this->assertError($this->act($id, 'accept'), 403, 'FORBIDDEN');

        $this->alumnus('student-b');
        $this->assertError($this->act($id, 'accept'), 404, 'NOT_FOUND');
        $this->assertError($this->act($id, 'withdraw'), 403, 'FORBIDDEN');

        $this->as('student');
        $this->assertSame(204, $this->act($id, 'withdraw')->status);
        $this->as('graduate');
        $this->assertError($this->act($id, 'decline'), 404, 'NOT_FOUND');
    }

    public function testTheMentorCanDecline(): void
    {
        $mentor = $this->mentorAndStudent();
        $id = $this->askedId($mentor);
        $this->as('graduate');
        $this->assertSame(204, $this->act($id, 'decline', ['reply' => 'Full this term.'])->status);
        $this->as('student');
        $sent = $this->requests()['sent'][0];
        $this->assertSame('declined', $sent['status']);
        $this->assertNull($sent['person']['email']);
    }

    public function testMentorRequestsAreRateLimitedPerHour(): void
    {
        $first = $this->mentorAndStudent();
        $second = $this->alumnus('student-b');
        $this->optIn();
        $this->offer();
        $this->setting('rate_mentor_request_per_user_per_hour', '1');
        $this->as('student');
        $this->askedId($first);
        $this->assertError($this->ask($second), 429, 'RATE_LIMITED');
    }

    public function testCpdcSeesActivityWithoutMessagesAndTheViewIsAudited(): void
    {
        $mentor = $this->mentorAndStudent();
        $id = $this->askedId($mentor);
        $this->assertError($this->send('GET', '/api/network/activity'), 403, 'FORBIDDEN');
        $this->as('graduate');
        $this->act($id, 'accept', ['reply' => 'Private reply text']);
        $this->assertError($this->send('GET', '/api/network/activity'), 403, 'FORBIDDEN');

        $this->person('admin', 'admin');
        $activity = $this->send('GET', '/api/network/activity');
        $this->assertSame(200, $activity->status, $activity->body);
        $data = $this->body($activity);
        $this->assertSame(1, $data['mentors']);
        $this->assertSame(1, $data['requests']['accepted']);
        $this->assertSame('Fake Student', $data['matches'][0]['student']['display_name']);
        $this->assertSame('https://www.linkedin.com/in/fake-graduate', $data['matches'][0]['mentor']['linkedin_url']);
        $this->assertStringNotContainsString('advice on my first job', $activity->body);
        $this->assertStringNotContainsString('Private reply', $activity->body);
        $this->assertSame(
            1,
            (int) $this->sql("SELECT COUNT(*) FROM audit_log WHERE action = 'mentoring.view'")->fetchColumn()
        );
    }

    public function testAlumniSeeTheirOwnChoicesAndWhatOthersSee(): void
    {
        $this->alumnus();
        $this->optIn(['show_company' => true]);
        $this->offer(2);
        $own = $this->body($this->send('GET', '/api/network/me'));
        $this->assertTrue($own['choices']['visible']);
        $this->assertTrue($own['choices']['show_company']);
        $this->assertFalse($own['choices']['show_title']);
        $this->assertSame('Hidden Company Sdn Bhd', $own['fields']['company']);
        $offer = ['active' => true, 'topics' => ['CV review', 'Data careers'], 'slots_per_month' => 2];
        $this->assertSame($offer, $own['mentoring']);
    }
}
