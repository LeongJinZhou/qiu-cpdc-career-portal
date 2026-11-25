// CPDC creates or edits a workshop. Times are typed in Malaysia time; the server checks everything again.
import { useState, type FormEvent } from 'react';
import { ApiFailure, apiWrite } from '../api';
import { Notice, Spinner, errorText } from '../ui/parts';
import { AUDIENCE_LABEL, type Audience, type Workshop, type WorkshopDraft } from './types';

const AUDIENCES: Audience[] = ['student', 'staff', 'alumni'];

/** Request field to the input that edits it, so a problem moves the focus there. */
const FIELD_IDS: Record<string, string> = {
  title: 'ws-title', starts_at: 'ws-start', ends_at: 'ws-end', venue: 'ws-venue', online_url: 'ws-url', capacity: 'ws-cap',
};

function draftOf(w: Workshop | null): WorkshopDraft {
  return w
    ? {
        title: w.title,
        description: w.description ?? '',
        starts_at: w.starts_local,
        ends_at: w.ends_local,
        mode: w.mode,
        venue: w.venue ?? '',
        online_url: w.online_url ?? '',
        capacity: w.capacity,
        audience: w.audience,
      }
    : { title: '', description: '', starts_at: '', ends_at: '', mode: 'in_person', venue: '', online_url: '', capacity: 40, audience: ['student'] };
}

/** The first problem a person can fix before sending, or null. */
export function draftProblem(d: WorkshopDraft): { field: string; text: string } | null {
  if (!d.title.trim()) return { field: 'title', text: 'Add a title.' };
  if (!d.starts_at) return { field: 'starts_at', text: 'Add the start.' };
  if (!d.ends_at) return { field: 'ends_at', text: 'Add the end.' };
  if (d.ends_at <= d.starts_at) return { field: 'ends_at', text: 'The end must be after the start.' };
  if (d.mode === 'in_person' && !d.venue.trim()) return { field: 'venue', text: 'Add the venue.' };
  if (d.mode === 'online' && !/^https:\/\/\S+$/.test(d.online_url.trim())) return { field: 'online_url', text: 'Add the meeting link (https://...).' };
  if (!Number.isInteger(d.capacity) || d.capacity < 1 || d.capacity > 5000) return { field: 'capacity', text: 'Seats must be between 1 and 5000.' };
  if (d.audience.length === 0) return { field: 'audience', text: 'Choose who may come.' };
  return null;
}

export function WorkshopForm({
  workshop,
  csrf,
  onSaved,
  onClose,
}: {
  workshop: Workshop | null;
  csrf: string;
  onSaved: (w: Workshop) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<WorkshopDraft>(() => draftOf(workshop));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<{ field: string; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const set = <K extends keyof WorkshopDraft>(name: K, value: WorkshopDraft[K]) => {
    setDraft((d) => ({ ...d, [name]: value }));
    setProblem(null);
  };
  const invalid = (field: string) => (problem?.field === field ? true : undefined);

  async function send(method: 'POST' | 'PUT', path: string, body: unknown) {
    setSaving(true);
    try {
      onSaved(await apiWrite<Workshop>(method, path, body, csrf));
    } catch (error) {
      setProblem({ field: error instanceof ApiFailure ? (error.field ?? '') : '', text: errorText(error) });
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = draftProblem(draft);
    if (found) {
      setProblem(found);
      document.getElementById(FIELD_IDS[found.field] ?? '')?.focus();
      return;
    }
    const body = { ...draft, title: draft.title.trim(), venue: draft.mode === 'in_person' ? draft.venue.trim() : '', online_url: draft.mode === 'online' ? draft.online_url.trim() : '' };
    void send(workshop ? 'PUT' : 'POST', workshop ? `/api/workshops/${workshop.id}` : '/api/workshops', body);
  }

  return (
    <form className="panel panel-pad stack" onSubmit={submit} noValidate>
      <h2>{workshop ? 'Edit workshop' : 'New workshop'}</h2>
      <div className="field">
        <label htmlFor="ws-title">Title</label>
        <input id="ws-title" className="input" value={draft.title} maxLength={200} aria-invalid={invalid('title')} onChange={(e) => set('title', e.target.value)} placeholder="CV clinic with industry reviewers" />
      </div>
      <div className="field">
        <label htmlFor="ws-desc">What it is about</label>
        <textarea id="ws-desc" className="textarea" rows={3} value={draft.description} maxLength={5000} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div className="ws-grid">
        <div className="field">
          <label htmlFor="ws-start">Starts (Malaysia time)</label>
          <input id="ws-start" type="datetime-local" className="input" value={draft.starts_at} aria-invalid={invalid('starts_at')} onChange={(e) => set('starts_at', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ws-end">Ends (Malaysia time)</label>
          <input id="ws-end" type="datetime-local" className="input" value={draft.ends_at} aria-invalid={invalid('ends_at')} onChange={(e) => set('ends_at', e.target.value)} />
        </div>
      </div>
      <fieldset className="ws-fieldset">
        <legend className="label">Where</legend>
        <div className="row">
          <label className="check"><input type="radio" name="ws-mode" checked={draft.mode === 'in_person'} onChange={() => set('mode', 'in_person')} />On campus or a venue</label>
          <label className="check"><input type="radio" name="ws-mode" checked={draft.mode === 'online'} onChange={() => set('mode', 'online')} />Online</label>
        </div>
        {draft.mode === 'in_person' ? (
          <div className="field">
            <label htmlFor="ws-venue">Venue</label>
            <input id="ws-venue" className="input" value={draft.venue} maxLength={200} aria-invalid={invalid('venue')} onChange={(e) => set('venue', e.target.value)} placeholder="Block A, Lecture Hall 2" />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="ws-url">Meeting link</label>
            <input id="ws-url" type="url" className="input" value={draft.online_url} maxLength={500} aria-invalid={invalid('online_url')} onChange={(e) => set('online_url', e.target.value)} placeholder="https://meet.google.com/..." />
            <span className="hint">Only people with a seat see the link.</span>
          </div>
        )}
      </fieldset>
      <div className="ws-grid">
        <div className="field">
          <label htmlFor="ws-cap">Seats</label>
          <input id="ws-cap" type="number" min={1} max={5000} className="input" value={Number.isNaN(draft.capacity) ? '' : draft.capacity} aria-invalid={invalid('capacity')} onChange={(e) => set('capacity', e.target.valueAsNumber)} />
          <span className="hint">When full, people join a waitlist and move up when a seat frees.</span>
        </div>
        <fieldset className="ws-fieldset" aria-invalid={invalid('audience')}>
          <legend className="label">Open to</legend>
          <div className="row">
            {AUDIENCES.map((a) => (
              <label key={a} className="check">
                <input
                  type="checkbox"
                  checked={draft.audience.includes(a)}
                  onChange={(e) => set('audience', e.target.checked ? [...draft.audience, a] : draft.audience.filter((x) => x !== a))}
                />
                {AUDIENCE_LABEL[a]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {problem && <Notice tone="error">{problem.text}</Notice>}
      <div className="row ws-form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && <Spinner size={14} />}
          {workshop ? 'Save changes' : 'Publish workshop'}
        </button>
        <button type="button" className="btn" onClick={onClose} disabled={saving}>Back</button>
        {workshop && workshop.status !== 'cancelled' && (
          confirmCancel ? (
            <span className="row">
              <span className="small">Cancel it for everyone?</span>
              <button type="button" className="btn btn-small" disabled={saving} onClick={() => void send('POST', `/api/workshops/${workshop.id}/cancel`, undefined)}>Yes, cancel workshop</button>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirmCancel(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmCancel(true)}>Cancel workshop</button>
          )
        )}
      </div>
    </form>
  );
}
