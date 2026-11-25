'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, FileUp, Linkedin, Loader2, X } from 'lucide-react';

// Bring a student's LinkedIn profile into their QIU profile and CV.
//
// LinkedIn's sign-in gives only name, email and photo. Everything else
// (headline, About, jobs, education, skills) comes from the PDF the student
// downloads from their own LinkedIn profile. The server reads the PDF and
// returns a preview; nothing is saved until the student ticks what to keep.
// Saving goes through the normal profile and CV endpoints, so the same
// server validation applies.

const LIMITS = { title: 120, organisation: 120, description: 800, date: 40, skills: 20, entries: 20 };

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.');
  return payload;
}

function entryKey(entry) {
  return `${entry.title}|${entry.organisation}`.toLowerCase();
}

function toCvEntry(entry, section, index) {
  return {
    id: `linkedin-${section}-${Date.now()}-${index}`,
    title: String(entry.title ?? '').slice(0, LIMITS.title),
    organisation: String(entry.organisation ?? '').slice(0, LIMITS.organisation),
    startDate: String(entry.startDate ?? '').slice(0, LIMITS.date),
    endDate: String(entry.endDate ?? '').slice(0, LIMITS.date),
    description: String(entry.description ?? '').slice(0, LIMITS.description),
  };
}

/** Existing entries stay; imported ones are added unless already there. */
function mergeEntries(existing = [], imported = [], section) {
  const seen = new Set(existing.map(entryKey));
  const added = imported
    .map((entry, index) => toCvEntry(entry, section, index))
    .filter((entry) => entry.title && !seen.has(entryKey(entry)));
  return [...existing, ...added].slice(0, LIMITS.entries);
}

function buildSelection(preview) {
  return {
    headline: Boolean(preview.headline),
    summary: Boolean(preview.summary),
    skills: preview.skills.length > 0,
    experience: preview.experience.map(() => true),
    education: preview.education.map(() => true),
    awards: preview.certifications.length + preview.honors.length > 0,
  };
}

async function saveImport(preview, selection) {
  const profile = await readJson(await fetch('/api/identity/profile', { cache: 'no-store', credentials: 'include' }));
  const patch = {};
  // The server already cut About to the 1200-character bio limit.
  if (selection.summary) patch.bio = preview.summary;
  else if (selection.headline && !profile.profile?.bio) patch.bio = preview.headline;
  if (selection.headline) patch.resumeSummary = preview.headline;
  if (selection.skills) {
    const current = profile.profile?.skills ?? [];
    const lower = new Set(current.map((skill) => skill.toLowerCase()));
    patch.skills = [...current, ...preview.skills.filter((skill) => !lower.has(skill.toLowerCase()))]
      .map((skill) => skill.slice(0, 40))
      .slice(0, LIMITS.skills);
  }
  if (Object.keys(patch).length) {
    await readJson(await fetch('/api/identity/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    }));
  }

  const experience = preview.experience.filter((_, index) => selection.experience[index]);
  const education = preview.education.filter((_, index) => selection.education[index]);
  const awards = selection.awards
    ? [...preview.certifications, ...preview.honors].map((title) => ({ title, organisation: '', startDate: '', endDate: '', description: '' }))
    : [];

  if (experience.length || education.length || awards.length) {
    try {
      const { sections } = await readJson(await fetch('/api/profile/cv', { cache: 'no-store', credentials: 'include' }));
      const next = {};
      if (experience.length) next.experience = mergeEntries(sections.experience, experience, 'experience');
      if (education.length) next.education = mergeEntries(sections.education, education, 'education');
      if (awards.length) next.achievements = mergeEntries(sections.achievements, awards, 'achievements');
      await readJson(await fetch('/api/profile/cv', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(next),
      }));
    } catch (cvError) {
      // Two saves: say exactly which one did not happen.
      throw new Error(Object.keys(patch).length
        ? `Your details were saved, but your resume entries were not: ${cvError.message}`
        : cvError.message);
    }
  }
}

// The whole card is the label, so the full card is the click target.
function Choice({ checked, onChange, label, children }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-black/10 p-3 transition hover:bg-black/[0.02] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[#e50914]"
      />
      <span className="min-w-0 text-sm">
        <span className="font-semibold text-[#1d1d1f]">{label}</span>
        <span className="mt-0.5 block break-words text-xs leading-relaxed text-muted">{children}</span>
      </span>
    </label>
  );
}

function period(entry) {
  return [entry.startDate, entry.endDate].filter(Boolean).join(' – ');
}

export default function LinkedInImport({ onImported }) {
  const inputRef = useRef(null);
  const foundRef = useRef(null);
  const savedRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | reading | preview | saving | saved
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [selection, setSelection] = useState(null);

  // The focused control unmounts when the step changes; move focus to the new
  // step so keyboard and screen-reader users are not dropped on <body>.
  useEffect(() => {
    if (status === 'preview') foundRef.current?.focus();
    if (status === 'saved') savedRef.current?.focus();
  }, [status]);

  const reset = () => {
    setError('');
    setPreview(null);
    setSelection(null);
    setStatus('idle');
    if (inputRef.current) inputRef.current.value = '';
  };

  const readFile = async (file) => {
    if (!file) return;
    setError('');
    setStatus('reading');
    try {
      // Raw bytes, not multipart: the server can stop reading at its size cap.
      const data = await readJson(await fetch('/api/profile/linkedin-import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/pdf' },
        body: file,
      }));
      setPreview(data.preview);
      setSelection(buildSelection(data.preview));
      setStatus('preview');
    } catch (readError) {
      setError(readError.message);
      setStatus('idle');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const save = async () => {
    setError('');
    setStatus('saving');
    try {
      await saveImport(preview, selection);
      setStatus('saved');
      onImported?.();
    } catch (saveError) {
      setError(saveError.message);
      setStatus('preview');
    }
  };

  const set = (key, value) => setSelection((previous) => ({ ...previous, [key]: value }));
  const setItem = (key, index, value) => setSelection((previous) => ({
    ...previous,
    [key]: previous[key].map((item, itemIndex) => (itemIndex === index ? value : item)),
  }));

  const nothingFound = preview && !preview.headline && !preview.summary && !preview.skills.length
    && !preview.experience.length && !preview.education.length
    && !preview.certifications.length && !preview.honors.length;
  const anySelected = selection && (selection.headline || selection.summary || selection.skills || selection.awards
    || selection.experience.some(Boolean) || selection.education.some(Boolean));

  return (
    <section className="surface space-y-4 p-5 sm:p-6" aria-labelledby="linkedin-import-title">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#0a66c2] text-white" aria-hidden="true">
          <Linkedin className="h-5 w-5" />
        </span>
        <div>
          <h2 id="linkedin-import-title" className="font-heading text-base font-semibold">Import from LinkedIn</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            On LinkedIn, open your profile, choose <strong>More</strong>, then <strong>Save to PDF</strong>.
            Upload that file here. You choose what to keep before anything is saved.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-[12px] border border-crimson/30 bg-crimson/5 p-3 text-sm text-[#1d1d1f]" role="alert">{error}</p>
      ) : null}

      {status === 'idle' || status === 'reading' ? (
        <div aria-live="polite">
          <input
            ref={inputRef}
            id="linkedin-pdf"
            type="file"
            accept="application/pdf,.pdf"
            className="peer sr-only"
            onChange={(event) => readFile(event.target.files?.[0])}
            disabled={status === 'reading'}
          />
          <label
            htmlFor="linkedin-pdf"
            aria-disabled={status === 'reading'}
            className={`secondary-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${status === 'reading' ? 'pointer-events-none opacity-60' : ''}`}
          >
            {status === 'reading'
              ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Reading your profile…</>
              : <><FileUp className="h-4 w-4" aria-hidden="true" /> Choose LinkedIn PDF</>}
          </label>
        </div>
      ) : null}

      {status === 'saved' ? (
        <div ref={savedRef} tabIndex={-1} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-emerald-600/20 bg-emerald-50 p-3 focus:outline-none" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <Check className="h-4 w-4" aria-hidden="true" /> Imported. Your details and resume are updated.
          </p>
          <button type="button" className="secondary-btn min-h-[44px]" onClick={reset}>Import another file</button>
        </div>
      ) : null}

      {(status === 'preview' || status === 'saving') && preview ? (
        <div className="space-y-4">
          <p ref={foundRef} tabIndex={-1} className="text-sm text-[#1d1d1f] focus:outline-none">
            Found <strong>{preview.name}</strong>. Untick anything you do not want.
          </p>

          {nothingFound ? (
            <p className="text-sm text-muted">We found your name but no other details in this file.</p>
          ) : null}

          <div className="grid gap-2">
            {preview.headline ? (
              <Choice label="Use headline as your resume summary (replaces the current one)" checked={selection.headline} onChange={(value) => set('headline', value)}>
                {preview.headline}
              </Choice>
            ) : null}
            {preview.summary ? (
              <Choice label="Use About as your bio (replaces your current bio)" checked={selection.summary} onChange={(value) => set('summary', value)}>
                {preview.summary.length > 220 ? `${preview.summary.slice(0, 220)}…` : preview.summary}
              </Choice>
            ) : null}
            {preview.skills.length ? (
              <Choice label="Add top skills to your skills (up to 20 in total)" checked={selection.skills} onChange={(value) => set('skills', value)}>
                {preview.skills.join(', ')}
              </Choice>
            ) : null}
            {preview.certifications.length + preview.honors.length ? (
              <Choice label="Add certifications and awards to achievements" checked={selection.awards} onChange={(value) => set('awards', value)}>
                {[...preview.certifications, ...preview.honors].join(', ')}
              </Choice>
            ) : null}
          </div>

          {preview.experience.length ? (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Work experience</legend>
              {preview.experience.map((entry, index) => (
                <Choice
                  key={`${entry.title}-${entry.organisation}-${entry.startDate}`}
                  label={`${entry.title}${entry.organisation ? ` · ${entry.organisation}` : ''}`}
                  checked={selection.experience[index]}
                  onChange={(value) => setItem('experience', index, value)}
                >
                  {period(entry)}
                </Choice>
              ))}
            </fieldset>
          ) : null}

          {preview.education.length ? (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Education</legend>
              {preview.education.map((entry, index) => (
                <Choice
                  key={`${entry.organisation}-${entry.title}`}
                  label={entry.organisation}
                  checked={selection.education[index]}
                  onChange={(value) => setItem('education', index, value)}
                >
                  {[entry.title !== entry.organisation ? entry.title : '', period(entry)].filter(Boolean).join(' · ')}
                </Choice>
              ))}
            </fieldset>
          ) : null}

          {preview.languages.length ? (
            <p className="text-xs text-muted">Languages found (not imported): {preview.languages.join(', ')}</p>
          ) : null}

          <p className="text-xs text-muted">
            Jobs, education and awards are added to your resume; ones already there are skipped.
          </p>
          {!anySelected ? <p className="text-xs font-semibold text-[#1d1d1f]">Tick at least one item to save.</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="crimson-btn inline-flex min-h-[44px] items-center gap-2 disabled:opacity-60"
              onClick={save}
              disabled={status === 'saving' || !anySelected}
            >
              {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              {status === 'saving' ? 'Saving…' : 'Save to my profile'}
            </button>
            <button type="button" className="secondary-btn inline-flex min-h-[44px] items-center gap-2" onClick={reset} disabled={status === 'saving'}>
              <X className="h-4 w-4" aria-hidden="true" /> Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
