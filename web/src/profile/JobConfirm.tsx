// Alumni confirm what they do now (docs/SPEC.md rule 11): one short form at the top of the profile.
import { BriefcaseBusiness } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiWrite } from '../api';
import { Notice, Spinner, errorText } from '../ui/parts';
import { STATUS_LABEL, type EmploymentStatus, type Profile } from './types';

const CHOICES: EmploymentStatus[] = ['employed', 'self_employed', 'further_study', 'seeking', 'not_seeking'];

export function JobConfirm({ profile, csrf, onDone }: { profile: Profile; csrf: string; onDone: () => void }) {
  const [status, setStatus] = useState<EmploymentStatus>(profile.employment_status === 'unknown' ? 'employed' : profile.employment_status);
  const [title, setTitle] = useState(profile.current_title ?? '');
  const [company, setCompany] = useState(profile.current_company ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsJob = status === 'employed' || status === 'self_employed';

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (needsJob && !title.trim()) {
      setError('Add your job title.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiWrite('POST', '/api/profile/job-confirmation', {
        employment_status: status,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(company.trim() ? { company: company.trim() } : {}),
      }, csrf);
      onDone();
    } catch (failure) {
      setError(errorText(failure));
      setSaving(false);
    }
  }

  return (
    <form className="panel panel-pad stack" onSubmit={confirm} style={{ borderColor: 'var(--crimson)', marginBottom: 20 }} noValidate>
      <div className="row" style={{ gap: 12 }}>
        <BriefcaseBusiness size={22} color="var(--crimson)" aria-hidden="true" />
        <h2>What are you doing now?</h2>
      </div>
      <p className="muted small">It takes ten seconds and helps QIU support the next graduates.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="field">
        <label htmlFor="jc-status">Right now I am</label>
        <select id="jc-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as EmploymentStatus)}>
          {CHOICES.map((value) => (
            <option key={value} value={value}>{STATUS_LABEL[value]}</option>
          ))}
        </select>
      </div>
      {(needsJob || status === 'further_study') && (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="jc-title">{needsJob ? 'Job title' : 'Course'}</label>
            <input id="jc-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="jc-company">{needsJob ? 'Company' : 'University'}</label>
            <input id="jc-company" className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={saving} style={{ justifySelf: 'start' }}>
        {saving && <Spinner />}Confirm
      </button>
    </form>
  );
}
