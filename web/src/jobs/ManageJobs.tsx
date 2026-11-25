// CPDC: jobs and internships (post, edit, see applicants) and the employer directory.
import { BriefcaseBusiness, Plus, Search, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiGet, useLoad, type Paged } from '../api';
import type { Me } from '../auth';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, Notice, SkeletonLines } from '../ui/parts';
import { Applicants } from './Applicants';
import { Closing } from './Closing';
import { EmployerDirectory } from './EmployerDirectory';
import { JobForm } from './JobForm';
import { ListFooter } from './ListFooter';
import { JOB_STATUS_LABEL, TYPE_LABEL, type ManagedJob } from './types';
import './jobs.css';

type View = { kind: 'list' } | { kind: 'edit'; id: number | null } | { kind: 'applicants'; job: ManagedJob };

export function ManageJobs({ me }: { me: Me }) {
  const [tab, setTab] = useState<'jobs' | 'employers'>('jobs');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <>
      <PageHead
        title="Employers and jobs"
        actions={
          tab === 'jobs' && view.kind === 'list' ? (
            <button type="button" className="btn btn-primary" onClick={() => { setSaved(null); setView({ kind: 'edit', id: null }); }}>
              <Plus size={16} aria-hidden="true" /> Post a job
            </button>
          ) : undefined
        }
      >
        Post jobs and internships for students and graduates, follow their applications and keep the employer list.
      </PageHead>
      <div className="tabs" role="tablist" aria-label="Employers and jobs">
        <button type="button" role="tab" aria-selected={tab === 'jobs'} onClick={() => { setTab('jobs'); setView({ kind: 'list' }); }}>Jobs</button>
        <button type="button" role="tab" aria-selected={tab === 'employers'} onClick={() => setTab('employers')}>Employers</button>
      </div>
      {saved && view.kind === 'list' && tab === 'jobs' && <div style={{ marginBottom: 16 }}><Notice tone="ok">{saved}</Notice></div>}

      {tab === 'employers' && <EmployerDirectory me={me} />}
      {tab === 'jobs' && view.kind === 'edit' && (
        <JobForm
          id={view.id}
          me={me}
          onCancel={() => setView({ kind: 'list' })}
          onSaved={(title) => { setSaved(`${title} is saved.`); setView({ kind: 'list' }); }}
          onNeedEmployer={() => setTab('employers')}
        />
      )}
      {tab === 'jobs' && view.kind === 'applicants' && (
        <Applicants job={view.job} me={me} onBack={() => setView({ kind: 'list' })} />
      )}
      {tab === 'jobs' && view.kind === 'list' && (
        <JobTable onEdit={(id) => { setSaved(null); setView({ kind: 'edit', id }); }} onApplicants={(job) => setView({ kind: 'applicants', job })} />
      )}
    </>
  );
}

function JobTable({ onEdit, onApplicants }: { onEdit: (id: number) => void; onApplicants: (job: ManagedJob) => void }) {
  const [draft, setDraft] = useState({ q: '', status: '' });
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const query = { ...filters, page, per_page: 25 };
  const list = useLoad(`manage-jobs:${JSON.stringify(query)}`, () => apiGet<Paged<ManagedJob>>('/api/jobs/manage', query), 'manage-jobs');
  const apply = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilters(draft);
  };

  return (
    <section className="panel panel-pad" aria-label="Jobs">
      <form className="toolbar" onSubmit={apply} style={{ marginBottom: 14 }}>
        <div className="field" style={{ flex: '2 1 220px' }}>
          <label htmlFor="mj-q">Search</label>
          <input id="mj-q" className="input" placeholder="Job title or employer" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="mj-status">Status</label>
          <select id="mj-status" className="select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <option value="">All</option>
            {Object.entries(JOB_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary"><Search size={16} aria-hidden="true" /> Show</button>
      </form>
      {list.error && <LoadError error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <SkeletonLines lines={5} />}
      {list.data && list.data.items.length === 0 && (
        <Empty icon={BriefcaseBusiness} title="No jobs yet">Post the first job or internship with the button above.</Empty>
      )}
      {list.data && list.data.items.length > 0 && (
        <div className="table-wrap" aria-busy={list.loading}>
          <table className="table table-cards">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Closing</th>
                <th className="num">Applications</th>
                <th><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((job) => (
                <tr key={job.id}>
                  <td>
                    <strong className="cell-title">{job.title}</strong>
                    <div className="small muted">{job.employer_name} · {TYPE_LABEL[job.job_type]} · {job.location}</div>
                  </td>
                  <td><span className={job.status === 'open' ? 'badge badge-ok' : 'badge'}>{JOB_STATUS_LABEL[job.status]}</span></td>
                  <td className="small" data-label="Closing"><Closing date={job.closing_date} /></td>
                  <td className="num" data-label="Applications">
                    {job.applications}
                    {job.new_applications > 0 && <span className="badge badge-red" style={{ marginLeft: 6 }}>{job.new_applications} new</span>}
                  </td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <button type="button" className="btn btn-small" onClick={() => onApplicants(job)}>
                        <Users size={15} aria-hidden="true" /> Applicants
                      </button>
                      <button type="button" className="btn btn-quiet btn-small" onClick={() => onEdit(job.id)}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && list.data.total > 0 && <ListFooter page={page} perPage={list.data.per_page} total={list.data.total} noun="job" onPage={setPage} />}
    </section>
  );
}
