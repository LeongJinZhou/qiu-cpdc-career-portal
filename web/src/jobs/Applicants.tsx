// CPDC: the applicants of one job, and one application with the person's profile, note, CV and status.
import { ArrowLeft, Download, Inbox } from 'lucide-react';
import { useState } from 'react';
import { apiGet, apiPatch, useLoad, type Paged } from '../api';
import type { Me } from '../auth';
import { STATUS_LABEL, dateLabel, type Profile } from '../profile/types';
import { Empty, LoadError, Notice, PersonName, SkeletonLines, Spinner, errorText } from '../ui/parts';
import { ListFooter } from './ListFooter';
import {
  APPLICATION_LABEL,
  applicationTone,
  type ApplicantRow,
  type ApplicationStatus,
  type ManagedJob,
} from './types';

const REVIEW_STATUSES: ApplicationStatus[] = ['submitted', 'reviewing', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];

interface ApplicationDetail {
  application: {
    id: number;
    note: string | null;
    status: ApplicationStatus;
    created_at: string;
    status_changed_at: string;
    has_cv: boolean;
    cv_name: string | null;
    cv_size: number | null;
  };
  job: { id: number; title: string; employer_name: string };
  profile: Profile;
}

export function Applicants({ job, me, onBack }: { job: ManagedJob; me: Me; onBack: () => void }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const query = { status, page, per_page: 25 };
  const list = useLoad(
    `applicants:${job.id}:${JSON.stringify(query)}`,
    () => apiGet<Paged<ApplicantRow>>(`/api/jobs/manage/${job.id}/applications`, query),
    `applicants:${job.id}`,
  );

  return (
    <div className="stack">
      <div>
        <button type="button" className="btn btn-quiet btn-small" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> All jobs</button>
      </div>
      <div className="split" data-detail={open !== null}>
        <section className="panel panel-pad split-list" aria-labelledby="ap-h">
          <h2 id="ap-h">{job.title}</h2>
          <p className="small muted" style={{ marginBottom: 12 }}>{job.employer_name} · applicants</p>
          <div className="field" style={{ maxWidth: 240, marginBottom: 12 }}>
            <label htmlFor="ap-status">Status</label>
            <select id="ap-status" className="select" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
              <option value="">All</option>
              {Object.entries(APPLICATION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {list.error && <LoadError error={list.error} onRetry={list.reload} />}
          {list.loading && !list.data && <SkeletonLines lines={4} />}
          {list.data && list.data.items.length === 0 && (
            <Empty icon={Inbox} title={status ? 'Nobody with this status' : 'No applications yet'}>
              {status ? 'Choose another status.' : 'Applications appear here as students and graduates apply.'}
            </Empty>
          )}
          <ul className="job-list" aria-busy={list.loading}>
            {list.data?.items.map((a) => (
              <li key={a.id}>
                <button type="button" className="job-item" aria-current={open === a.id ? 'true' : undefined} onClick={() => setOpen(a.id)}>
                  <span className="job-item-title">{a.display_name}</span>
                  <span className="job-item-employer">{[a.programme, a.faculty].filter(Boolean).join(' · ') || (a.role === 'alumni' ? 'Graduate' : 'Student')}</span>
                  <span className="job-item-meta">
                    <span className={applicationTone(a.status)}>{APPLICATION_LABEL[a.status]}</span>
                    <span className="num">Sent {dateLabel(a.created_at)}</span>
                    {a.has_cv && <span>CV attached</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {list.data && list.data.total > 0 && <ListFooter page={page} perPage={list.data.per_page} total={list.data.total} noun="application" onPage={setPage} />}
        </section>
        <div className="split-detail">
          {open === null ? (
            <section className="panel panel-pad"><Empty icon={Inbox} title="Choose an applicant">Their profile, note and CV appear here.</Empty></section>
          ) : (
            <ApplicationView key={open} id={open} me={me} onBack={() => setOpen(null)} onChanged={list.reload} />
          )}
        </div>
      </div>
    </div>
  );
}

function ApplicationView({ id, me, onBack, onChanged }: { id: number; me: Me; onBack: () => void; onChanged: () => void }) {
  const load = useLoad(`application:${id}`, () => apiGet<ApplicationDetail>(`/api/applications/${id}`));
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  if (load.error) return <section className="panel panel-pad"><LoadError error={load.error} onRetry={load.reload} /></section>;
  if (!load.data) return <section className="panel panel-pad"><SkeletonLines lines={6} /></section>;
  const { application, profile } = load.data;
  const current = status ?? application.status;
  const withdrawn = application.status === 'withdrawn';

  async function save(next: ApplicationStatus) {
    setBusy(true);
    setMessage(null);
    try {
      await apiPatch(`/api/applications/${id}/status`, { status: next }, me.csrf_token);
      setStatus(next);
      setMessage({ tone: 'ok', text: `Status set to ${APPLICATION_LABEL[next]}. The applicant sees it on their Jobs page.` });
      onChanged();
    } catch (failure) {
      setMessage({ tone: 'error', text: errorText(failure) });
    } finally {
      setBusy(false);
    }
  }

  const now = [profile.current_title, profile.current_company].filter(Boolean).join(', ');
  return (
    <article className="panel panel-pad stack" aria-label={`Application from ${profile.display_name}`}>
      <button type="button" className="btn btn-quiet btn-small split-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Applicants</button>
      <PersonName name={profile.display_name} linkedinUrl={profile.linkedin_url} photo={profile.picture_url} size={44} />
      <dl className="facts">
        <dt>Programme</dt><dd>{[profile.programme, profile.faculty].filter(Boolean).join(' · ') || 'Not set'}</dd>
        {profile.matric_no && (<><dt>Matric no</dt><dd className="num">{profile.matric_no}</dd></>)}
        {profile.headline && (<><dt>Headline</dt><dd>{profile.headline}</dd></>)}
        <dt>Now</dt><dd>{STATUS_LABEL[profile.employment_status]}{now ? `: ${now}` : ''}</dd>
        {profile.skills.length > 0 && (<><dt>Skills</dt><dd>{profile.skills.join(', ')}</dd></>)}
        <dt>Sent</dt><dd className="num">{dateLabel(application.created_at)}</dd>
      </dl>
      <div className="field">
        <span className="label">Note</span>
        <p className="prose">{application.note ?? <span className="muted">No note.</span>}</p>
      </div>
      {application.has_cv ? (
        <div>
          <a className="btn btn-small" href={`/api/applications/${id}/cv`} download>
            <Download size={15} aria-hidden="true" /> {application.cv_name ?? 'CV'}
          </a>
        </div>
      ) : (
        <p className="small muted">No CV attached.</p>
      )}
      {withdrawn ? (
        <Notice tone="warn">The applicant withdrew this application.</Notice>
      ) : (
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor="app-status">Status</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <select id="app-status" className="select" value={current} disabled={busy} onChange={(e) => void save(e.target.value as ApplicationStatus)}>
              {REVIEW_STATUSES.map((s) => <option key={s} value={s}>{APPLICATION_LABEL[s]}</option>)}
            </select>
            {busy && <Spinner />}
          </div>
        </div>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </article>
  );
}
