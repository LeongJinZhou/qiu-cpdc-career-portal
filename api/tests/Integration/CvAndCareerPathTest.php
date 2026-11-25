<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

/** CV builder (own CV only, built on the career profile) and career paths by programme. */
final class CvAndCareerPathTest extends HttpTestCase
{
    use SignsInAs;

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function cv(array $overrides = []): array
    {
        return $overrides + [
            'contact' => ['email' => 'fake.student@gmail.example', 'phone' => '+60 12-345 6789', 'location' => 'Ipoh',
                'website' => ''],
            'headline' => 'Data student',
            'summary' => 'I build data tools.',
            'hidden_experience' => [],
            'hidden_education' => [],
            'show_skills' => true,
            'sections' => [['title' => 'Projects', 'items' => [
                ['heading' => 'Fake dashboard', 'sub' => 'Final-year project', 'period' => '2026', 'detail' => 'React'],
                ['heading' => '  '],
            ]], ['title' => ' ', 'items' => []]],
        ];
    }

    public function testANewCvStartsFromTheCareerProfile(): void
    {
        $this->signInAs('student', 'student');
        $this->json('PUT', '/api/profile', [
            'fields' => ['headline' => 'Data student', 'about' => 'About me', 'location' => 'Ipoh'],
            'experience' => [['title' => 'Data Intern', 'company' => 'Fake Co', 'start' => '2025-06']],
            'skills' => ['SQL'],
        ]);
        $cv = $this->body($this->send('GET', '/api/cv'));
        $this->assertNull($cv['saved_at']);
        $this->assertSame('Data student', $cv['cv']['headline']);
        $this->assertSame('About me', $cv['cv']['summary']);
        $this->assertSame('student@example.test', $cv['cv']['contact']['email']);
        $this->assertSame('Data Intern', $cv['profile']['experience'][0]['title']);
        $this->assertSame(['SQL'], $cv['profile']['skills']);
    }

    public function testTheCvIsSavedOnTheServerAndOnlyOwnEntriesCanBeHidden(): void
    {
        $this->signInAs('student-b', 'student');
        $this->json('PUT', '/api/profile', ['experience' => [['title' => 'Other job', 'company' => 'Other Co']]]);
        $foreign = (int) $this->body($this->send('GET', '/api/profile'))['experience'][0]['id'];

        $this->signInAs('student', 'student');
        $this->json('PUT', '/api/profile', ['experience' => [['title' => 'Data Intern', 'company' => 'Fake Co']]]);
        $own = (int) $this->body($this->send('GET', '/api/profile'))['experience'][0]['id'];

        $saved = $this->json('PUT', '/api/cv', $this->cv(['hidden_experience' => [$own, $foreign]]));
        $this->assertSame(200, $saved->status, $saved->body);
        $cv = $this->body($saved);
        $this->assertNotNull($cv['saved_at']);
        $this->assertSame([$own], $cv['cv']['hidden_experience'], "another person's entry is dropped");
        $this->assertEquals([['title' => 'Projects', 'items' => [
            ['heading' => 'Fake dashboard', 'sub' => 'Final-year project', 'period' => '2026', 'detail' => 'React'],
        ]]], $cv['cv']['sections'], 'empty items and sections are left out');
        $this->assertSame('+60 12-345 6789', $this->body($this->send('GET', '/api/cv'))['cv']['contact']['phone']);

        // Another person sees only their own CV.
        $this->signInAs('student-b', 'student');
        $this->assertNull($this->body($this->send('GET', '/api/cv'))['saved_at']);
    }

    public function testTheCvRejectsUnknownFieldsAndUnsafeLinks(): void
    {
        $this->signInAs('student', 'student');
        $this->assertError($this->json('PUT', '/api/cv', $this->cv(['photo' => 'x'])), 400, 'VALIDATION');
        $bad = $this->cv();
        $bad['contact']['website'] = 'javascript:alert(1)';
        $this->assertError($this->json('PUT', '/api/cv', $bad), 400, 'VALIDATION');
        $bad = $this->cv();
        $bad['sections'][0]['items'][0]['html'] = '<b>x</b>';
        $this->assertError($this->json('PUT', '/api/cv', $bad), 400, 'VALIDATION');
    }

    public function testAPendingAccountHasNoCvOrCareerPath(): void
    {
        $this->signInAs('graduate', 'pending');
        $this->assertError($this->send('GET', '/api/cv'), 403, 'FORBIDDEN');
        $this->assertError($this->json('PUT', '/api/cv', $this->cv()), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', '/api/career-paths'), 403, 'FORBIDDEN');
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function path(array $overrides = []): array
    {
        return $overrides + [
            'programme' => 'Bachelor of Fake Computing',
            'title' => 'Data Analyst',
            'summary' => 'Turns data into decisions.',
            'skills' => ['SQL', 'Python', 'sql'],
            'steps' => [
                ['title' => 'Finish a data internship'],
                ['title' => 'Build a dashboard', 'detail' => 'Power BI'],
            ],
        ];
    }

    public function testCpdcWritesAPathAndAStudentOfThatProgrammeSeesItAndTicksSteps(): void
    {
        $this->signInAs('admin', 'admin');
        $created = $this->json('POST', '/api/career-paths', $this->path());
        $this->assertSame(201, $created->status, $created->body);
        $this->json('POST', '/api/career-paths', $this->path(['programme' => 'Bachelor of Other', 'title' => 'Nurse']));
        $this->assertSame(2, (int) $this->sql("SELECT COUNT(*) FROM audit_log WHERE action = 'careerpath.create'")
            ->fetchColumn());

        $this->signInAs('student', 'student');
        $this->json('PUT', '/api/profile', ['fields' => ['programme' => 'bachelor of fake computing'],
            'skills' => ['Python']]);
        $view = $this->body($this->send('GET', '/api/career-paths'));
        $this->assertSame(['Bachelor of Fake Computing', 'Bachelor of Other'], $view['programmes']);
        $this->assertSame('Bachelor of Fake Computing', $view['programme'], 'own programme first, any case');
        $path = $view['paths'][0];
        $this->assertSame([['name' => 'SQL', 'have' => false], ['name' => 'Python', 'have' => true]], $path['skills']);
        $this->assertSame(0, $path['done_count']);

        $step = $path['steps'][0]['id'];
        $first = $this->json('PUT', "/api/career-paths/steps/$step", ['done' => true]);
        $twice = $this->json('PUT', "/api/career-paths/steps/$step", ['done' => true]);
        $this->assertSame([204, 204], [$first->status, $twice->status], 'ticking twice is fine');
        $this->assertSame(1, $this->body($this->send('GET', '/api/career-paths'))['paths'][0]['done_count']);

        $other = $this->body($this->send('GET', '/api/career-paths', '', ['programme' => 'Bachelor of Other']));
        $this->assertSame('Nurse', $other['paths'][0]['title']);

        // Ticks are per person.
        $this->signInAs('student-b', 'student');
        $this->assertSame(0, $this->body($this->send('GET', '/api/career-paths'))['paths'][0]['done_count']);
        $this->json('PUT', "/api/career-paths/steps/$step", ['done' => false]);
        $this->signInAs('student', 'student');
        $this->assertSame(1, $this->body($this->send('GET', '/api/career-paths'))['paths'][0]['done_count']);
    }

    public function testEditingAPathKeepsTicksOnKeptStepsAndRemovesDroppedOnes(): void
    {
        $this->signInAs('admin', 'admin');
        $path = $this->body($this->json('POST', '/api/career-paths', $this->path()))['paths'][0];
        [$keep, $drop] = [$path['steps'][0]['id'], $path['steps'][1]['id']];
        $this->json('PUT', "/api/career-paths/steps/$keep", ['done' => true]);
        $this->json('PUT', "/api/career-paths/steps/$drop", ['done' => true]);

        $edited = $this->json('PUT', '/api/career-paths/' . $path['id'], $this->path(['steps' => [
            ['title' => 'Get certified'], ['id' => $keep, 'title' => 'Finish an internship'],
        ]]));
        $this->assertSame(200, $edited->status, $edited->body);
        $steps = $this->body($edited)['paths'][0]['steps'];
        $this->assertSame(['Get certified', 'Finish an internship'], array_column($steps, 'title'));
        $this->assertSame([false, true], array_column($steps, 'done'));
        $this->assertSame(
            0,
            (int) $this->sql("SELECT COUNT(*) FROM career_path_progress WHERE step_id = $drop")->fetchColumn()
        );

        $this->assertSame(204, $this->send('DELETE', '/api/career-paths/' . $path['id'])->status);
        $this->assertSame([], $this->body($this->send('GET', '/api/career-paths'))['paths']);
        $this->assertSame(1, (int) $this->sql("SELECT COUNT(*) FROM audit_log WHERE action = 'careerpath.delete'")
            ->fetchColumn());
    }

    public function testOnlyCpdcWritesPaths(): void
    {
        $this->signInAs('admin', 'admin');
        $id = $this->body($this->json('POST', '/api/career-paths', $this->path()))['paths'][0]['id'];
        foreach (['student' => 'student', 'staff' => 'staff', 'graduate' => 'alumni'] as $persona => $role) {
            $this->signInAs($persona, $role);
            $this->assertError($this->json('POST', '/api/career-paths', $this->path()), 403, 'FORBIDDEN');
            $this->assertError($this->json('PUT', "/api/career-paths/$id", $this->path()), 403, 'FORBIDDEN');
            $this->assertError($this->send('DELETE', "/api/career-paths/$id"), 403, 'FORBIDDEN');
        }
        $this->signInAs('admin', 'admin');
        $this->assertError($this->json('POST', '/api/career-paths', $this->path(['steps' => [['title' => 'x',
            'done' => true]]])), 400, 'VALIDATION');
        $this->assertError($this->json('PUT', '/api/career-paths/999999', $this->path()), 404, 'NOT_FOUND');
        $this->assertError($this->json('PUT', '/api/career-paths/steps/999999', ['done' => true]), 404, 'NOT_FOUND');
    }

    public function testAStepOfAnotherOrganisationCannotBeTicked(): void
    {
        $other = $this->insertOrganisation('Fake Other University');
        $this->pdo->prepare(
            'INSERT INTO career_path (organisation_id, programme, title, skills_json) VALUES (?, "X", "Y", "[]")'
        )->execute([$other]);
        $pathId = (int) $this->pdo->lastInsertId();
        $this->pdo->prepare(
            'INSERT INTO career_path_step (organisation_id, path_id, title, position) VALUES (?, ?, "Z", 0)'
        )->execute([$other, $pathId]);
        $stepId = (int) $this->pdo->lastInsertId();
        $this->signInAs('student', 'student');
        $this->assertError($this->json('PUT', "/api/career-paths/steps/$stepId", ['done' => true]), 404, 'NOT_FOUND');
        $this->assertSame([], $this->body($this->send('GET', '/api/career-paths'))['programmes']);
        $this->signInAs('admin', 'admin');
        $this->assertError($this->send('DELETE', "/api/career-paths/$pathId"), 404, 'NOT_FOUND');
    }
}
