<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

/** Career profile, LinkedIn PDF import, alumni tracker and admin rules (docs/SPEC.md rules 7, 10-15). */
final class ProfileAndAlumniTest extends HttpTestCase
{
    private function onboardedStudent(string $google = 'student', string $linkedin = 'student'): int
    {
        $this->signIn('google', $google);
        $this->signIn('linkedin', $linkedin, ['mode' => 'link']);
        $done = $this->json('POST', '/api/onboarding/complete', [
            'profile_url' => 'https://www.linkedin.com/in/fake-' . $google,
            'follow_confirmed' => true,
            'consent' => true,
        ]);
        $this->assertSame(204, $done->status, $done->body);

        return (int) $this->body($this->send('GET', '/api/me'))['user']['id'];
    }

    private function signInAsAdmin(string $role = 'admin'): void
    {
        $this->jar = [];
        $this->signIn('google', 'admin');
        $this->pdo->exec(
            "UPDATE `user` SET role = '$role', onboarded_at = UTC_TIMESTAMP(3) WHERE email = 'admin@example.test'"
        );
        $this->refreshCsrf();
    }

    public function testThePersonSavesTheirCareerProfileJobsEducationAndSkills(): void
    {
        $this->onboardedStudent();
        $saved = $this->json('PUT', '/api/profile', [
            'fields' => ['headline' => 'Data student', 'about' => 'I build data tools.', 'graduation_year' => 2026,
                'employment_status' => 'seeking'],
            'experience' => [['title' => 'Data Intern', 'company' => 'Fake Co', 'start' => '2025-06', 'end' => null]],
            'education' => [['school' => 'Quest International University', 'degree' => 'BSc', 'end_year' => 2026]],
            'skills' => ['Python', 'SQL', 'Python'],
        ]);
        $this->assertSame(200, $saved->status, $saved->body);
        $profile = $this->body($saved);
        $this->assertSame('Data student', $profile['headline']);
        $this->assertSame('2025-06', $profile['experience'][0]['start']);
        $this->assertNull($profile['experience'][0]['end']);
        $this->assertSame(['Python', 'SQL'], $profile['skills']);
    }

    public function testAQiuAddressIsNeverThePersonalEmail(): void
    {
        $this->onboardedStudent();
        $refused = $this->json('PUT', '/api/profile', ['fields' => ['personal_email' => 'me@student.qiu.edu.my']]);
        $this->assertError($refused, 400, 'VALIDATION');
    }

    public function testUnknownFieldsAreRejected(): void
    {
        $this->onboardedStudent();
        $this->assertError($this->json('PUT', '/api/profile', ['fields' => ['role' => 'admin']]), 400, 'VALIDATION');
    }

    public function testTheLinkedInUrlCanBeChangedLaterAndTheChangeIsAudited(): void
    {
        $id = $this->onboardedStudent();
        $changed = $this->json('PATCH', '/api/profile/linkedin-url', ['profile_url' => 'linkedin.com/in/new-name']);
        $this->assertSame('https://www.linkedin.com/in/new-name', $this->body($changed)['profile_url']);
        $meta = $this
            ->sql("SELECT meta_json FROM audit_log WHERE action = 'linkedin.url_change' AND target = 'user:$id'")
            ->fetchColumn();
        $this->assertStringContainsString('new-name', (string) $meta);
    }

    public function testStudentsCannotReachTheTrackerOrOtherPeople(): void
    {
        $this->onboardedStudent();
        $this->assertError($this->send('GET', '/api/alumni'), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', '/api/people'), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', '/api/people/1'), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', '/api/audit'), 403, 'FORBIDDEN');
    }

    public function testAnAdminConvertsAStudentAndTheTrackerShowsThemWithTheirLinkedIn(): void
    {
        $studentId = $this->onboardedStudent();
        $this->signInAsAdmin();
        $converted = $this->body($this->json('POST', "/api/people/$studentId/alumni", ['graduation_year' => 2026]));
        $this->assertTrue($converted['linkedin_linked']);

        $list = $this->body($this->send('GET', '/api/alumni', '', ['year' => '2026']));
        $this->assertSame(1, $list['total']);
        $this->assertSame('https://www.linkedin.com/in/fake-student', $list['items'][0]['linkedin_url']);
        $this->assertSame('Faculty of Fake Studies', $list['items'][0]['faculty']);
        $this->assertSame(
            1,
            (int) $this->sql("SELECT COUNT(*) FROM audit_log WHERE action = 'alumni.view'")->fetchColumn()
        );
    }

    public function testConvertingByMatricListReportsEachRow(): void
    {
        $this->signIn('google', 'student'); // has matric FAKE-S-0001, no LinkedIn
        $this->signInAsAdmin();
        $result = $this->body($this->json('POST', '/api/alumni/convert', ['rows' => [
            ['matric_no' => 'fake-s-0001', 'graduation_year' => 2025],
            ['matric_no' => 'NOPE-1', 'graduation_year' => 2025],
        ]]))['results'];
        $this->assertSame([
            ['matric_no' => 'FAKE-S-0001', 'result' => 'no_linkedin'],
            ['matric_no' => 'NOPE-1', 'result' => 'not_found'],
        ], $result);
    }

    public function testEmploymentRateCountsWorkAndStudyOverKnownStatuses(): void
    {
        $cases = [['employed', 2024], ['further_study', 2024], ['seeking', 2024], ['unknown', 2024]];
        foreach ($cases as $i => [$status, $year]) {
            $this->pdo->exec(
                "INSERT INTO `user` (organisation_id, display_name, department, role)"
                . " VALUES (1, 'Fake A$i', 'Faculty X', 'alumni')"
            );
            $id = (int) $this->pdo->lastInsertId();
            $this->pdo->exec(
                "INSERT INTO career_profile (user_id, organisation_id, graduation_year, employment_status)"
                . " VALUES ($id, 1, $year, '$status')"
            );
        }
        $this->signInAsAdmin();
        $rows = $this->body($this->send('GET', '/api/alumni/stats'))['rows'];
        $row = array_values(array_filter($rows, fn ($r) => $r['faculty'] === 'Faculty X'))[0];
        $this->assertSame(4, $row['alumni']);
        $this->assertSame(3, $row['known']);
        $this->assertSame(2, $row['in_work_or_study']);
        $this->assertSame(1, $row['unknown']);
        $this->assertSame(0.667, $row['rate']);
    }

    public function testTheCsvEscapesFormulasAndIsAudited(): void
    {
        $this->pdo->exec(
            "INSERT INTO `user` (organisation_id, display_name, role) VALUES (1, '=HYPERLINK(\"x\")', 'alumni')"
        );
        $this->signInAsAdmin();
        $csv = $this->send('GET', '/api/alumni/export');
        $this->assertSame(200, $csv->status);
        $this->assertStringContainsString("\"'=HYPERLINK(\"\"x\"\")\"", $csv->body);
        $this->assertSame(
            1,
            (int) $this->sql("SELECT COUNT(*) FROM audit_log WHERE action = 'alumni.export'")->fetchColumn()
        );
    }

    public function testAnAdminCannotMakeAdminsOrChangeTheirOwnRoleButTheSuperadminCan(): void
    {
        $studentId = $this->onboardedStudent();
        $this->signInAsAdmin();
        $adminId = (int) $this->body($this->send('GET', '/api/me'))['user']['id'];
        $this->assertError($this->json('PATCH', "/api/people/$studentId/role", ['role' => 'admin']), 403, 'FORBIDDEN');
        $this->assertError($this->json('PATCH', "/api/people/$adminId/role", ['role' => 'staff']), 403, 'FORBIDDEN');
        $this->assertSame(204, $this->json('PATCH', "/api/people/$studentId/role", ['role' => 'staff'])->status);
        $this->assertError(
            $this->json('PATCH', "/api/people/$studentId/role", ['role' => 'superadmin']),
            400,
            'VALIDATION'
        );

        $this->jar = [];
        $this->signIn('google', 'superadmin');
        $this->assertSame(204, $this->json('PATCH', "/api/people/$studentId/role", ['role' => 'admin'])->status);
    }

    public function testAnAlumnusConfirmsTheirJobAndAHistoryRowIsKept(): void
    {
        $id = $this->onboardedStudent('student', 'alumni');
        $this->pdo->exec("UPDATE `user` SET role = 'alumni' WHERE id = $id");
        $this->assertError(
            $this->json('POST', '/api/profile/job-confirmation', ['employment_status' => 'employed']),
            400,
            'VALIDATION'
        );
        $ok = $this->json('POST', '/api/profile/job-confirmation', [
            'employment_status' => 'employed', 'title' => 'Data Analyst', 'company' => 'Fake Co',
        ]);
        $this->assertSame(204, $ok->status, $ok->body);
        $this->assertFalse($this->body($this->send('GET', '/api/me'))['job_confirmation_due']);
        $this->assertSame(
            1,
            (int) $this->sql("SELECT COUNT(*) FROM job_confirmation WHERE user_id = $id")->fetchColumn()
        );
    }

    public function testAStudentCannotUseTheAlumniJobConfirmation(): void
    {
        $this->onboardedStudent();
        $this->assertError(
            $this->json('POST', '/api/profile/job-confirmation', ['employment_status' => 'seeking']),
            403,
            'FORBIDDEN'
        );
    }
}
