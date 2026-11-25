<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

/** Skills self-rating over time and the gap against a job (slice 2b). */
final class SkillsTest extends ModuleTestCase
{
    /** @return list<array{area_id: int, level: int}> */
    private function ratings(int $programming, int $communication): array
    {
        return [
            ['area_id' => $this->area('Programming'), 'level' => $programming],
            ['area_id' => $this->area('Communication'), 'level' => $communication],
        ];
    }

    public function testRatingsAreKeptOverTimeNewestFirst(): void
    {
        $this->signInAs('student', 'student');
        $start = $this->body($this->send('GET', '/api/skills'));
        $this->assertCount(8, $start['areas']);
        $this->assertSame('Communication', $start['areas'][0]['name']);
        $this->assertSame([], $start['history']);

        $first = $this->json('POST', '/api/skills/assessments', ['ratings' => $this->ratings(2, 3)]);
        $this->assertSame(201, $first->status);
        $this->now += 3600;
        $saved = $this->json('POST', '/api/skills/assessments', ['ratings' => $this->ratings(3, 3)]);
        $this->assertSame(201, $saved->status, $saved->body);
        $history = $this->body($saved)['history'];
        $this->assertCount(2, $history);
        $this->assertSame(3, $history[0]['ratings'][(string) $this->area('Programming')]);
        $this->assertSame(2, $history[1]['ratings'][(string) $this->area('Programming')]);
    }

    public function testTheGapViewShowsBiggestGapsFirstAndCountsUnratedAreas(): void
    {
        $this->signInAs('admin', 'admin');
        $job = $this->openJob('Developer', '2030-12-31', [
            ['area_id' => $this->area('Programming'), 'level' => 4],
            ['area_id' => $this->area('Communication'), 'level' => 3],
            ['area_id' => $this->area('Leadership'), 'level' => 2],
        ]);
        $this->openJob('No skills listed');

        $this->signInAs('student', 'student');
        $jobs = $this->body($this->send('GET', '/api/skills'))['jobs'];
        $this->assertSame([$job], array_column($jobs, 'id')); // only jobs that ask for skills
        $this->json('POST', '/api/skills/assessments', ['ratings' => $this->ratings(2, 4)]);

        $gap = $this->body($this->send('GET', "/api/skills/gap/$job"));
        $this->assertSame('Developer', $gap['job']['title']);
        // Equal gaps by name: Leadership (never rated) before Programming.
        $this->assertSame(['Leadership', 'Programming', 'Communication'], array_column($gap['rows'], 'name'));
        $this->assertSame([2, 2, 0], array_column($gap['rows'], 'gap'));
        $this->assertSame([null, 2, 4], array_column($gap['rows'], 'mine'));
        $this->assertSame(1, $gap['met']);
        $this->assertSame(3, $gap['total']);
    }

    public function testRatingsAreValidated(): void
    {
        $this->signInAs('student', 'student');
        $post = fn (array $body) => $this->json('POST', '/api/skills/assessments', $body);
        $this->assertError($post(['ratings' => $this->ratings(6, 3)]), 400, 'VALIDATION');
        $this->assertError($post(['ratings' => $this->ratings(0, 3)]), 400, 'VALIDATION');
        $this->assertError($post(['ratings' => []]), 400, 'VALIDATION');
        $teamwork = $this->area('Teamwork');
        $twice = [['area_id' => $teamwork, 'level' => 2], ['area_id' => $teamwork, 'level' => 3]];
        $this->assertError($post(['ratings' => $twice]), 400, 'VALIDATION');
        $this->assertError($post(['ratings' => [['area_id' => 999999, 'level' => 2]]]), 400, 'VALIDATION');
        $this->assertError($post(['ratings' => $this->ratings(2, 3), 'user_id' => 1]), 400, 'VALIDATION');
        $this->assertSame([], $this->body($this->send('GET', '/api/skills'))['history']);
    }

    public function testTheGapNeedsAnOpenJob(): void
    {
        $this->signInAs('admin', 'admin');
        $job = $this->openJob('Past', '2026-01-01', [['area_id' => $this->area('Teamwork'), 'level' => 2]]);
        $this->signInAs('student', 'student');
        $this->assertError($this->send('GET', "/api/skills/gap/$job"), 404, 'NOT_FOUND');
        $this->assertError($this->send('GET', '/api/skills/gap/999999'), 404, 'NOT_FOUND');
    }

    public function testCpdcReadsTheAreasToSetAJobsSkills(): void
    {
        $this->signInAs('admin', 'admin');
        $this->assertCount(8, $this->body($this->send('GET', '/api/skills/areas'))['areas']);
        $this->signInAs('student', 'student');
        $this->assertCount(8, $this->body($this->send('GET', '/api/skills/areas'))['areas']);
        $this->signInAs('staff', 'staff');
        $this->assertError($this->send('GET', '/api/skills/areas'), 403, 'FORBIDDEN');
    }

    public function testRatingsArePrivateToThePerson(): void
    {
        $this->signInAs('student', 'student');
        $this->json('POST', '/api/skills/assessments', ['ratings' => $this->ratings(2, 3)]);
        $this->signInAs('student-b', 'student');
        $this->assertSame([], $this->body($this->send('GET', '/api/skills'))['history']);

        $this->signInAs('admin', 'admin');
        $this->assertError($this->send('GET', '/api/skills'), 403, 'FORBIDDEN');
        $this->signInAs('staff', 'staff');
        $refused = $this->json('POST', '/api/skills/assessments', ['ratings' => $this->ratings(2, 3)]);
        $this->assertError($refused, 403, 'FORBIDDEN');
        $this->jar = [];
        $this->assertError($this->send('GET', '/api/skills'), 401, 'UNAUTHENTICATED');
    }
}
