<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

/** Employers, jobs and applications (slice 2b): CPDC posts, students and alumni apply and see only their own. */
final class JobsTest extends ModuleTestCase
{
    public function testCpdcPostsAJobAndAStudentFindsItWithItsSkills(): void
    {
        $this->signInAs('admin', 'admin');
        $id = $this->openJob('Data Intern', '2030-12-31', [['area_id' => $this->area('Programming'), 'level' => 4]]);
        $this->openJob('Marketing Assistant');

        $this->signInAs('student', 'student');
        $list = $this->body($this->send('GET', '/api/jobs', '', ['q' => 'data']));
        $this->assertSame(1, $list['total']);
        $this->assertSame('Data Intern', $list['items'][0]['title']);
        $this->assertNull($list['items'][0]['my_status']);
        $this->assertSame(2, $this->body($this->send('GET', '/api/jobs', '', ['type' => 'internship']))['total']);
        $this->assertSame(0, $this->body($this->send('GET', '/api/jobs', '', ['type' => 'full_time']))['total']);
        $this->assertSame(2, $this->body($this->send('GET', '/api/jobs', '', ['location' => 'ipo']))['total']);

        $job = $this->body($this->send('GET', "/api/jobs/$id"));
        $this->assertSame('Fake Employer Data Intern', $job['employer']['name']);
        $programming = ['area_id' => $this->area('Programming'), 'name' => 'Programming', 'level' => 4];
        $this->assertSame([$programming], $job['skills']);
        $this->assertTrue($job['open']);
        $this->assertNull($job['my_application']);
    }

    public function testAStudentAppliesWithANoteAndCvAndFollowsTheStatusCpdcSets(): void
    {
        $this->signInAs('admin', 'admin');
        $job = $this->openJob();
        $studentId = $this->signInAs('student', 'student');

        $applied = $this->upload("/api/jobs/$job/apply", ['note' => 'I would love this role.'], ['cv' => self::PDF]);
        $this->assertSame(201, $applied->status, $applied->body);
        $application = $this->body($applied)['my_application'];
        $this->assertSame('submitted', $application['status']);
        $this->assertSame('cv.pdf', $application['cv_name']);
        $this->assertError($this->upload("/api/jobs/$job/apply", []), 409, 'ALREADY_APPLIED');

        $cv = $this->send('GET', '/api/applications/' . $application['id'] . '/cv');
        $this->assertSame(200, $cv->status);
        $this->assertSame('application/pdf', $cv->headers['Content-Type']);
        $this->assertSame('attachment; filename="cv.pdf"', $cv->headers['Content-Disposition']);
        $this->assertStringStartsWith('%PDF-', $cv->body);

        $this->signInAs('admin', 'admin');
        $list = $this->body($this->send('GET', "/api/jobs/manage/$job/applications"));
        $this->assertSame($studentId, $list['items'][0]['user_id']);
        $this->assertTrue($list['items'][0]['has_cv']);
        $detail = $this->body($this->send('GET', '/api/applications/' . $application['id']));
        $this->assertSame('I would love this role.', $detail['application']['note']);
        $this->assertSame('Fake Student', $detail['profile']['display_name']);
        $this->assertArrayNotHasKey('cv_file', $detail['application']);
        $this->assertSame(200, $this->send('GET', '/api/applications/' . $application['id'] . '/cv')->status);
        $moved = $this->setStatus($application['id'], 'shortlisted');
        $this->assertSame(204, $moved->status, $moved->body);
        $actions = $this->sql(
            "SELECT action FROM audit_log WHERE target = 'application:{$application['id']}' ORDER BY id"
        )->fetchAll(\PDO::FETCH_COLUMN);
        $this->assertSame(['application.view', 'application.cv_download', 'application.status'], $actions);

        $this->signInAs('student', 'student');
        $mine = $this->body($this->send('GET', '/api/applications/mine'))['items'];
        $this->assertSame('shortlisted', $mine[0]['status']);
        $this->assertSame('shortlisted', $this->body($this->send('GET', '/api/jobs', ''))['items'][0]['my_status']);
    }

    public function testAlumniApplyToo(): void
    {
        $this->signInAs('admin', 'admin');
        $job = $this->openJob();
        $this->signInAs('graduate', 'alumni');
        $this->assertSame(201, $this->upload("/api/jobs/$job/apply", [])->status);
    }

    public function testApplicantsSeeOnlyTheirOwnApplications(): void
    {
        $this->signInAs('admin', 'admin');
        $job = $this->openJob();
        $this->signInAs('student', 'student');
        $id = $this->body($this->upload("/api/jobs/$job/apply", [], ['cv' => self::PDF]))['my_application']['id'];

        $this->signInAs('student-b', 'student');
        $this->assertSame([], $this->body($this->send('GET', '/api/applications/mine'))['items']);
        $this->assertError($this->send('GET', "/api/applications/$id/cv"), 404, 'NOT_FOUND');
        $this->assertError($this->send('POST', "/api/applications/$id/withdraw"), 404, 'NOT_FOUND');
        $this->assertError($this->send('GET', "/api/applications/$id"), 403, 'FORBIDDEN');
        $this->assertError($this->setStatus($id, 'hired'), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', "/api/jobs/manage/$job/applications"), 403, 'FORBIDDEN');
    }

    public function testOnlyCpdcManagesEmployersAndJobs(): void
    {
        $this->signInAs('student', 'student');
        $this->assertError($this->send('GET', '/api/employers'), 403, 'FORBIDDEN');
        $this->assertError($this->json('POST', '/api/employers', ['name' => 'Fake']), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', '/api/jobs/manage'), 403, 'FORBIDDEN');
        $this->assertError($this->json('POST', '/api/jobs/manage', []), 403, 'FORBIDDEN');

        $this->signInAs('staff', 'staff');
        $this->assertError($this->send('GET', '/api/jobs'), 403, 'FORBIDDEN');
        $this->assertError($this->send('GET', '/api/employers'), 403, 'FORBIDDEN');

        $this->signInAs('admin', 'admin');
        $this->assertError($this->send('GET', '/api/jobs'), 403, 'FORBIDDEN'); // CPDC manages, does not apply

        $this->jar = [];
        $this->assertError($this->send('GET', '/api/jobs'), 401, 'UNAUTHENTICATED');
        $this->assertError($this->send('GET', '/api/employers'), 401, 'UNAUTHENTICATED');
    }

    public function testClosedDraftAndPastJobsTakeNoApplications(): void
    {
        $this->signInAs('admin', 'admin');
        $past = $this->openJob('Past', '2026-01-01');
        $draft = $this->openJob('Draft');
        $job = $this->body($this->send('GET', "/api/jobs/manage/$draft"));
        $this->assertSame(204, $this->json('PUT', "/api/jobs/manage/$draft", [
            'employer_id' => $job['employer_id'], 'title' => 'Draft', 'job_type' => 'internship', 'location' => 'Ipoh',
            'closing_date' => '2030-12-31', 'description' => 'Fake.', 'status' => 'draft',
        ])->status);

        $this->signInAs('student', 'student');
        $this->assertSame(0, $this->body($this->send('GET', '/api/jobs'))['total']);
        $this->assertError($this->send('GET', "/api/jobs/$past"), 404, 'NOT_FOUND');
        $this->assertError($this->send('GET', "/api/jobs/$draft"), 404, 'NOT_FOUND');
        $this->assertError($this->upload("/api/jobs/$past/apply", []), 409, 'JOB_CLOSED');
        $this->assertError($this->upload("/api/jobs/$draft/apply", [], ['cv' => self::PDF]), 409, 'JOB_CLOSED');
        $this->assertError($this->upload('/api/jobs/999999/apply', []), 404, 'NOT_FOUND');
        $this->assertSame([], glob($this->storage . '/uploads/cv/*.pdf') ?: []); // refused CV not kept
    }

    public function testAJobStaysVisibleToItsApplicantAfterItCloses(): void
    {
        $this->signInAs('admin', 'admin');
        $job = $this->openJob();
        $this->signInAs('student', 'student');
        $this->upload("/api/jobs/$job/apply", []);
        $this->pdo->exec("UPDATE job_posting SET closing_date = '2026-01-01' WHERE id = $job"); // now closed
        $seen = $this->body($this->send('GET', "/api/jobs/$job"));
        $this->assertFalse($seen['open']);
        $this->assertSame('submitted', $seen['my_application']['status']);
    }

    public function testTheCvMustBeASmallPdf(): void
    {
        $this->signInAs('admin', 'admin');
        $job = $this->openJob();
        $this->signInAs('student', 'student');
        $html = $this->upload("/api/jobs/$job/apply", [], ['cv' => 'bytes:<html>not a pdf']);
        $this->assertError($html, 400, 'VALIDATION');
        $this->pdo->exec("UPDATE setting SET value = '100' WHERE setting_key = 'upload_pdf_max_bytes'");
        $this->assertError($this->upload("/api/jobs/$job/apply", [], ['cv' => self::PDF]), 413, 'FILE_TOO_LARGE');
        $this->assertError($this->upload("/api/jobs/$job/apply", ['role' => 'admin']), 400, 'VALIDATION');
        $this->assertSame([], $this->body($this->send('GET', '/api/applications/mine'))['items']);
        $this->assertSame([], glob($this->storage . '/uploads/cv/*.pdf') ?: []);
    }

    public function testWithdrawingIsFinalAndOnlyBeforeCpdcDecides(): void
    {
        $this->signInAs('admin', 'admin');
        $first = $this->openJob('First');
        $second = $this->openJob('Second');
        $this->signInAs('student', 'student');
        $a = $this->body($this->upload("/api/jobs/$first/apply", []))['my_application']['id'];
        $b = $this->body($this->upload("/api/jobs/$second/apply", []))['my_application']['id'];
        $first = $this->send('POST', "/api/applications/$a/withdraw");
        $again = $this->send('POST', "/api/applications/$a/withdraw"); // repeatable
        $this->assertSame([204, 204], [$first->status, $again->status]);

        $this->signInAs('admin', 'admin');
        $this->assertError($this->setStatus($a, 'reviewing'), 409, 'WITHDRAWN');
        $this->assertSame(204, $this->setStatus($b, 'hired')->status);
        $this->assertError($this->setStatus($b, 'withdrawn'), 400, 'VALIDATION');

        $this->signInAs('student', 'student');
        $this->assertError($this->send('POST', "/api/applications/$b/withdraw"), 409, 'ALREADY_DECIDED');
    }

    public function testJobAndEmployerInputIsValidated(): void
    {
        $this->signInAs('admin', 'admin');
        $employer = (int) $this->body($this->json('POST', '/api/employers', ['name' => 'Fake Co']))['id'];
        $this->assertError($this->json('POST', '/api/employers', ['name' => 'Fake Co']), 400, 'VALIDATION');
        $script = ['name' => 'X', 'website' => 'javascript:alert(1)'];
        $this->assertError($this->json('POST', '/api/employers', $script), 400, 'VALIDATION');
        $this->assertError($this->json('POST', '/api/employers', ['name' => '   ']), 400, 'VALIDATION');
        $base = ['employer_id' => $employer, 'title' => 'T', 'job_type' => 'internship', 'location' => 'Ipoh',
            'closing_date' => '2030-12-31', 'description' => 'D'];
        $post = fn (array $change) => $this->json('POST', '/api/jobs/manage', $change + $base);
        $this->assertError($post(['closing_date' => '2030-02-30']), 400, 'VALIDATION');
        $this->assertError($post(['salary' => 1]), 400, 'VALIDATION');
        $this->assertError($post(['employer_id' => 999999]), 400, 'VALIDATION');
        $teamwork = $this->area('Teamwork');
        $this->assertError($post(['skills' => [['area_id' => $teamwork, 'level' => 2],
            ['area_id' => $teamwork, 'level' => 3]]]), 400, 'VALIDATION');
        $this->assertError($post(['skills' => [['area_id' => 999999, 'level' => 2]]]), 400, 'VALIDATION');
        $this->assertError($this->json('PUT', '/api/jobs/manage/999999', $base), 404, 'NOT_FOUND');
        $this->assertError($this->json('PUT', '/api/employers/999999', ['name' => 'Y']), 404, 'NOT_FOUND');
        $this->assertError($this->send('GET', '/api/applications/999999'), 404, 'NOT_FOUND');
    }

    public function testAnInactiveEmployersJobsAreHiddenAndChangesAreAudited(): void
    {
        $this->signInAs('admin', 'admin');
        $job = $this->openJob();
        $employer = $this->body($this->send('GET', "/api/jobs/manage/$job"))['employer_id'];
        $off = $this->json('PUT', "/api/employers/$employer", ['name' => 'Renamed', 'active' => false]);
        $this->assertSame(204, $off->status);
        $listed = $this->body($this->send('GET', '/api/employers', '', ['q' => 'renamed']))['items'][0];
        $this->assertFalse($listed['active']);
        $this->assertSame(1, $listed['jobs']);
        $this->assertSame(1, $this->body($this->send('GET', '/api/jobs/manage'))['total']);
        $actions = $this
            ->sql("SELECT action FROM audit_log WHERE action LIKE 'employer.%' OR action LIKE 'job.%' ORDER BY id")
            ->fetchAll(\PDO::FETCH_COLUMN);
        $this->assertSame(['employer.create', 'job.create', 'employer.update'], $actions);

        $this->signInAs('student', 'student');
        $this->assertSame(0, $this->body($this->send('GET', '/api/jobs'))['total']);
        $this->assertError($this->upload("/api/jobs/$job/apply", []), 409, 'JOB_CLOSED');
    }

    public function testAnotherOrganisationsJobIsNotFound(): void
    {
        $this->signInAs('admin', 'admin');
        $job = $this->openJob();
        $other = $this->insertOrganisation('Fake Other University');
        $this->pdo->exec("UPDATE job_posting SET organisation_id = $other WHERE id = $job");
        $this->assertError($this->send('GET', "/api/jobs/manage/$job"), 404, 'NOT_FOUND');
        $this->signInAs('student', 'student');
        $this->assertError($this->send('GET', "/api/jobs/$job"), 404, 'NOT_FOUND');
        $this->assertError($this->upload("/api/jobs/$job/apply", []), 404, 'NOT_FOUND');
    }
}
