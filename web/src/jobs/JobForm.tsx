// CPDC: post or edit a job or internship, with the skill levels it asks for (used by the skills gap view).
import { useState, type FormEvent } from 'react';
import { ApiFailure, apiGet, apiWrite, useLoad, type Paged } from '../api';
import type { Me } from '../auth';
import type { SkillArea } from '../skills/types';
import { LoadError, Notice, SkeletonLines, Spinner, errorText } from '../ui/parts';
import { JOB_STATUS_LABEL, TYPE_LABEL, todayInMalaysia, type Employer, type JobForEdit, type JobStatus, type JobType } from './types';

interface Draft {
  employer_id: string;
  title: string;
  job_type: JobType;
  location: string;
  closing_date: string;
  description: string;
  status: JobStatus;
  skills: Record<number, number>; // area id => level 1-5; absent = not asked for
}

const EMPTY: Draft = {
  employer_id: '',
  title: '',
  job_type: 'internship',
  location: '',
  closing_date: '',
  description: '',
  status: 'open',
  skills: {},
};

function fromJob(job: JobForEdit): Draft {
  return {
    employer_id: String(job.employer_id),
    title: job.title,
    job_type: job.job_type,
    location: job.location,
    closing_date: job.closing_date,
    description: job.description,
    status: job.status,
    skills: Object.fromEntries(job.skills.map((s) => [s.area_id, s.level])),
  };
}

export function JobForm({
  id,
  me,
  onCancel,
  onSaved,
  onNeedEmployer,
}: {
  id: number | null;
  me: Me;
  onCancel: () => void;
  onSaved: (title: string) => void;
  onNeedEmployer: () => void;
}) {
  const data = useLoad(`job-form:${id ?? 'new'}`, async () => {
    const [employers, skills, job] = await Promise.all([
      apiGet<Paged<Employer>>('/api/employers', { per_page: 200 }),
      apiGet<{ areas: SkillArea[] }>('/api/skills/areas'),
      id === null ? Promise.resolve(null) : apiGet<JobForEdit>(`/api/jobs/manage/${id}`),
    ]);
    return { employers: employers.items, areas: skills.areas, job };
  });

  if (data.error) return <section className="panel panel-pad"><LoadError error={data.error} onRetry={data.reload} /></section>;
  if (!data.data) return <section className="panel panel-pad"><SkeletonLines lines={8} /></section>;
  const { employers, areas, job } = data.data;
  const choosable = employers.filter((e) => e.active || e.id === job?.employer_id);
  if (choosable.length === 0) {
    return (
      <section className="panel panel-pad stack">
        <Notice tone="info">Add the employer to the directory first, then post its job.</Notice>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={onNeedEmployer}>Open the employer directory</button>
          <button type="button" className="btn btn-quiet" onClick={onCancel}>Back</button>
        </div>
      </section>
    );
  }
  return <Editor key={id ?? 'new'} id={id} me={me} start={job ? fromJob(job) : EMPTY} employers={choosable} areas={areas} onCancel={onCancel} onSaved={onSaved} />;
}

function Editor({
  id,
  me,
  start,
  employers,
  areas,
  onCancel,
  onSaved,
}: {
  id: number | null;
  me: Me;
  start: Draft;
  employers: Employer[];
  areas: SkillArea[];
  onCancel: () => void;
  onSaved: (title: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: string | null; text: string } | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setLevel = (area: number, level: number) =>
    setDraft((d) => {
      const skills = { ...d.skills };
      if (level === 0) delete skills[area];
      else skills[area] = level;
      return { ...d, skills };
    });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      employer_id: Number(draft.employer_id),
      title: draft.title.trim(),
      job_type: draft.job_type,
      location: draft.location.trim(),
      closing_date: draft.closing_date,
      description: draft.description.trim(),
      status: draft.status,
      skills: Object.entries(draft.skills).map(([area, level]) => ({ area_id: Number(area), level })),
    };
    try {
      await apiWrite(id === null ? 'POST' : 'PUT', id === null ? '/api/jobs/manage' : `/api/jobs/manage/${id}`, body, me.csrf_token);
      onSaved(body.title);
    } catch (failure) {
      setError({ field: failure instanceof ApiFailure ? failure.field : null, text: errorText(failure) });
    } finally {
      setBusy(false);
    }
  }

  const invalid = (field: string) => (error?.field?.startsWith(field) ? true : undefined);
  return (
    <form className="panel panel-pad stack" onSubmit={submit} aria-labelledby="jf-h">
      <h2 id="jf-h">{id === null ? 'Post a job' : 'Edit job'}</h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="jf-employer">Employer</label>
          <select id="jf-employer" className="select" required value={draft.employer_id} aria-invalid={invalid('employer_id')} onChange={(e) => set('employer_id', e.target.value)}>
            <option value="" disabled>Choose an employer</option>
            {employers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="jf-title">Job title</label>
          <input id="jf-title" className="input" required maxLength={200} value={draft.title} aria-invalid={invalid('title')} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="jf-type">Type</label>
          <select id="jf-type" className="select" value={draft.job_type} onChange={(e) => set('job_type', e.target.value as JobType)}>
            {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="jf-location">Location</label>
          <input id="jf-location" className="input" required maxLength={200} placeholder="Ipoh, Kuala Lumpur or Remote" value={draft.location} aria-invalid={invalid('location')} onChange={(e) => set('location', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="jf-closing">Closing date</label>
          <input id="jf-closing" className="input" type="date" required min={id === null ? todayInMalaysia() : undefined} value={draft.closing_date} aria-invalid={invalid('closing_date')} onChange={(e) => set('closing_date', e.target.value)} />
          <span className="hint">Applications are taken through this day (Malaysia time).</span>
        </div>
        <div className="field">
          <label htmlFor="jf-status">Status</label>
          <select id="jf-status" className="select" value={draft.status} onChange={(e) => set('status', e.target.value as JobStatus)}>
            {Object.entries(JOB_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="hint">Only open jobs are shown to students and graduates.</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="jf-desc">Description</label>
        <textarea id="jf-desc" className="textarea" required maxLength={10000} rows={7} placeholder="What the role does, who it suits, how to prepare." value={draft.description} aria-invalid={invalid('description')} onChange={(e) => set('description', e.target.value)} />
      </div>
      <fieldset className="levels" aria-describedby="jf-skills-h">
        <legend>Skills asked for</legend>
        <p className="hint" id="jf-skills-h">Optional. Students compare their own rating against these levels.</p>
        {areas.map((area) => (
          <div className="level-row" key={area.id}>
            <label htmlFor={`jf-skill-${area.id}`}>{area.name}</label>
            <select id={`jf-skill-${area.id}`} className="select" value={draft.skills[area.id] ?? 0} onChange={(e) => setLevel(area.id, Number(e.target.value))}>
              <option value={0}>Not needed</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}
            </select>
          </div>
        ))}
      </fieldset>
      {error && <Notice tone="error">{error.text}</Notice>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{id === null ? 'Post job' : 'Save changes'}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
