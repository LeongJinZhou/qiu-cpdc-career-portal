// Main path of slice 3b: an alumna joins the directory and offers mentoring; a student finds her, asks for
// mentoring, she accepts and both see the match; the student then practises an interview question with the fake AI.
// Needs the fake data from api/bin/seed.php (npm run test:e2e runs it) and AI_DRIVER=fake in .env.
import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, provider: 'google' | 'linkedin', persona: string, mode = '') {
  await page.goto(`/api/auth/${provider}/start${mode}`);
  await page.getByRole('link', { name: new RegExp(`\\(${persona}\\)$`) }).click();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test('alumni directory, mentoring match and interview practice', async ({ page }) => {
  // The alumna opts in and offers mentoring.
  await signIn(page, 'linkedin', 'alumni', '?mode=signin');
  await page.getByRole('link', { name: 'Alumni network' }).click();
  await expect(page.getByText('Hidden', { exact: true })).toBeVisible();
  await page.getByLabel('Show me in the alumni directory').check();
  await page.getByLabel(/^Job title/).check();
  await page.getByRole('button', { name: 'Save choices' }).click();
  await expect(page.getByText('Saved. Students and staff can find you.')).toBeVisible();
  await page.getByLabel('Topics you can help with').fill('CV review');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Offer mentoring' }).click();
  await expect(page.getByText('Offering', { exact: true })).toBeVisible();
  await signOut(page);

  // A new student onboards, finds her in the directory and asks for mentoring. The personas "student-b" and the
  // LinkedIn "staff" account are used so student-onboarding.spec.ts still finds "student" fresh in the same seed.
  await signIn(page, 'google', 'student-b');
  await page.getByRole('link', { name: 'Sign in with LinkedIn' }).click();
  await page.getByRole('link', { name: /\(staff\)$/ }).click();
  await page.getByLabel('I follow Quest International University on LinkedIn.').check();
  await page.getByLabel('Profile link').fill('linkedin.com/in/fake-other-student');
  await page.getByLabel('I agree that CPDC keeps and uses my career profile as described.').check();
  await page.getByRole('button', { name: 'Finish and open my profile' }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByRole('link', { name: 'Alumni network' }).click();
  const card = page.getByRole('listitem').filter({ hasText: 'Fake Alumna' });
  await expect(card.getByText('Data Analyst')).toBeVisible();
  await expect(card.getByText('Fake Analytics Sdn Bhd')).toHaveCount(0); // company not opted in
  await card.getByRole('button', { name: 'Ask for mentoring' }).click();
  await card.getByLabel('Message to Fake Alumna').fill('Hello, I am a final-year student and would love advice on my CV.');
  await card.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Request sent to Fake Alumna.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your mentoring requests' })).toBeVisible();
  await signOut(page);

  // The alumna accepts; she now sees the student's email.
  await signIn(page, 'linkedin', 'alumni', '?mode=signin');
  await page.getByRole('link', { name: 'Alumni network' }).click();
  const ask = page.getByRole('listitem').filter({ hasText: 'would love advice on my CV' });
  await ask.getByLabel('Reply (optional)').fill('Happy to help. Message me on LinkedIn.');
  await ask.getByRole('button', { name: 'Accept' }).click();
  await expect(ask.getByText('Matched')).toBeVisible();
  await expect(ask.getByRole('link', { name: 'other.student@example.test' })).toBeVisible();
  await signOut(page);

  // The student sees the match and practises one interview question.
  await signIn(page, 'google', 'student-b');
  await page.getByRole('link', { name: 'Alumni network' }).click();
  const match = page.getByRole('listitem').filter({ hasText: 'would love advice on my CV' });
  await expect(match.getByText('Matched')).toBeVisible();
  await expect(match.getByText('Happy to help. Message me on LinkedIn.')).toBeVisible();

  await page.getByRole('link', { name: 'Interview practice' }).click();
  await page.getByLabel('Field').selectOption('General');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.getByRole('heading', { name: 'General practice' })).toBeVisible();
  await page.getByLabel('Your answer').first().fill(
    'The situation was a group project with a late dataset. My task was cleaning it; my action was writing scripts, and as a result we finished 2 weeks early.',
  );
  await page.getByRole('button', { name: 'Get feedback' }).first().click();
  await expect(page.getByLabel(/^Score \d out of 5$/)).toBeVisible();
  await expect(page.getByText('To improve')).toBeVisible();
});
