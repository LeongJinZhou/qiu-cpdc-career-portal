'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Info,
  Target,
  Link2,
  Lock,
  LoaderCircle,
} from 'lucide-react';
import QiuLogo from '@/components/portal/QiuLogo';
import AutoDetectedField from '@/components/auth/AutoDetectedField';
import ConnectAccounts from '@/components/onboarding/ConnectAccounts';

/**
 * First-login flow (Module 1).
 *
 * Four steps, and the ordering is the design:
 *   0. Confirm the auto-detected academic record — the ONE time a student is
 *      asked. Confirming writes Student.identityConfirmedAt server-side, so
 *      this screen is never shown again on any device.
 *   1. Connect the professional profiles their programme requires. Blocking.
 *   2. Career preferences. Entirely optional.
 *   3. Review and finish, which records onboardingCompletedAt.
 *
 * A student who has already completed the flow and lands here (bookmark, back
 * button, stale tab) is sent straight to the dashboard rather than being walked
 * through it a second time.
 */

const STEPS = ['Confirm your profile', 'Connect your profile', 'Career preferences', 'Review & finish'];

const EMPTY_FORM = {
  careerTargets: '',
  industries: '',
  bio: '',
  portfolioUrl: '',
};

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || 'We could not complete that request. Please try again.');
    error.code = payload.code;
    throw error;
  }

  return payload;
}

const jsonPost = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(body ?? {}),
}).then(readResponse);

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [identity, setIdentity] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Surfaced by the OAuth callback redirect (?connected=… / ?connectError=…).
  const oauthError = searchParams.get('connectError');
  const oauthNeedsUrl = searchParams.get('needsUrl');

  const demoRole = searchParams.get('demoRole') || 'STUDENT';
  const dashboardHref = `/dashboard?demoRole=${encodeURIComponent(demoRole)}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [profileData, onboardingData] = await Promise.all([
          fetch('/api/identity/profile', { cache: 'no-store', credentials: 'include' }).then(readResponse),
          fetch('/api/onboarding', { cache: 'no-store', credentials: 'include' }).then(readResponse),
        ]);

        if (cancelled) return;

        if (!profileData?.student) {
          throw new Error('This onboarding flow needs a student profile, but none was returned.');
        }

        // Already done: do not make them repeat it.
        if (onboardingData?.complete) {
          router.replace(dashboardHref);
          return;
        }

        const profile = profileData.profile ?? {};
        setIdentity(profileData);
        setOnboarding(onboardingData);
        setForm({
          careerTargets: profile.careerTargets ?? '',
          industries: profile.industries ?? '',
          bio: profile.bio ?? '',
          portfolioUrl: profile.portfolioUrl ?? '',
        });

        // Resume where they left off rather than restarting the flow — a
        // student who connected LinkedIn then closed the tab should not be
        // asked to confirm their matric number again.
        if (onboardingData?.identityConfirmed) {
          setStep(onboardingData.missingProviders?.length ? 1 : 2);
        }
      } catch (error) {
        if (!cancelled) {
          setIdentity(null);
          setLoadError(error.message || 'We could not load your profile. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, router, dashboardHref]);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleConnect = useCallback(async (provider, profileUrl) => {
    const result = await jsonPost('/api/onboarding/connections', { provider, profileUrl });
    setOnboarding(result.state);
    return result;
  }, []);

  const handleDisconnect = useCallback(async (provider) => {
    const result = await readResponse(await fetch(
      `/api/onboarding/connections?provider=${encodeURIComponent(provider)}`,
      { method: 'DELETE', credentials: 'include' },
    ));
    setOnboarding(result.state);
  }, []);

  // Memoised because it is a useMemo dependency below: a fresh [] literal on
  // every render would recompute the labels on every render.
  const missing = useMemo(() => onboarding?.missingProviders ?? [], [onboarding]);
  const connectionsSatisfied = missing.length === 0;

  const missingLabels = useMemo(() => {
    const byId = new Map((onboarding?.required ?? []).map((entry) => [entry.id, entry.label]));
    return missing.map((id) => byId.get(id) ?? id).join(' and ');
  }, [missing, onboarding]);

  const goNext = async () => {
    setSaveError('');

    // Leaving step 0 IS the confirmation — record it server-side now, so the
    // "confirm once" promise survives even if they abandon the flow here.
    if (step === 0 && !onboarding?.identityConfirmed) {
      setSaving(true);
      try {
        const result = await jsonPost('/api/onboarding/confirm-identity');
        setOnboarding(result.state);
      } catch (error) {
        setSaveError(error.message);
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    if (step === 1 && !connectionsSatisfied) {
      setSaveError(`Please connect your ${missingLabels} account before continuing.`);
      return;
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleFinish = async () => {
    setSaveError('');
    setSaving(true);

    try {
      // Optional career details first, then the completion record. If the
      // preferences save fails we stop rather than marking onboarding done on
      // a half-saved profile.
      await readResponse(await fetch('/api/identity/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          careerTargets: form.careerTargets.trim(),
          industries: form.industries.trim(),
          bio: form.bio.trim(),
          portfolioUrl: form.portfolioUrl.trim(),
        }),
      }));

      await jsonPost('/api/onboarding/complete');
      router.push(dashboardHref);
    } catch (error) {
      setSaveError(error.message || 'We could not finish setting up your account. Please try again.');
      setSaving(false);
    }
  };

  const student = identity?.student;
  const name = identity?.user?.name || 'Not available';
  const faculty = student?.faculty || 'Not available';
  const programme = student?.programme || 'Not available';
  const studentId = student?.matricNo || 'Not available';
  const academicYear = student?.academicYear ? `Year ${student.academicYear}` : 'Not available';
  const courseCode = onboarding?.student?.programmeCode;

  const ready = !loading && !loadError;
  const isLastStep = step === STEPS.length - 1;

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <QiuLogo priority className="h-9 w-auto" />
          <div className="space-y-1.5">
            <h1 className="font-heading text-xl font-semibold text-[#1d1d1f] sm:text-2xl">
              Welcome to QIU Career Hub
            </h1>
            <p className="text-sm text-muted">
              A one-time setup. Once you finish, you go straight to your dashboard every time you sign in.
            </p>
          </div>
        </div>

        <ol className="mb-6 flex items-center gap-2" aria-label="Onboarding progress">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`h-1.5 w-full rounded-full ${index <= step ? 'bg-crimson' : 'bg-black/[0.06]'}`}
                aria-hidden="true"
              />
              <span
                className={`text-center text-[10px] font-medium leading-tight sm:text-xs ${
                  index === step ? 'text-[#1d1d1f]' : 'text-muted'
                }`}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
        <p className="sr-only" role="status">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>

        <div className="surface space-y-6 p-5 sm:p-7">
          {loading && (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
              <LoaderCircle className="h-6 w-6 animate-spin text-crimson" aria-hidden="true" />
              <p className="text-sm text-muted">Loading your profile…</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="space-y-4" role="alert">
              <div className="flex items-start gap-2 rounded-[18px] border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <p>{loadError}</p>
              </div>
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="secondary-btn min-h-[44px] px-4"
              >
                Try again
              </button>
            </div>
          )}

          {ready && oauthError ? (
            <div className="flex items-start gap-2 rounded-[18px] border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-800" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <p>{oauthError}</p>
            </div>
          ) : null}

          {ready && oauthNeedsUrl ? (
            <div className="flex items-start gap-2 rounded-[18px] border border-emerald-300 bg-emerald-50 p-3.5 text-sm text-emerald-800" role="status">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <p>
                We verified your {oauthNeedsUrl === 'LINKEDIN' ? 'LinkedIn' : oauthNeedsUrl} account.
                {' '}It does not share your public profile link with us, so please paste it below — that
                is the link CPDC uses to reach you later.
              </p>
            </div>
          ) : null}

          {ready && step === 0 && (
            <section aria-labelledby="step-1-heading" className="space-y-5">
              <div>
                <h2 id="step-1-heading" className="font-heading text-base font-semibold text-[#1d1d1f]">
                  These details came from your QIU account
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  Check they are right. We only ask you once — after this, you go straight to your dashboard.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AutoDetectedField label="Full name" value={name} />
                <AutoDetectedField label="Student ID" value={studentId} />
                <AutoDetectedField label="Faculty" value={faculty} />
                <AutoDetectedField label="Programme" value={programme} />
                <AutoDetectedField label="Academic year" value={academicYear} />
                {courseCode ? <AutoDetectedField label="Course code" value={courseCode} /> : null}
              </div>
              <div className="flex items-start gap-2 rounded-[18px] border border-black/10 bg-black/[0.03] p-3.5">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-muted">
                  Your faculty, programme and year come from the university record and cannot be edited here.
                  If something is wrong, contact CPDC — an administrator can correct it, and you will not have
                  to redo this setup.
                </p>
              </div>
            </section>
          )}

          {ready && step === 1 && (
            <ConnectAccounts
              state={onboarding}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              oauthProviders={onboarding?.oauthProviders ?? []}
            />
          )}

          {ready && step === 2 && (
            <section aria-labelledby="step-3-heading" className="space-y-5">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-crimson" aria-hidden="true" />
                <h2 id="step-3-heading" className="font-heading text-base font-semibold text-[#1d1d1f]">
                  Tell us about your career goals (optional)
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-muted">
                This is what tailors your dashboard, your workshop matches and your course recommendations.
                You can skip it and fill it in later from your profile.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="careerTargets" className="block text-xs font-semibold text-muted">
                  Career targets
                </label>
                <input
                  id="careerTargets"
                  type="text"
                  value={form.careerTargets}
                  onChange={updateField('careerTargets')}
                  placeholder="e.g. Software engineer, clinical researcher"
                  className="h-12 w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 text-sm text-[#1d1d1f] placeholder:text-muted/60 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="industries" className="block text-xs font-semibold text-muted">
                  Preferred industries
                </label>
                <input
                  id="industries"
                  type="text"
                  value={form.industries}
                  onChange={updateField('industries')}
                  placeholder="e.g. Healthcare, fintech, education"
                  className="h-12 w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 text-sm text-[#1d1d1f] placeholder:text-muted/60 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="bio" className="block text-xs font-semibold text-muted">
                  Short bio
                </label>
                <textarea
                  id="bio"
                  rows={3}
                  value={form.bio}
                  onChange={updateField('bio')}
                  placeholder="A couple of sentences about yourself"
                  className="w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 py-3 text-sm text-[#1d1d1f] placeholder:text-muted/60 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="portfolioUrl" className="block text-xs font-semibold text-muted">
                  Portfolio link
                </label>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <input
                    id="portfolioUrl"
                    type="url"
                    inputMode="url"
                    value={form.portfolioUrl}
                    onChange={updateField('portfolioUrl')}
                    placeholder="https://"
                    className="h-12 w-full rounded-[18px] border border-black/10 bg-black/[0.04] pl-10 pr-3 text-sm text-[#1d1d1f] placeholder:text-muted/60 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
                  />
                </div>
              </div>
            </section>
          )}

          {ready && step === 3 && (
            <section aria-labelledby="step-4-heading" className="space-y-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-crimson" aria-hidden="true" />
                <h2 id="step-4-heading" className="font-heading text-base font-semibold text-[#1d1d1f]">
                  Review before you finish
                </h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3 border-b border-black/10 pb-2">
                  <span className="text-muted">Name</span>
                  <span className="text-right text-[#1d1d1f]">{name}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-black/10 pb-2">
                  <span className="text-muted">Faculty</span>
                  <span className="text-right text-[#1d1d1f]">{faculty}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-black/10 pb-2">
                  <span className="text-muted">Programme</span>
                  <span className="text-right text-[#1d1d1f]">{programme}</span>
                </div>
                {(onboarding?.required ?? []).map((provider) => (
                  <div key={provider.id} className="flex justify-between gap-3 border-b border-black/10 pb-2">
                    <span className="text-muted">{provider.label}</span>
                    <span className="text-right text-[#1d1d1f]">
                      {provider.connected && !provider.connected.broken ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Connected
                        </span>
                      ) : (
                        'Not connected'
                      )}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-b border-black/10 pb-2">
                  <span className="text-muted">Career targets</span>
                  <span className="text-right text-[#1d1d1f]">{form.careerTargets || 'Not provided'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted">Preferred industries</span>
                  <span className="text-right text-[#1d1d1f]">{form.industries || 'Not provided'}</span>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                You will not be asked to confirm these details again. Everything except your academic record
                stays editable from your profile settings.
              </p>
            </section>
          )}

          {saveError && ready && (
            <div className="flex items-start gap-2 rounded-[18px] border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <p>{saveError}</p>
            </div>
          )}

          {ready && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0 || saving}
                className="secondary-btn flex min-h-[44px] items-center gap-1.5 px-4 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Back</span>
              </button>

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={saving || (step === 1 && !connectionsSatisfied)}
                  className="crimson-btn flex min-h-[44px] items-center gap-1.5 px-5 disabled:cursor-not-allowed disabled:opacity-50"
                  // The disabled Continue needs a stated reason; a greyed-out
                  // button with no explanation is where students give up.
                  title={step === 1 && !connectionsSatisfied ? `Connect your ${missingLabels} account first` : undefined}
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {step === 1 && !connectionsSatisfied ? <Lock className="h-4 w-4" aria-hidden="true" /> : null}
                  <span>Continue</span>
                  {!saving && connectionsSatisfied ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="crimson-btn flex min-h-[44px] items-center gap-1.5 px-5"
                >
                  {saving ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm &amp; go to dashboard</span>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {ready && step === 1 && !connectionsSatisfied ? (
            <p className="text-center text-xs text-muted" role="status">
              Connect your {missingLabels} account to continue.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
