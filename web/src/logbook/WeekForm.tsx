// One week of the logbook: new or a draft/returned week being changed. Saves a draft, or saves and sends it.
import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiWrite } from '../api';
import { errorText, Notice, Spinner } from '../ui/parts';
import { openWeeks, weekLabel, type Entry, type Internship } from './types';

interface Draft {
  week_start: string;
  hours: string;
  activities: string;
  learnings: string;
}

export function WeekForm({
  internship,
  today,
  entries,
  editing,
  csrf,
  onDone,
  onCancel,
}: {
  internship: Internship;
  today: string;
  entries: Entry[];
  editing: Entry | null;
  csrf: string;
  onDone: (entry: Entry, sent: boolean, sendError?: unknown) => void;
  onCancel: () => void;
}) {
  const weeks = openWeeks(internship, today, entries.map((e) => e.week_start), editing?.week_start);
  const [draft, setDraft] = useState<Draft>(() =>
    editing
      ? { week_start: editing.week_start, hours: String(editing.hours), activities: editing.activities, learnings: editing.learnings }
      : { week_start: weeks[0] ?? '', hours: '40', activities: '', learnings: '' },
  );
  const [busy, setBusy] = useState<'save' | 'send' | null>(null);
  const [error, setError] = useState<unknown>(null);

  if (weeks.length === 0) {
    return (
      <Notice>
        {today < internship.start_date ? 'Your internship has not started yet.' : 'Every week so far is in your logbook.'}
      </Notice>
    );
  }

  const run = (send: boolean) => (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(send ? 'send' : 'save');
    setError(null);
    const body = { ...draft, hours: Number(draft.hours) };
    const save = editing
      ? apiWrite<Entry>('PUT', `/api/logbook/entries/${editing.id}`, body, csrf)
      : apiWrite<Entry>('POST', '/api/logbook/entries', body, csrf);
    save
      .then((entry) => {
        if (!send) return onDone(entry, false);
        // Saved but not sent (mail or rate limit): the week stays a draft the student can send from the list.
        return apiWrite<Entry>('POST', `/api/logbook/entries/${entry.id}/submit`, undefined, csrf).then(
          (sent) => onDone(sent, true),
          (sendError: unknown) => onDone(entry, false, sendError),
        );
      }, setError)
      .finally(() => setBusy(null));
  };
  const tooShort = draft.activities.trim().length < 10;

  return (
    <form className="stack" onSubmit={run(false)} noValidate>
      <div className="lb-week-fields">
        <div className="field">
          <label htmlFor="wk-week">Week</label>
          <select id="wk-week" className="select" value={draft.week_start} onChange={(e) => setDraft({ ...draft, week_start: e.target.value })}>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {weekLabel(w)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wk-hours">Hours worked</label>
          <input
            id="wk-hours"
            className="input num"
            type="number"
            inputMode="numeric"
            min={0}
            max={80}
            value={draft.hours}
            onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="wk-activities">What you did</label>
        <textarea
          id="wk-activities"
          className="textarea"
          rows={5}
          maxLength={4000}
          value={draft.activities}
          aria-describedby="wk-activities-hint"
          onChange={(e) => setDraft({ ...draft, activities: e.target.value })}
        />
        <span id="wk-activities-hint" className="hint">Tasks, tools and results. At least a sentence.</span>
      </div>
      <div className="field">
        <label htmlFor="wk-learnings">What you learned</label>
        <textarea
          id="wk-learnings"
          className="textarea"
          rows={3}
          maxLength={4000}
          value={draft.learnings}
          onChange={(e) => setDraft({ ...draft, learnings: e.target.value })}
        />
      </div>
      {error !== null && <Notice tone="error">{errorText(error)}</Notice>}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={busy !== null || tooShort} onClick={() => run(true)()}>
          {busy === 'send' ? <Spinner /> : <Send size={16} aria-hidden="true" />} Send to {internship.supervisor_name}
        </button>
        <button type="submit" className="btn" disabled={busy !== null || tooShort}>
          {busy === 'save' && <Spinner />} Save draft
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
