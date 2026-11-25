// LinkedIn PDF import (docs/SPEC.md rule 7): upload, see what was found, then save it to the profile.
import { FileUp, Sparkles } from 'lucide-react';
import { useId, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import { apiUpload, apiWrite } from '../api';
import { Notice, Spinner, errorText } from '../ui/parts';
import { monthLabel, type PdfPreview, type Profile } from './types';

const MAX_BYTES = 5 * 1024 * 1024;

export function PdfImport({ csrf, onSaved }: { csrf: string; onSaved: (p: Profile) => void }) {
  const inputId = useId();
  const [busy, setBusy] = useState<'reading' | 'saving' | null>(null);
  const [preview, setPreview] = useState<PdfPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);

  async function read(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSaved(false);
    if (file.type && file.type !== 'application/pdf') {
      setError('Choose the PDF you saved from your LinkedIn profile.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('The PDF must be smaller than 5 MB.');
      return;
    }
    setBusy('reading');
    try {
      setPreview(await apiUpload<PdfPreview>('/api/profile/linkedin-pdf', 'file', file, csrf));
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!preview) return;
    setBusy('saving');
    setError(null);
    try {
      const fields: Record<string, string> = {};
      if (preview.headline) fields.headline = preview.headline;
      if (preview.about) fields.about = preview.about;
      if (preview.location) fields.location = preview.location;
      const profile = await apiWrite<Profile>('PUT', '/api/profile', {
        source: 'pdf',
        fields,
        experience: preview.experience,
        education: preview.education.map((s) => ({ ...s, field: null })),
        skills: preview.skills,
      }, csrf);
      onSaved(profile);
      setPreview(null);
      setSaved(true);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(null);
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    void read(event.dataTransfer.files[0]);
  };

  return (
    <section className="panel panel-pad stack" aria-labelledby="pdf-h">
      <h2 id="pdf-h">Fill from LinkedIn</h2>
      <p className="small muted">
        On your LinkedIn profile choose <strong>Resources</strong> (or <strong>More</strong>), then{' '}
        <strong>Save to PDF</strong>. Upload that file here: we read your headline, about, jobs, education and skills.
        The file is not kept.
      </p>
      {saved && <Notice tone="ok">Your LinkedIn details are saved to your profile.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {!preview && (
        <label
          className="drop"
          htmlFor={inputId}
          data-over={over}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          {busy === 'reading' ? <Spinner size={24} /> : <FileUp size={24} aria-hidden="true" />}
          <strong style={{ color: 'var(--ink)' }}>{busy === 'reading' ? 'Reading your PDF' : 'Choose your LinkedIn PDF'}</strong>
          <span className="small">or drop it here</span>
          <input id={inputId} type="file" accept="application/pdf,.pdf" disabled={busy !== null} onChange={(e: ChangeEvent<HTMLInputElement>) => { void read(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      )}
      {preview && (
        <div className="stack">
          <p className="row small" style={{ color: 'var(--ok)', fontWeight: 550 }}>
            <Sparkles size={16} aria-hidden="true" /> Found on {preview.name}'s profile
          </p>
          <div className="found">
            {preview.headline && <Found label="Headline">{preview.headline}</Found>}
            {preview.about && <Found label="About">{preview.about.length > 160 ? `${preview.about.slice(0, 160)}…` : preview.about}</Found>}
            {preview.experience.map((job, i) => (
              <Found key={`j${i}`} label={`${monthLabel(job.start)} to ${monthLabel(job.end, true)}`}>
                {job.title}, {job.company}
              </Found>
            ))}
            {preview.education.map((s, i) => (
              <Found key={`e${i}`} label={s.end_year ? `Until ${s.end_year}` : 'Education'}>
                {s.degree ? `${s.degree}, ` : ''}{s.school}
              </Found>
            ))}
            {preview.skills.length > 0 && <Found label="Skills">{preview.skills.join(', ')}</Found>}
          </div>
          <p className="small muted">Saving replaces the jobs, education and skills on your profile with these.</p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy !== null}>
              {busy === 'saving' && <Spinner />}
              Save to my profile
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setPreview(null)} disabled={busy !== null}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Found({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="found-item">
      <span className="small muted">{label}</span>
      <strong>{children}</strong>
    </div>
  );
}
