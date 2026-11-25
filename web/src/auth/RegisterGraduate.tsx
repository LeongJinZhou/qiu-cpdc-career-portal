// "Register as a QIU graduate" after a LinkedIn sign-in that matched nobody (docs/SPEC.md rule 9).
import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiFailure, apiGet, apiWrite, useLoad } from '../api';
import { Notice, SkeletonLines, Spinner, errorText } from '../ui/parts';
import './auth.css';

const THIS_YEAR = new Date().getFullYear();

export function RegisterGraduate() {
  const pending = useLoad('registration', () => apiGet<{ name: string | null }>('/api/graduates/registration'));
  const [form, setForm] = useState({ matric_no: '', programme: '', faculty: '', graduation_year: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (name: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [name]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const year = Number(form.graduation_year);
    const found: Record<string, string> = {};
    if (form.matric_no.trim().length < 3) found.matric_no = 'Enter your matric number.';
    if (form.programme.trim().length < 2) found.programme = 'Enter the programme you studied.';
    if (!Number.isInteger(year) || year < 1990 || year > THIS_YEAR + 1) found.graduation_year = 'Enter the year you graduated.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setFailure(null);
    try {
      // A public route: no session, so no CSRF token; the server checks the Origin instead.
      await apiWrite('POST', '/api/graduates/registration', {
        matric_no: form.matric_no.trim(),
        programme: form.programme.trim(),
        ...(form.faculty.trim() ? { faculty: form.faculty.trim() } : {}),
        graduation_year: year,
      }, '');
      setDone(true);
    } catch (error) {
      if (error instanceof ApiFailure && error.field) setErrors({ [error.field]: 'Check this field.' });
      else setFailure(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  const expired = pending.error instanceof ApiFailure && pending.error.status === 404;
  return (
    <main className="auth">
      <div className="auth-card">
        <img className="auth-logo" src="/brand/qiu-logo-horizontal-dark.png" alt="Quest International University" />
        {done ? (
          <div className="panel panel-pad stack">
            <CheckCircle2 size={32} color="var(--ok)" aria-hidden="true" />
            <h1>Thank you</h1>
            <p className="muted">
              CPDC will check your details against QIU's records. Once approved, sign in with the same LinkedIn
              account.
            </p>
            <a className="btn" href="/login">Back to sign-in</a>
          </div>
        ) : (
          <>
            <div className="auth-head">
              <h1>Register as a QIU graduate</h1>
              <p>
                {pending.data?.name ? `${pending.data.name}, your` : 'Your'} LinkedIn account is not linked to a QIU
                account yet. Tell us who you were at QIU and CPDC will confirm it.
              </p>
            </div>
            {pending.loading && <SkeletonLines lines={2} />}
            {expired && (
              <Notice tone="warn">
                This page has timed out. <a href="/api/auth/linkedin/start?mode=signin">Sign in with LinkedIn again</a> to register.
              </Notice>
            )}
            {failure && <Notice tone="error">{failure}</Notice>}
            {pending.data && (
              <form className="panel panel-pad stack" onSubmit={submit} noValidate>
                <TextField id="matric" label="Matric number" value={form.matric_no} onChange={set('matric_no')} error={errors.matric_no} autoComplete="off" />
                <TextField id="programme" label="Programme" value={form.programme} onChange={set('programme')} error={errors.programme} hint="For example Bachelor of Business Administration" />
                <TextField id="faculty" label="Faculty (optional)" value={form.faculty} onChange={set('faculty')} />
                <TextField id="year" label="Year you graduated" value={form.graduation_year} onChange={set('graduation_year')} error={errors.graduation_year} inputMode="numeric" />
                <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
                  {saving && <Spinner />}
                  Send to CPDC
                </button>
              </form>
            )}
            <a className="small" href="/login">Back to sign-in</a>
          </>
        )}
      </div>
    </main>
  );
}

function TextField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text';
}) {
  const describedBy = props.error || props.hint ? `${props.id}-note` : undefined;
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        className="input"
        value={props.value}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.error ? (
        <span className="error" id={describedBy}>{props.error}</span>
      ) : (
        props.hint && <span className="hint" id={describedBy}>{props.hint}</span>
      )}
    </div>
  );
}
