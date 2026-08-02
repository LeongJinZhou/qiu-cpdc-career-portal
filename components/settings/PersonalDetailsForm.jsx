'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ImagePlus, Lock, RotateCcw, Save } from 'lucide-react';
import { fetchVisibility, setVisibility } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';

const EMPTY_FORM = {
  name: '',
  avatarUrl: '',
  phone: '',
  bio: '',
  careerTargets: '',
  industries: '',
  resumeSummary: '',
  skills: '',
  linkedinUrl: '',
  portfolioUrl: '',
  githubUrl: '',
};

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Something went wrong. Please try again.');
  }
  return payload;
}

async function loadPersonalDetails() {
  return readJson(await fetch('/api/identity/profile', { cache: 'no-store', credentials: 'include' }));
}

async function savePersonalDetails(patch) {
  return readJson(await fetch('/api/identity/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  }));
}

function looksLikeLink(value) {
  if (!value) return true;
  return /^https?:\/\/\S+\.\S+/i.test(value.trim())
    || /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value.trim());
}

/**
 * Editable personal details.
 *
 * Everything here is saved to Postgres through /api/identity/profile and
 * reloaded from there, so a refresh shows what was actually stored rather than
 * a browser copy of it. The verified block above the form is deliberately not
 * editable: faculty, programme, year and student ID are confirmed by QIU at
 * enrolment and the server refuses to change them here — see LOCKED_IDENTITY_FIELDS
 * in lib/auth/identity.js. Showing them as locked with a reason is honest;
 * showing them as inputs that silently fail would not be.
 */
export default function PersonalDetailsForm() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [publicTalent, setPublicTalent] = useState(false);
  const [visibilitySupported, setVisibilitySupported] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await loadPersonalDetails();
        if (cancelled) return;

        setRecord(data);
        setForm({
          name: data.user?.name ?? '',
          // Only the custom photo belongs in the editable field. If it is
          // empty, the displayed preview uses the Google SSO fallback below.
          avatarUrl: data.user?.customAvatarUrl ?? '',
          phone: data.profile?.phone ?? data.student?.phone ?? '',
          bio: data.profile?.bio ?? data.student?.bio ?? '',
          careerTargets: data.profile?.careerTargets ?? '',
          industries: data.profile?.industries ?? '',
          resumeSummary: data.profile?.resumeSummary ?? data.student?.resumeSummary ?? '',
          skills: (data.profile?.skills ?? []).join(', '),
          linkedinUrl: data.profile?.linkedinUrl ?? '',
          portfolioUrl: data.profile?.portfolioUrl ?? '',
          githubUrl: data.profile?.githubUrl ?? '',
        });
        setLoadError('');
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchVisibility()
      .then((data) => {
        if (cancelled || typeof data?.searchable !== 'boolean') return;
        setPublicTalent(data.searchable);
        setVisibilitySupported(true);
      })
      .catch(() => {
        // Only students have a talent-feed setting. Hide the control rather
        // than showing a toggle that cannot save.
      });
    return () => { cancelled = true; };
  }, []);

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => ({ ...previous, [field]: '' }));
    setSavedAt(null);
  };

  const handlePhotoFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a PNG, JPEG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > 1_000_000) {
      setPhotoError('Choose an image under 1 MB so it loads quickly for everyone.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setForm((previous) => ({ ...previous, avatarUrl: reader.result }));
      setFieldErrors((previous) => ({ ...previous, avatarUrl: '' }));
      setSavedAt(null);
    };
    reader.onerror = () => setPhotoError('We could not read that image. Try another file.');
    reader.readAsDataURL(file);
  };

  const skillList = useMemo(
    () => form.skills.split(',').map((skill) => skill.trim()).filter(Boolean).slice(0, 20),
    [form.skills],
  );

  const validate = () => {
    const errors = {};

    if (!form.name.trim()) {
      errors.name = 'Enter your full name so employers know who the profile belongs to.';
    }

    for (const [field, label] of [
      ['linkedinUrl', 'LinkedIn link'],
      ['portfolioUrl', 'Portfolio link'],
      ['githubUrl', 'GitHub link'],
      ['avatarUrl', 'Photo link'],
    ]) {
      if (!looksLikeLink(form[field])) {
        errors[field] = field === 'avatarUrl'
          ? 'Choose an image file or enter a full https:// image address — or use your Google photo.'
          : `Your ${label} needs to be a full address starting with https:// — or leave it empty.`;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaveError('');
    setSavedAt(null);

    if (!validate()) {
      setSaveError('Some details need fixing before we can save. See the messages below each field.');
      return;
    }

    setSaving(true);

    try {
      const saved = await savePersonalDetails({
        name: form.name.trim(),
        avatarUrl: form.avatarUrl.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        careerTargets: form.careerTargets.trim(),
        industries: form.industries.trim(),
        skills: skillList,
        linkedinUrl: form.linkedinUrl.trim(),
        portfolioUrl: form.portfolioUrl.trim(),
        githubUrl: form.githubUrl.trim(),
        resumeSummary: form.resumeSummary.trim(),
      });

      if (visibilitySupported) {
        await setVisibility(Boolean(publicTalent));
      }

      setRecord((previous) => ({ ...previous, ...saved }));
      setSavedAt(new Date());
    } catch (error) {
      setSaveError(error.message || 'We could not save your details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="surface p-6 text-sm text-muted">Loading your details…</p>;
  }

  if (loadError) {
    return (
      <div className="surface space-y-3 p-6" role="alert">
        <div className="flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>{loadError}</p>
        </div>
        <p className="text-xs text-muted">
          Your details could not be loaded, so nothing is shown here rather than showing a blank form
          that would overwrite them.
        </p>
      </div>
    );
  }

  const student = record?.student ?? null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="surface space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-2 border-b border-black/10 pb-4">
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
          <div>
            <h2 className="font-heading text-lg font-semibold">Confirmed by QIU</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              These come from your student record and cannot be edited here — they are what makes
              your verified badges and approvals trustworthy. If something is wrong, contact CPDC or
              the Registrar and they will correct it.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LockedValue label="QIU email" value={record?.user?.email} />
          <LockedValue label="Student ID" value={student?.matricNo} />
          <LockedValue label="Faculty" value={student?.faculty} />
          <LockedValue label="Programme" value={student?.programme} />
          <LockedValue label="Year of study" value={student?.academicYear ? `Year ${student.academicYear}` : null} />
          <LockedValue label="Account role" value={record?.user?.role?.replaceAll('_', ' ').toLowerCase()} />
        </div>
      </section>

      <section className="surface space-y-5 p-5 sm:p-6">
        <div className="border-b border-black/10 pb-4">
          <h2 className="font-heading text-lg font-semibold">About you</h2>
          <p className="mt-1 text-xs text-muted">You can change all of this whenever you like.</p>
        </div>

        <TextField
          id="profile-name"
          label="Full name"
          hint="Shown on your resume and to employers you apply to."
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
          required
        />

        <div>
          <div className="flex flex-col gap-4 rounded-[18px] border border-black/10 bg-black/[0.025] p-4 sm:flex-row sm:items-center">
            <Avatar name={form.name || record?.user?.name || 'QIU user'} src={form.avatarUrl || record?.user?.avatarUrl} size={72} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Profile photo</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Used consistently in your profile, event registrations, messages and employer-facing views.
                Leave your custom photo empty to use the original Google account photo automatically.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label htmlFor="profile-avatar-file" className="secondary-btn min-h-[40px] cursor-pointer justify-center text-xs">
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  Choose photo
                </label>
                <input id="profile-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoFile} className="sr-only" />
                {form.avatarUrl ? (
                  <button type="button" onClick={() => { setForm((previous) => ({ ...previous, avatarUrl: '' })); setSavedAt(null); }} className="secondary-btn min-h-[40px] justify-center text-xs">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Use Google photo
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <TextField
            id="profile-avatar"
            label="Photo link (optional)"
            hint="Use this if your photo is hosted elsewhere. A file you choose above is stored securely in standalone mode and can move to Firebase Storage later."
            placeholder="https://…"
            type="text"
            value={form.avatarUrl.startsWith('data:') ? '' : form.avatarUrl}
            onChange={update('avatarUrl')}
            error={fieldErrors.avatarUrl || photoError}
          />
        </div>

        <TextField
          id="profile-phone"
          label="Phone number (optional)"
          hint="Only QIU staff and employers you explicitly contact can use this. Leave it empty if you do not want to store one."
          placeholder="e.g. +60 12 345 6789"
          value={form.phone}
          onChange={update('phone')}
        />

        <div>
          <label htmlFor="profile-bio" className="mb-1 block text-sm font-semibold text-[#1d1d1f]">
            Short bio
          </label>
          <p id="profile-bio-hint" className="mb-2 text-xs text-muted">
            Two or three sentences a mentor or employer would want to read first. Visible to QIU
            staff, and to employers only if you join the Talent Feed.
          </p>
          <textarea
            id="profile-bio"
            aria-describedby="profile-bio-hint"
            rows={4}
            value={form.bio}
            onChange={update('bio')}
            maxLength={1200}
            className="w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 py-3 text-sm text-[#1d1d1f] placeholder:text-muted focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
          />
        </div>

        <TextField
          id="profile-career-targets"
          label="Career target"
          hint="The kind of role you are aiming for. Used to pick which workshops and jobs we show you."
          placeholder="Data analyst, clinical researcher…"
          value={form.careerTargets}
          onChange={update('careerTargets')}
        />

        <TextField
          id="profile-industries"
          label="Target industries"
          hint="Industries you want to work in. Also used for your job and workshop matches."
          placeholder="Healthcare, fintech, public sector…"
          value={form.industries}
          onChange={update('industries')}
        />

        <div>
          <TextField
            id="profile-skills"
            label="Your skills"
            hint="Separate each one with a comma, up to 20. These are your own — skills QIU verified from completed courses are listed separately below."
            placeholder="Python, communication, research design"
            value={form.skills}
            onChange={update('skills')}
          />
          {skillList.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {skillList.map((skill) => (
                <span key={skill} className="badge-pill border border-black/10 bg-black/[0.03] text-[#424245]">
                  {skill}
                </span>
              ))}
            </div>
          ) : null}
          {(student?.verifiedSkillTags?.length ?? 0) > 0 ? (
            <div className="mt-3 rounded-[16px] border border-black/10 bg-black/[0.03] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Verified by QIU · from your completed courses
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {student.verifiedSkillTags.map((skill) => (
                  <span key={skill} className="badge-pill border border-crimson/25 bg-crimson/[0.06] text-[#1d1d1f]">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface space-y-5 p-5 sm:p-6">
        <div className="border-b border-black/10 pb-4">
          <h2 className="font-heading text-lg font-semibold">Links &amp; who can find you</h2>
          <p className="mt-1 text-xs text-muted">Optional, but they make a big difference to employers.</p>
        </div>

        <TextField
          id="profile-linkedin"
          label="LinkedIn link"
          hint="Your public LinkedIn profile address."
          placeholder="https://linkedin.com/in/you"
          type="url"
          value={form.linkedinUrl}
          onChange={update('linkedinUrl')}
          error={fieldErrors.linkedinUrl}
        />
        <TextField
          id="profile-portfolio"
          label="Portfolio link"
          hint="A website showing your work, if you have one."
          placeholder="https://yourportfolio.com"
          type="url"
          value={form.portfolioUrl}
          onChange={update('portfolioUrl')}
          error={fieldErrors.portfolioUrl}
        />
        <TextField
          id="profile-github"
          label="GitHub link"
          hint="Useful for technical roles. Leave empty if it does not apply to you."
          placeholder="https://github.com/you"
          type="url"
          value={form.githubUrl}
          onChange={update('githubUrl')}
          error={fieldErrors.githubUrl}
        />

        <div>
          <label htmlFor="profile-resume-summary" className="mb-1 block text-sm font-semibold text-[#1d1d1f]">
            Resume summary (optional)
          </label>
          <p id="profile-resume-summary-hint" className="mb-2 text-xs leading-relaxed text-muted">
            Two or three sentences about the work you want. The CV page uses this instead of inventing a summary for you.
          </p>
          <textarea
            id="profile-resume-summary"
            rows={4}
            maxLength={3000}
            value={form.resumeSummary}
            onChange={update('resumeSummary')}
            aria-describedby="profile-resume-summary-hint"
            className="w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 py-3 text-sm text-[#1d1d1f] placeholder:text-muted focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
          />
        </div>

        {visibilitySupported ? (
          <label className="flex items-start gap-3 rounded-[16px] border border-crimson/20 bg-crimson/[0.04] p-4">
            <input
              type="checkbox"
              checked={publicTalent}
              onChange={(event) => { setPublicTalent(event.target.checked); setSavedAt(null); }}
              className="mt-1 h-5 w-5 accent-[var(--crimson)]"
            />
            <span>
              <span className="block text-sm font-semibold">Let employers find me in the Talent Feed</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                Off by default. When on, employers can see your approved final-year project, verified
                badges and the details on this page. Your logbook, grades and contact details always
                stay private. You can switch this off again at any time.
              </span>
            </span>
          </label>
        ) : null}
      </section>

      {saveError ? (
        <div className="flex items-start gap-2 rounded-[18px] border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>{saveError}</p>
        </div>
      ) : null}

      {savedAt ? (
        <div className="flex items-start gap-2 rounded-[18px] border border-black/10 bg-white p-3 text-sm text-[#1d1d1f]" role="status">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-crimson" aria-hidden="true" />
          <p>
            Saved to your QIU profile at{' '}
            {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. These details
            will still be here next time you sign in.
          </p>
        </div>
      ) : null}

      <button type="submit" disabled={saving} className="crimson-btn min-h-[48px] w-full justify-center disabled:opacity-60">
        <Save className="h-4 w-4" aria-hidden="true" />
        {saving ? 'Saving…' : 'Save my details'}
      </button>
    </form>
  );
}

function TextField({ id, label, hint, value, onChange, placeholder, type = 'text', error, required = false }) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-[#1d1d1f]">
        {label}
        {required ? <span className="ml-1 text-crimson" aria-hidden="true">*</span> : null}
      </label>
      {hint ? <p id={hintId} className="mb-2 text-xs leading-relaxed text-muted">{hint}</p> : null}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        aria-invalid={error ? 'true' : undefined}
        className={`h-12 w-full rounded-[18px] border bg-black/[0.04] px-4 text-sm text-[#1d1d1f] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson ${
          error ? 'border-red-400' : 'border-black/10 focus:border-crimson'
        }`}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-red-700" role="alert">{error}</p>
      ) : null}
    </div>
  );
}

function LockedValue({ label, value }) {
  return (
    <div className="rounded-[16px] border border-black/10 bg-black/[0.03] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-medium capitalize text-[#1d1d1f]">{value || 'Not set'}</p>
    </div>
  );
}
