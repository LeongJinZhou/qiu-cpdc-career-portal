<?php

declare(strict_types=1);

namespace Cpdc\Tests\Integration;

use Cpdc\Http\Middleware\Session;

/** Google sign-in, the LinkedIn link, onboarding and alumni LinkedIn sign-in (docs/SPEC.md rules 1-9). */
final class SignInTest extends HttpTestCase
{
    public function testAStudentSignsInWithGoogleAndTheDirectoryProfileIsCaptured(): void
    {
        $callback = $this->signIn('google', 'student');
        $this->assertSame('/', $this->location($callback));
        $me = $this->body($this->send('GET', '/api/me'));
        $this->assertSame('student', $me['user']['role']);
        $this->assertSame('FAKE-S-0001', $me['user']['matric_no']);
        $this->assertSame('Faculty of Fake Studies', $me['user']['department']);
        $this->assertSame('google', $me['signed_in_with']);
        $this->assertTrue($me['onboarding']['required']);
        $this->assertFalse($me['onboarding']['linkedin_linked']);
        // The phone number in the fake directory answer is never stored.
        $stored = $this->sql("SELECT * FROM `user` WHERE email = 'student@example.test'")->fetch();
        $this->assertStringNotContainsString('+60', (string) json_encode($stored));
    }

    public function testStaffGetTheStaffRoleAndTheEmployeeId(): void
    {
        $this->signIn('google', 'staff');
        $me = $this->body($this->send('GET', '/api/me'));
        $this->assertSame('staff', $me['user']['role']);
        $this->assertSame('FAKE-E-0100', $me['user']['employee_id']);
        $this->assertNull($me['user']['matric_no']);
    }

    public function testAccountsOutsideTheQiuDomainAreRefused(): void
    {
        $this->assertSame('/login?error=domain', $this->location($this->signIn('google', 'offdomain')));
        $this->assertSame('/login?error=domain', $this->location($this->signIn('google', 'nohd')));
        $this->assertSame('/login?error=failed', $this->location($this->signIn('google', 'unverified')));
        $this->assertArrayNotHasKey(Session::COOKIE, $this->jar);
        $logged = $this->sql("SELECT result FROM login_log WHERE provider = 'google' ORDER BY id")
            ->fetchAll(\PDO::FETCH_COLUMN);
        $this->assertSame(['domain', 'domain', 'unverified'], $logged);
    }

    public function testACallbackWithAForgedStateIsRefused(): void
    {
        $this->send('GET', '/api/auth/google/start');
        $callback = $this->send('GET', '/api/auth/google/callback', '', ['state' => 'forged', 'code' => 'x']);
        $this->assertSame('/login?error=failed', $this->location($callback));
    }

    public function testEverythingButOnboardingIsClosedUntilLinkedInIsLinked(): void
    {
        $this->signIn('google', 'student');
        $this->assertError($this->send('GET', '/api/profile'), 403, 'ONBOARDING_REQUIRED');
        // A pasted URL alone never counts.
        $done = $this->json('POST', '/api/onboarding/complete', [
            'profile_url' => 'https://www.linkedin.com/in/fake-student', 'follow_confirmed' => true, 'consent' => true,
        ]);
        $this->assertError($done, 409, 'LINKEDIN_NOT_LINKED');
    }

    public function testLinkingLinkedInThenFinishingOnboardingOpensThePortal(): void
    {
        $this->signIn('google', 'student');
        $linked = $this->signIn('linkedin', 'student', ['mode' => 'link']);
        $this->assertSame('/onboarding?linkedin=linked', $this->location($linked));
        $me = $this->body($this->send('GET', '/api/me'));
        $this->assertTrue($me['onboarding']['linkedin_linked']);
        // LinkedIn's photo replaces the Google one; LinkedIn's verified personal email fills the profile.
        $this->assertStringStartsWith('https://media.licdn.com/', (string) $me['user']['picture_url']);

        $done = $this->json('POST', '/api/onboarding/complete', [
            'profile_url' => 'my.linkedin.com/in/fake-student/?trk=x', 'follow_confirmed' => true, 'consent' => true,
        ]);
        $this->assertSame(204, $done->status, $done->body);
        $profile = $this->body($this->send('GET', '/api/profile'));
        $this->assertSame('https://www.linkedin.com/in/fake-student', $profile['linkedin_url']);
        $this->assertSame('fake.student@gmail.example', $profile['personal_email']);
        $this->assertFalse($this->body($this->send('GET', '/api/me'))['onboarding']['required']);
    }

    public function testOnboardingNeedsTheFollowTickAndConsent(): void
    {
        $this->signIn('google', 'student');
        $this->signIn('linkedin', 'student', ['mode' => 'link']);
        $done = $this->json('POST', '/api/onboarding/complete', [
            'profile_url' => 'https://www.linkedin.com/in/fake-student', 'follow_confirmed' => false, 'consent' => true,
        ]);
        $this->assertError($done, 400, 'VALIDATION');
        $bad = $this->json('POST', '/api/onboarding/complete', [
            'profile_url' => 'https://evil.example/in/fake', 'follow_confirmed' => true, 'consent' => true,
        ]);
        $this->assertError($bad, 400, 'VALIDATION');
    }

    public function testALinkedInAccountHeldByAnotherPersonCannotBeLinked(): void
    {
        $this->signIn('google', 'student');
        $this->signIn('linkedin', 'student', ['mode' => 'link']);
        $this->jar = [];
        $this->signIn('google', 'student-b');
        $refused = $this->signIn('linkedin', 'student', ['mode' => 'link']);
        $this->assertSame('/onboarding?linkedin=in-use', $this->location($refused));
    }

    public function testAnAlumnusSignsInWithTheLinkedInLinkedAsAStudent(): void
    {
        $this->signIn('google', 'student');
        $this->signIn('linkedin', 'alumni', ['mode' => 'link']);
        $this->pdo->exec("UPDATE `user` SET role = 'alumni' WHERE email = 'student@example.test'");
        $this->jar = [];

        $callback = $this->signIn('linkedin', 'alumni', ['mode' => 'signin']);
        $this->assertSame('/', $this->location($callback));
        $me = $this->body($this->send('GET', '/api/me'));
        $this->assertSame('alumni', $me['user']['role']);
        $this->assertSame('linkedin', $me['signed_in_with']);
        $this->assertTrue($me['job_confirmation_due']);
    }

    public function testACurrentStudentCannotUseLinkedInSignIn(): void
    {
        $this->signIn('google', 'student');
        $this->signIn('linkedin', 'student', ['mode' => 'link']);
        $this->jar = [];
        $refused = $this->signIn('linkedin', 'student', ['mode' => 'signin']);
        $this->assertSame('/login?error=linkedin-not-alumni', $this->location($refused));
        $this->assertArrayNotHasKey(Session::COOKIE, $this->jar);
    }

    public function testALinkedInSessionEndsWhenThePersonIsNoLongerAlumni(): void
    {
        $this->signIn('google', 'student');
        $this->signIn('linkedin', 'alumni', ['mode' => 'link']);
        $this->pdo->exec("UPDATE `user` SET role = 'alumni' WHERE email = 'student@example.test'");
        $this->jar = [];
        $this->signIn('linkedin', 'alumni', ['mode' => 'signin']);
        $this->assertSame(200, $this->send('GET', '/api/me')->status);
        $this->pdo->exec("UPDATE `user` SET role = 'student' WHERE email = 'student@example.test'");
        $this->assertError($this->send('GET', '/api/me'), 401, 'UNAUTHENTICATED');
    }

    public function testAnUnknownLinkedInAccountCanRegisterAsAGraduateAndWaitsForCpdc(): void
    {
        $callback = $this->signIn('linkedin', 'nolink', ['mode' => 'signin']);
        $this->assertSame('/register-graduate', $this->location($callback));
        $this->assertSame('Fake Old Graduate', $this->body($this->send('GET', '/api/graduates/registration'))['name']);

        $registered = $this->json('POST', '/api/graduates/registration', [
            'matric_no' => 'old-2019-01', 'programme' => 'Bachelor of Old Studies', 'graduation_year' => 2019,
        ]);
        $this->assertSame(201, $registered->status, $registered->body);
        $waiting = $this->signIn('linkedin', 'nolink', ['mode' => 'signin']);
        $this->assertSame('/login?error=linkedin-waiting', $this->location($waiting));

        // A CPDC admin approves; then the graduate signs in.
        $this->signInAsAdmin();
        $list = $this->body($this->send('GET', '/api/registrations'));
        $this->assertCount(1, $list['items']);
        $this->assertSame('OLD-2019-01', $list['items'][0]['matric_no']);
        $approved = $this->json(
            'POST',
            '/api/registrations/' . $list['items'][0]['id'] . '/approve',
            ['faculty' => 'Faculty of Old']
        );
        $this->assertSame(200, $approved->status, $approved->body);
        $this->jar = [];
        $this->assertSame('/', $this->location($this->signIn('linkedin', 'nolink', ['mode' => 'signin'])));
        $this->assertSame('alumni', $this->body($this->send('GET', '/api/me'))['user']['role']);
    }

    public function testApprovingAGraduateWithAKnownMatricNumberMergesIntoTheStudentRow(): void
    {
        $this->signIn('google', 'graduate'); // matric FAKE-S-0003, no LinkedIn yet
        $studentId = (int) $this->sql("SELECT id FROM `user` WHERE email = 'graduate@example.test'")->fetchColumn();
        $this->jar = [];
        $this->signIn('linkedin', 'nolink', ['mode' => 'signin']);
        $this->json('POST', '/api/graduates/registration', [
            'matric_no' => 'FAKE-S-0003', 'programme' => 'Bachelor of Fake Studies', 'graduation_year' => 2025,
        ]);
        $this->signInAsAdmin();
        $reg = $this->body($this->send('GET', '/api/registrations'))['items'][0];
        $this->assertSame($studentId, $reg['matched_user_id']);
        $approved = $this->json('POST', '/api/registrations/' . $reg['id'] . '/approve', []);
        $this->assertSame(200, $approved->status, $approved->body);
        $result = $this->body($approved);
        $this->assertTrue($result['merged']);
        $this->assertSame($studentId, $result['user_id']);
        $this->assertSame(0, (int) $this->sql("SELECT COUNT(*) FROM `user` WHERE role = 'pending'")->fetchColumn());
    }

    public function testARefusedRegistrationFreesTheLinkedInAccount(): void
    {
        $this->signIn('linkedin', 'nolink', ['mode' => 'signin']);
        $this->json('POST', '/api/graduates/registration', [
            'matric_no' => 'X-1', 'programme' => 'Something', 'graduation_year' => 2020,
        ]);
        $this->signInAsAdmin();
        $reg = $this->body($this->send('GET', '/api/registrations'))['items'][0];
        $this->assertSame(204, $this->json('POST', '/api/registrations/' . $reg['id'] . '/refuse')->status);
        $this->jar = [];
        $this->assertSame(
            '/register-graduate',
            $this->location($this->signIn('linkedin', 'nolink', ['mode' => 'signin']))
        );
    }

    public function testTheSuperadminComesFromTheEnvironmentAndIsNotHeldByOnboarding(): void
    {
        $this->signIn('google', 'superadmin');
        $me = $this->body($this->send('GET', '/api/me'));
        $this->assertSame('superadmin', $me['user']['role']);
        $this->assertFalse($me['onboarding']['required']);
        $this->assertContains('settings.manage', $me['permissions']);
        $this->assertSame(200, $this->send('GET', '/api/alumni')->status);
    }

    public function testAStateChangeWithoutTheCsrfTokenIsRefused(): void
    {
        $this->signIn('google', 'student');
        $this->csrf = 'wrong';
        $this->assertError($this->json('POST', '/api/auth/logout'), 403, 'CSRF');
    }

    public function testWithoutLinkedInConfiguredNobodyIsHeldBack(): void
    {
        $this->linkedInOn = false;
        $this->signIn('google', 'student');
        $this->assertFalse($this->body($this->send('GET', '/api/me'))['onboarding']['required']);
        $this->assertSame(200, $this->send('GET', '/api/profile')->status);
        $this->assertSame(
            '/login?error=linkedin-off',
            $this->location($this->send('GET', '/api/auth/linkedin/start', '', ['mode' => 'signin']))
        );
    }

    /** A CPDC admin who finished onboarding, signed in through Google. */
    private function signInAsAdmin(): void
    {
        $this->jar = [];
        $this->signIn('google', 'admin');
        $this->pdo->exec(
            "UPDATE `user` SET role = 'admin', onboarded_at = UTC_TIMESTAMP(3) WHERE email = 'admin@example.test'"
        );
        $this->refreshCsrf();
    }
}
