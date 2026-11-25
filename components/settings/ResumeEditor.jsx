'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Download, FileUp, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';

const RESUME_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const RESUME_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read. Please choose it again.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

const SECTIONS = [
  {
    key: 'experience',
    title: 'Work experience',
    hint: 'Jobs, internships and industrial training. Add anything that is not already logged in your QIU logbook.',
    titleLabel: 'Job title',
    titlePlaceholder: 'Marketing intern',
    orgLabel: 'Company or organisation',
    orgPlaceholder: 'Ipoh Digital Sdn Bhd',
    addLabel: 'Add a job',
  },
  {
    key: 'volunteering',
    title: 'Volunteering',
    hint: 'Community work, clubs and societies, committee roles.',
    titleLabel: 'Your role',
    titlePlaceholder: 'Events volunteer',
    orgLabel: 'Organisation',
    orgPlaceholder: 'QIU Student Council',
    addLabel: 'Add volunteering',
  },
  {
    key: 'achievements',
    title: 'Achievements & awards',
    hint: 'Competitions, scholarships, certificates and awards from outside QIU.',
    titleLabel: 'Achievement',
    titlePlaceholder: 'Runner-up, National Hackathon',
    orgLabel: 'Awarded by',
    orgPlaceholder: 'MDEC',
    addLabel: 'Add an achievement',
  },
  {
    key: 'education',
    title: 'Education',
    hint: 'Schools and qualifications before or outside QIU. Your QIU programme is added from the university record.',
    titleLabel: 'Qualification',
    titlePlaceholder: 'SPM',
    orgLabel: 'School or institution',
    orgPlaceholder: 'SMK Ipoh',
    addLabel: 'Add education',
  },
];

const EMPTY_SECTIONS = { experience: [], volunteering: [], achievements: [], education: [] };

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Something went wrong. Please try again.');
  }
  return payload;
}

async function loadSections() {
  return readJson(await fetch('/api/profile/cv', { cache: 'no-store', credentials: 'include' }));
}

async function persistSections(sections) {
  return readJson(await fetch('/api/profile/cv', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(sections),
  }));
}

function blankEntry() {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    organisation: '',
    startDate: '',
    endDate: '',
    description: '',
    source: 'MANUAL',
  };
}

/**
 * The manual half of the resume.
 *
 * What a student writes here sits alongside — never on top of — the entries the
 * platform fills in automatically from approved logbook hours, verified badges
 * and their approved final-year project. Those cannot be edited from this
 * screen by design: an employer needs to be able to tell which lines QIU stood
 * behind. The server stamps every entry saved here as self-declared.
 */
export default function ResumeEditor() {
  const [sections, setSections] = useState(EMPTY_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    let cancelled = false;

    loadSections()
      .then((data) => {
        if (cancelled) return;
        setSections({ ...EMPTY_SECTIONS, ...(data.sections ?? {}) });
        setLoadError('');
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const updateEntry = (sectionKey, entryId, field) => (event) => {
    const { value } = event.target;
    setSavedAt(null);
    setFieldError('');
    setSections((previous) => ({
      ...previous,
      [sectionKey]: previous[sectionKey].map((entry) => (
        entry.id === entryId ? { ...entry, [field]: value } : entry
      )),
    }));
  };

  const addEntry = (sectionKey) => {
    setSavedAt(null);
    setSections((previous) => ({
      ...previous,
      [sectionKey]: [...previous[sectionKey], blankEntry()],
    }));
  };

  const removeEntry = (sectionKey, entryId) => {
    setSavedAt(null);
    setSections((previous) => ({
      ...previous,
      [sectionKey]: previous[sectionKey].filter((entry) => entry.id !== entryId),
    }));
  };

  const handleSave = async () => {
    setSaveError('');
    setSavedAt(null);

    const incomplete = SECTIONS.find(
      (section) => (sections[section.key] ?? []).some((entry) => !entry.title.trim()),
    );

    if (incomplete) {
      setFieldError(
        `Every entry under "${incomplete.title}" needs a ${incomplete.titleLabel.toLowerCase()}. Fill it in, or remove the empty entry.`,
      );
      return;
    }

    setFieldError('');
    setSaving(true);

    try {
      const result = await persistSections(sections);
      setSections({ ...EMPTY_SECTIONS, ...(result.sections ?? {}) });
      setSavedAt(new Date());
    } catch (error) {
      setSaveError(error.message || 'We could not save your resume sections. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="surface p-6 text-sm text-muted">Loading your resume sections…</p>;
  }

  if (loadError) {
    return (
      <div className="surface space-y-3 p-6" role="alert">
        <div className="flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>{loadError}</p>
        </div>
        <p className="text-xs text-muted">
          Nothing is shown here rather than an empty form, so saving cannot wipe what you wrote
          before.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResumeFileUpload />

      <div className="surface flex items-start gap-2.5 p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-crimson" aria-hidden="true" />
        <div>
          <h2 className="font-heading text-base font-semibold">What you add here vs what QIU adds</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Your approved logbook hours, verified badges, completed courses and approved final-year
            project are added to your resume automatically and are marked as verified by QIU — you
            cannot edit those, and that is exactly why employers trust them. Everything on this page
            is written by you and appears as your own. Both are useful; they are just labelled
            honestly.
          </p>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.key} className="surface space-y-4 p-5 sm:p-6">
          <div className="border-b border-black/10 pb-4">
            <h2 className="font-heading text-lg font-semibold">{section.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">{section.hint}</p>
          </div>

          {(sections[section.key] ?? []).length === 0 ? (
            <p className="text-sm text-muted">Nothing added yet.</p>
          ) : null}

          {(sections[section.key] ?? []).map((entry, index) => (
            <fieldset key={entry.id} className="space-y-3 rounded-[18px] border border-black/10 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Entry {index + 1}
              </legend>

              <Field
                id={`${section.key}-${entry.id}-title`}
                label={section.titleLabel}
                placeholder={section.titlePlaceholder}
                value={entry.title}
                onChange={updateEntry(section.key, entry.id, 'title')}
                required
              />
              <Field
                id={`${section.key}-${entry.id}-org`}
                label={section.orgLabel}
                placeholder={section.orgPlaceholder}
                value={entry.organisation}
                onChange={updateEntry(section.key, entry.id, 'organisation')}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  id={`${section.key}-${entry.id}-start`}
                  label="Started"
                  hint="Month and year is enough."
                  placeholder="Jan 2025"
                  value={entry.startDate}
                  onChange={updateEntry(section.key, entry.id, 'startDate')}
                />
                <Field
                  id={`${section.key}-${entry.id}-end`}
                  label="Ended"
                  hint="Leave empty if this is ongoing."
                  placeholder="Jun 2025"
                  value={entry.endDate}
                  onChange={updateEntry(section.key, entry.id, 'endDate')}
                />
              </div>

              <div>
                <label
                  htmlFor={`${section.key}-${entry.id}-desc`}
                  className="mb-1 block text-sm font-semibold text-[#1d1d1f]"
                >
                  What you did
                </label>
                <p id={`${section.key}-${entry.id}-desc-hint`} className="mb-2 text-xs text-muted">
                  One or two lines. Employers read this part first.
                </p>
                <textarea
                  id={`${section.key}-${entry.id}-desc`}
                  aria-describedby={`${section.key}-${entry.id}-desc-hint`}
                  rows={3}
                  maxLength={800}
                  value={entry.description}
                  onChange={updateEntry(section.key, entry.id, 'description')}
                  className="w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 py-3 text-sm text-[#1d1d1f] placeholder:text-muted focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
                />
              </div>

              <button
                type="button"
                onClick={() => removeEntry(section.key, entry.id)}
                className="secondary-btn inline-flex min-h-[44px] items-center gap-2 text-sm"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove this entry
              </button>
            </fieldset>
          ))}

          <button
            type="button"
            onClick={() => addEntry(section.key)}
            className="secondary-btn inline-flex min-h-[44px] items-center gap-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {section.addLabel}
          </button>
        </section>
      ))}

      {fieldError ? (
        <p className="text-sm font-medium text-red-700" role="alert">{fieldError}</p>
      ) : null}

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
            Resume sections saved at{' '}
            {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. They will
            appear on your resume and are still here when you come back.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="crimson-btn min-h-[48px] w-full justify-center disabled:opacity-60"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {saving ? 'Saving…' : 'Save my resume sections'}
      </button>
    </div>
  );
}

/**
 * Upload an existing resume document (PDF/Word). This is the whole-file a
 * student attaches themselves — distinct from the structured sections above and
 * from the QIU-verified auto-CV. Stored inline via /api/profile/resume.
 */
function ResumeFileUpload() {
  const inputRef = useRef(null);
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile/resume', { cache: 'no-store', credentials: 'include' })
      .then(readJson)
      .then((data) => { if (!cancelled) setResume(data.resume ?? null); })
      .catch((loadError) => { if (!cancelled) setError(loadError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleChoose = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setStatus('');
    if (!RESUME_MIME.has(file.type)) {
      setError('Please choose a PDF or Word document (.doc or .docx).');
      return;
    }
    if (file.size > RESUME_MAX_BYTES) {
      setError('That file is larger than 5 MB. Please upload a smaller resume.');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const data = await readJson(await fetch('/api/profile/resume', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, fileType: file.type, dataUrl }),
      }));
      setResume(data.resume ?? null);
      setStatus(`Uploaded ${file.name}. Employers who view your profile can now download it.`);
    } catch (uploadError) {
      setError(uploadError.message || 'We could not upload that file. Please try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownload = async () => {
    setError('');
    try {
      const data = await readJson(await fetch('/api/profile/resume?download=1', { cache: 'no-store', credentials: 'include' }));
      if (!data.resume?.dataUrl) { setError('There is no uploaded resume to download.'); return; }
      const link = document.createElement('a');
      link.href = data.resume.dataUrl;
      link.download = data.resume.fileName || 'resume';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (downloadError) {
      setError(downloadError.message || 'We could not open that file.');
    }
  };

  const handleRemove = async () => {
    setError('');
    setStatus('');
    setBusy(true);
    try {
      await readJson(await fetch('/api/profile/resume', { method: 'DELETE', credentials: 'include' }));
      setResume(null);
      setStatus('Your uploaded resume was removed.');
    } catch (removeError) {
      setError(removeError.message || 'We could not remove that file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface space-y-4 p-5 sm:p-6">
      <div className="flex items-start gap-2.5 border-b border-black/10 pb-4">
        <FileUp className="mt-0.5 h-5 w-5 flex-shrink-0 text-crimson" aria-hidden="true" />
        <div>
          <h2 className="font-heading text-lg font-semibold">Upload your resume file</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Already have a resume as a PDF or Word file? Attach it here. This is optional — the
            sections below and your verified QIU record already build a resume for you. PDF or Word,
            up to 5 MB.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Checking for an uploaded resume…</p>
      ) : resume?.hasFile ? (
        <div className="flex flex-col gap-3 rounded-[18px] border border-black/10 bg-black/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1d1d1f]">{resume.fileName}</p>
            <p className="text-xs text-muted">Uploaded and saved to your profile.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleDownload} className="secondary-btn inline-flex min-h-[44px] items-center gap-2 text-sm">
              <Download className="h-4 w-4" aria-hidden="true" /> Download
            </button>
            <button type="button" onClick={handleRemove} disabled={busy} className="secondary-btn inline-flex min-h-[44px] items-center gap-2 text-sm disabled:opacity-60">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">No resume file uploaded yet.</p>
      )}

      <label htmlFor="resume-file-input" className="block rounded-[18px] border-2 border-dashed border-black/15 bg-black/[0.02] p-5 text-sm hover:border-crimson/40">
        <span className="block font-semibold">{resume?.hasFile ? 'Replace the uploaded file' : 'Choose a file to upload'}</span>
        <span className="mt-1 block text-xs text-muted">PDF, .doc or .docx · maximum 5 MB</span>
        <input
          id="resume-file-input"
          ref={inputRef}
          type="file"
          accept={RESUME_ACCEPT}
          disabled={busy}
          onChange={handleChoose}
          className="mt-4 block w-full text-xs disabled:opacity-60"
        />
      </label>

      {busy ? <p className="text-sm text-muted" role="status">Uploading…</p> : null}
      {error ? (
        <p className="flex items-start gap-2 text-sm font-medium text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />{error}
        </p>
      ) : null}
      {status ? (
        <p className="flex items-start gap-2 text-sm text-[#1d1d1f]" role="status">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-crimson" aria-hidden="true" />{status}
        </p>
      ) : null}
    </section>
  );
}

function Field({ id, label, hint, value, onChange, placeholder, required = false }) {
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-[#1d1d1f]">
        {label}
        {required ? <span className="ml-1 text-crimson" aria-hidden="true">*</span> : null}
      </label>
      {hint ? <p id={hintId} className="mb-2 text-xs text-muted">{hint}</p> : null}
      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-describedby={hint ? hintId : undefined}
        className="h-12 w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 text-sm text-[#1d1d1f] placeholder:text-muted focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
      />
    </div>
  );
}
