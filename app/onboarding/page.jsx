'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Info,
  Target,
  Github,
  Linkedin,
  Link2,
  LoaderCircle,
} from 'lucide-react';
import QiuLogo from '@/components/portal/QiuLogo';
import AutoDetectedField from '@/components/auth/AutoDetectedField';

const STEPS = ['Confirm your profile', 'Career preferences', 'Review & finish'];

const EMPTY_FORM = {
  careerTargets: '',
  industries: '',
  bio: '',
  portfolioUrl: '',
  githubUrl: '',
  linkedinUrl: '',
};

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'We could not complete that request. Please try again.');
  }

  return payload;
}

async function loadIdentityProfile() {
  return readResponse(await fetch('/api/identity/profile', {
    cache: 'no-store',
    credentials: 'include',
  }));
}

async function saveIdentityProfile(form) {
  return readResponse(await fetch('/api/identity/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      careerTargets: form.careerTargets.trim(),
      industries: form.industries.trim(),
      bio: form.bio.trim(),
      portfolioUrl: form.portfolioUrl.trim(),
      githubUrl: form.githubUrl.trim(),
      linkedinUrl: form.linkedinUrl.trim(),
    }),
  }));
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setLoadError('');

      try {
        const data = await loadIdentityProfile();

        if (!data?.student) {
          throw new Error('This onboarding flow needs a student profile, but none was returned.');
        }

        if (cancelled) return;

        const profile = data.profile ?? {};
        setIdentity(data);
        setForm({
          careerTargets: profile.careerTargets ?? '',
          industries: profile.industries ?? '',
          bio: profile.bio ?? '',
          portfolioUrl: profile.portfolioUrl ?? '',
          githubUrl: profile.githubUrl ?? '',
          linkedinUrl: profile.linkedinUrl ?? '',
        });
      } catch (error) {
        if (!cancelled) {
          setIdentity(null);
          setLoadError(error.message || 'We could not load your profile. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleFinish = async () => {
    setSaveError('');
    setSaving(true);

    try {
      await saveIdentityProfile(form);

      let demoRole = 'STUDENT';
      try {
        demoRole = new URLSearchParams(window.location.search).get('demoRole') || demoRole;
      } catch {
        // Keep the student fallback if the URL is unavailable.
      }
      router.push(`/dashboard?demoRole=${encodeURIComponent(demoRole)}`);
    } catch (error) {
      setSaveError(error.message || 'We could not save your career preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const student = identity?.student;
  const name = identity?.user?.name || 'Not available';
  const faculty = student?.faculty || 'Not available';
  const programme = student?.programme || 'Not available';
  const studentId = student?.matricNo || 'Not available';
  const academicYear = student?.academicYear ? `Year ${student.academicYear}` : 'Not available';

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <QiuLogo priority className="h-9 w-auto" />
          <div className="space-y-1.5">
            <h1 className="font-heading text-xl font-semibold text-[#1d1d1f] sm:text-2xl">
              Welcome to QIU Career Hub! Please confirm your profile details below.
            </h1>
            <p className="text-sm text-muted">
              This only takes a minute — review the profile loaded for this standalone experience.
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <ol className="mb-6 flex items-center gap-2" aria-label="Onboarding progress">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`h-1.5 w-full rounded-full ${
                  index <= step ? 'bg-crimson' : 'bg-black/[0.06]'
                }`}
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
              <p className="text-xs leading-relaxed text-muted">
                Nothing has been filled in until the canonical profile loads successfully.
              </p>
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="secondary-btn min-h-[44px] px-4"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !loadError && step === 0 && (
            <section aria-labelledby="step-1-heading" className="space-y-5">
              <h2 id="step-1-heading" className="font-heading text-base font-semibold text-[#1d1d1f]">
                Your profile, loaded for this experience
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AutoDetectedField label="Full name" value={name} />
                <AutoDetectedField label="Student ID" value={studentId} />
                <AutoDetectedField label="Faculty" value={faculty} />
                <AutoDetectedField label="Programme" value={programme} />
                <AutoDetectedField label="Academic year" value={academicYear} />
              </div>
              <div className="flex items-start gap-2 rounded-[18px] border border-black/10 bg-black/[0.03] p-3.5">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-muted">
                  Faculty and programme are read-only in this standalone/demo flow. Ask the project
                  administrator if the seeded details need correcting.
                </p>
              </div>
            </section>
          )}

          {!loading && !loadError && step === 1 && (
            <section aria-labelledby="step-2-heading" className="space-y-5">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-crimson" aria-hidden="true" />
                <h2 id="step-2-heading" className="font-heading text-base font-semibold text-[#1d1d1f]">
                  Tell us about your career goals (optional)
                </h2>
              </div>

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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                <div className="space-y-1.5">
                  <label htmlFor="githubUrl" className="block text-xs font-semibold text-muted">
                    GitHub link
                  </label>
                  <div className="relative">
                    <Github className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                    <input
                      id="githubUrl"
                      type="url"
                      inputMode="url"
                      value={form.githubUrl}
                      onChange={updateField('githubUrl')}
                      placeholder="https://github.com/…"
                      className="h-12 w-full rounded-[18px] border border-black/10 bg-black/[0.04] pl-10 pr-3 text-sm text-[#1d1d1f] placeholder:text-muted/60 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="linkedinUrl" className="block text-xs font-semibold text-muted">
                    LinkedIn link
                  </label>
                  <div className="relative">
                    <Linkedin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                    <input
                      id="linkedinUrl"
                      type="url"
                      inputMode="url"
                      value={form.linkedinUrl}
                      onChange={updateField('linkedinUrl')}
                      placeholder="https://linkedin.com/in/…"
                      className="h-12 w-full rounded-[18px] border border-black/10 bg-black/[0.04] pl-10 pr-3 text-sm text-[#1d1d1f] placeholder:text-muted/60 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {!loading && !loadError && step === 2 && (
            <section aria-labelledby="step-3-heading" className="space-y-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-crimson" aria-hidden="true" />
                <h2 id="step-3-heading" className="font-heading text-base font-semibold text-[#1d1d1f]">
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
                  <span className="text-muted">Career targets</span>
                  <span className="text-right text-[#1d1d1f]">{form.careerTargets || 'Not provided'}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-black/10 pb-2">
                  <span className="text-muted">Preferred industries</span>
                  <span className="text-right text-[#1d1d1f]">{form.industries || 'Not provided'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted">Links added</span>
                  <span className="text-right text-[#1d1d1f]">
                    {[form.portfolioUrl, form.githubUrl, form.linkedinUrl].filter(Boolean).length || 0}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted">
                You can always update your career preferences later from your profile settings.
              </p>
            </section>
          )}

          {saveError && !loading && !loadError && (
            <div className="flex items-start gap-2 rounded-[18px] border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <p>{saveError}</p>
            </div>
          )}

          {!loading && !loadError && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="secondary-btn flex min-h-[44px] items-center gap-1.5 px-4 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Back</span>
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="crimson-btn flex min-h-[44px] items-center gap-1.5 px-5"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
                      <span>Confirm & go to dashboard</span>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
