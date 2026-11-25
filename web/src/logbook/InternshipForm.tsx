// The student's internship and industry supervisor: the supervisor receives each week's review link.
import { useState, type FormEvent } from 'react';
import { apiWrite } from '../api';
import { errorText, Notice, Spinner } from '../ui/parts';
import type { Internship, Logbook } from './types';

type Draft = Omit<Internship, 'id'>;

const EMPTY: Draft = { company: '', supervisor_name: '', supervisor_email: '', start_date: '', end_date: '' };

export function InternshipForm({
  internship,
  csrf,
  onSaved,
  onCancel,
}: {
  internship: Internship | null;
  csrf: string;
  onSaved: (logbook: Logbook) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => {
    if (!internship) return EMPTY;
    const { company, supervisor_name, supervisor_email, start_date, end_date } = internship;
    return { company, supervisor_name, supervisor_email, start_date, end_date };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const emailChanged = internship !== null && draft.supervisor_email.trim().toLowerCase() !== internship.supervisor_email;

  const save = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    apiWrite<Logbook>('PUT', '/api/logbook/internship', draft, csrf)
      .then(onSaved, setError)
      .finally(() => setBusy(false));
  };
  const set = (key: keyof Draft) => (value: string) => setDraft({ ...draft, [key]: value });

  return (
    <form className="stack" onSubmit={save} noValidate>
      <div className="grid-2">
        <Field id="in-company" label="Company" value={draft.company} onChange={set('company')} autoComplete="organization" />
        <Field id="in-sup-name" label="Supervisor's name" value={draft.supervisor_name} onChange={set('supervisor_name')} />
        <Field
          id="in-sup-email"
          label="Supervisor's work email"
          type="email"
          value={draft.supervisor_email}
          onChange={set('supervisor_email')}
          hint="Each week you send goes here as a link. Your supervisor needs no account."
        />
        <div className="grid-2">
          <Field id="in-start" label="Starts" type="date" value={draft.start_date} onChange={set('start_date')} />
          <Field id="in-end" label="Ends" type="date" value={draft.end_date} onChange={set('end_date')} />
        </div>
      </div>
      {emailChanged && (
        <Notice tone="warn">Links already sent to the old address stop working. Send those weeks again after saving.</Notice>
      )}
      {error !== null && <Notice tone="error">{errorText(error)}</Notice>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy && <Spinner />} Save internship
        </button>
        {onCancel && (
          <button type="button" className="btn btn-quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  hint,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        required
        autoComplete={autoComplete ?? 'off'}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span id={`${id}-hint`} className="hint">{hint}</span>}
    </div>
  );
}
