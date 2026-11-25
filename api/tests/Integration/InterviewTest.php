<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

use Cpdc\Interview\Ai\FakeCoach;

/** Interview practice with AI feedback through the fake driver, and the CPDC question bank. */
final class InterviewTest extends SliceThreeBTestCase
{
    private const ANSWER = 'In my final year project the situation was a late dataset. My task was to clean it.'
        . ' My action was to write scripts, and as a result we finished 2 weeks early.';

    /** @var array<string, string|false> */
    private array $oldEnv = [];

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['AI_DRIVER', 'ANTHROPIC_API_KEY'] as $key) {
            $this->oldEnv[$key] = getenv($key);
        }
        putenv('AI_DRIVER=fake');
        putenv('ANTHROPIC_API_KEY');
    }

    protected function tearDown(): void
    {
        foreach ($this->oldEnv as $key => $value) {
            putenv($value === false ? $key : "$key=$value");
        }
        parent::tearDown();
    }

    /** @return array<mixed> the new session */
    private function start(string $field = 'General'): array
    {
        $started = $this->json('POST', '/api/interview/sessions', ['field' => $field]);
        $this->assertSame(201, $started->status, $started->body);

        return $this->body($started);
    }

    /** @param array<mixed> $session */
    private function answer(array $session, int $index = 0, string $text = self::ANSWER): \Cpdc\Http\Response
    {
        $item = $session['items'][$index]['id'];

        return $this->json('POST', "/api/interview/sessions/{$session['id']}/items/$item/answer", ['answer' => $text]);
    }

    public function testStatusSaysReadyAndListsTheFieldsOfTheBank(): void
    {
        $this->person('student', 'student');
        $status = $this->body($this->send('GET', '/api/interview/status'));
        $this->assertTrue($status['ready']);
        $this->assertSame(0, $status['used_today']);
        $this->assertSame(20, $status['daily_limit']);
        $this->assertSame(2000, $status['max_chars']);
        $this->assertContains(['field' => 'General', 'questions' => 6], $status['fields']);
    }

    public function testWithoutAKeyTheFeatureSaysItIsNotSetUp(): void
    {
        putenv('AI_DRIVER=anthropic');
        $this->person('student', 'student');
        $this->assertFalse($this->body($this->send('GET', '/api/interview/status'))['ready']);
        $session = $this->start();
        $this->assertError($this->answer($session), 503, 'AI_NOT_SET_UP');

        putenv('AI_DRIVER');
        $this->assertFalse($this->body($this->send('GET', '/api/interview/status'))['ready']);
    }

    public function testAStudentPractisesAndGetsFeedbackStoredOnTheSession(): void
    {
        $this->person('student', 'student');
        $session = $this->start();
        $this->assertCount(5, $session['items']);
        $this->assertNull($session['items'][0]['answer']);

        $answered = $this->answer($session);
        $this->assertSame(200, $answered->status, $answered->body);
        $item = $this->body($answered);
        $this->assertSame(self::ANSWER, $item['answer']);
        $this->assertSame(3, $item['feedback']['score']);
        $this->assertNotEmpty($item['feedback']['strengths']);

        $shown = $this->body($this->send('GET', "/api/interview/sessions/{$session['id']}"));
        $this->assertSame($item['feedback'], $shown['items'][0]['feedback']);
        $list = $this->body($this->send('GET', '/api/interview/sessions'))['items'];
        $this->assertSame(['questions' => 5, 'answered' => 1], [
            'questions' => $list[0]['questions'], 'answered' => $list[0]['answered'],
        ]);
        $this->assertEquals(3, $list[0]['average']); // JSON writes 3.0 as 3
        $this->assertSame(1, $this->body($this->send('GET', '/api/interview/status'))['used_today']);
        $driver = $this->sql('SELECT ai_driver FROM interview_item WHERE answer IS NOT NULL')->fetchColumn();
        $this->assertSame('fake', $driver);
    }

    public function testSessionsAndAnswersBelongToTheirOwnerOnly(): void
    {
        $this->person('student', 'student');
        $session = $this->start();
        $this->person('student-b', 'student');
        $this->assertError($this->send('GET', "/api/interview/sessions/{$session['id']}"), 404, 'NOT_FOUND');
        $this->assertError($this->answer($session), 404, 'NOT_FOUND');
        $this->assertSame([], $this->body($this->send('GET', '/api/interview/sessions'))['items']);
    }

    public function testAnswersHaveAMinimumAndAMaximumLength(): void
    {
        $this->person('student', 'student');
        $session = $this->start();
        $this->assertError($this->answer($session, 0, 'Too short.'), 400, 'VALIDATION');
        $this->setting('interview_answer_max_chars', '50');
        $this->assertError($this->answer($session, 0, str_repeat('word ', 20)), 400, 'VALIDATION');
        $this->assertError($this->answer($session, 0, str_repeat('a', 4001)), 400, 'VALIDATION');
        $this->assertError(
            $this->json('POST', "/api/interview/sessions/{$session['id']}/items/{$session['items'][0]['id']}/answer", [
                'answer' => self::ANSWER, 'score' => 5,
            ]),
            400,
            'VALIDATION'
        );
    }

    public function testEachQuestionIsAnsweredOnce(): void
    {
        $this->person('student', 'student');
        $session = $this->start();
        $this->assertSame(200, $this->answer($session)->status);
        $this->assertError($this->answer($session), 409, 'ALREADY_ANSWERED');
    }

    public function testFeedbackIsCappedPerUserPerDay(): void
    {
        $this->setting('interview_ai_per_user_per_day', '1');
        $this->person('student', 'student');
        $session = $this->start();
        $this->assertSame(200, $this->answer($session, 0)->status);
        $this->assertError($this->answer($session, 1), 429, 'AI_DAILY_LIMIT');
        $this->assertNull(
            $this->body($this->send('GET', "/api/interview/sessions/{$session['id']}"))['items'][1]['answer'],
            'a refused answer is not stored'
        );

        $this->now += 86400 + 1;
        $this->person('student', 'student');
        $this->assertSame(200, $this->answer($session, 1)->status);
    }

    public function testAProviderFailureFreesTheQuestionForAnotherTry(): void
    {
        $this->person('student', 'student');
        $session = $this->start();
        $failing = self::ANSWER . ' ' . FakeCoach::FAIL_MARKER;
        $this->assertError($this->answer($session, 0, $failing), 502, 'AI_UNAVAILABLE');
        $this->assertSame(0, $this->body($this->send('GET', '/api/interview/status'))['used_today']);
        $this->assertSame(200, $this->answer($session)->status);
    }

    public function testAiCallsAreRateLimitedPerMinute(): void
    {
        $this->setting('rate_ai_per_user_per_min', '1');
        $this->person('student', 'student');
        $session = $this->start();
        $this->assertSame(200, $this->answer($session, 0)->status);
        $this->assertError($this->answer($session, 1), 429, 'RATE_LIMITED');
    }

    public function testAlumniPractiseButStaffDoNot(): void
    {
        $this->person('graduate', 'alumni');
        $this->assertSame(201, $this->json('POST', '/api/interview/sessions', ['field' => 'Business'])->status);
        $this->person('staff', 'staff');
        $this->assertError($this->send('GET', '/api/interview/status'), 403, 'FORBIDDEN');
        $this->assertError($this->json('POST', '/api/interview/sessions', ['field' => 'General']), 403, 'FORBIDDEN');
    }

    public function testAFieldWithoutQuestionsCannotStart(): void
    {
        $this->person('student', 'student');
        $this->assertError($this->json('POST', '/api/interview/sessions', ['field' => 'Astronomy']), 400, 'VALIDATION');
    }

    public function testOnlyCpdcKeepsTheBankAndEveryChangeIsAudited(): void
    {
        $this->person('student', 'student');
        $this->assertError($this->send('GET', '/api/interview/questions'), 403, 'FORBIDDEN');
        $this->assertError(
            $this->json('POST', '/api/interview/questions', ['field' => 'Law', 'question' => 'Why law, and why now?']),
            403,
            'FORBIDDEN'
        );

        $this->person('admin', 'admin');
        $created = $this->json('POST', '/api/interview/questions', [
            'field' => '  Law ', 'question' => 'Why do you want to practise law?', 'tip' => 'Be specific.',
        ]);
        $this->assertSame(201, $created->status, $created->body);
        $question = $this->body($created);
        $this->assertSame('Law', $question['field']);
        $this->assertTrue($question['active']);
        $list = $this->body($this->send('GET', '/api/interview/questions', '', ['field' => 'Law']));
        $this->assertSame(1, $list['total']);
        $this->assertContains('Law', $list['fields']);

        $off = $this->json('PUT', "/api/interview/questions/{$question['id']}", ['active' => false]);
        $this->assertFalse($this->body($off)['active']);
        $this->assertError($this->json('PUT', '/api/interview/questions/999999', ['active' => true]), 404, 'NOT_FOUND');
        $this->assertError($this->json('POST', '/api/interview/questions', ['field' => 'Law']), 400, 'VALIDATION');

        $this->as('student');
        $this->assertError($this->json('POST', '/api/interview/sessions', ['field' => 'Law']), 400, 'VALIDATION');
        $this->assertSame(2, (int) $this->sql(
            "SELECT COUNT(*) FROM audit_log WHERE action IN ('interview.question_create', 'interview.question_update')"
        )->fetchColumn());
    }
}
