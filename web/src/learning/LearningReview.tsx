// CPDC: check the courses and certificates students and graduates logged, and verify or decline them.
import { BadgeCheck, Download, ExternalLink, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiGet, apiWrite, useLoad, type Paged } from '../api';
import type { Me } from '../auth';
import { ListFooter } from '../jobs/ListFooter';
import { dayLabel } from '../jobs/types';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, Notice, PersonName, SkeletonLines, Spinner, errorText } from '../ui/parts';
import { LEARNING_LABEL, LEARNING_TONE, type LearningStatus, type ReviewRecord } from './types';
import '../admin/admin.css';
import '../jobs/jobs.css';
import './learning.css';

export function LearningReview({ me }: { me: Me }) {
  const [draft, setDraft] = useState({ q: '', status: 'submitted' });
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const query = { ...filters, page, per_page: 25 };
  const list = useLoad(`learning-review:${JSON.stringify(query)}`, () => apiGet<Paged<ReviewRecord>>('/api/learning/review', query), 'learning-review');
  const apply = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilters(draft);
  };

  return (
    <>
      <PageHead title="Learning checks">
        Courses and certificates logged by students and graduates. Open the link or PDF, then verify it or say what is
        missing. Each decision is in the audit log.
      </PageHead>
      {message && <div style={{ marginBottom: 16 }}><Notice tone={message.tone}>{message.text}</Notice></div>}
      <section className="panel panel-pad">
        <form className="toolbar" onSubmit={apply} style={{ marginBottom: 14 }}>
          <div className="field" style={{ flex: '2 1 220px' }}>
            <label htmlFor="lv-q">Search</label>
            <input id="lv-q" className="input" placeholder="Name, matric no, course or provider" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="lv-status">Status</label>
            <select id="lv-status" className="select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              <option value="">All</option>
              {Object.entries(LEARNING_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary"><Search size={16} aria-hidden="true" /> Show</button>
        </form>
        {list.error && <LoadError error={list.error} onRetry={list.reload} />}
        {list.loading && !list.data && <SkeletonLines lines={4} />}
        {list.data && list.data.items.length === 0 && (
          <Empty icon={BadgeCheck} title={filters.status === 'submitted' ? 'Nothing waiting' : 'Nothing matches'}>
            {filters.status === 'submitted' ? 'New courses and certificates appear here.' : 'Try other filters.'}
          </Empty>
        )}
        {list.data?.items.map((r) => (
          <ReviewRow
            key={r.id}
            record={r}
            me={me}
            onDecided={(text) => { setMessage({ tone: 'ok', text }); list.reload(); }}
          />
        ))}
        {list.data && list.data.total > 0 && <ListFooter page={page} perPage={list.data.per_page} total={list.data.total} noun="record" onPage={setPage} />}
      </section>
    </>
  );
}

function ReviewRow({ record, me, onDecided }: { record: ReviewRecord; me: Me; onDecided: (text: string) => void }) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: Exclude<LearningStatus, 'submitted'>) {
    setBusy(true);
    setError(null);
    try {
      await apiWrite('POST', `/api/learning/${record.id}/decision`, { decision, note: note.trim() }, me.csrf_token);
      onDecided(decision === 'verified' ? `${record.name} for ${record.display_name} is verified.` : `${record.display_name} is told what is missing.`);
    } catch (failure) {
      setError(errorText(failure));
      setBusy(false);
    }
  }

  return (
    <div className="decide">
      <div className="stack" style={{ gap: 6 }}>
        <PersonName name={record.display_name} linkedinUrl={record.linkedin_url} photo={record.picture_url} />
        <div>
          <strong>{record.name}</strong> <span className={LEARNING_TONE[record.status]}>{LEARNING_LABEL[record.status]}</span>
        </div>
        <div className="small muted">
          {record.kind === 'certificate' ? 'Certificate' : 'Course'} · {record.provider} · finished <span className="num">{dayLabel(record.completed_on)}</span>
          {record.matric_no && <> · <span className="num">{record.matric_no}</span></>}
        </div>
        <div className="row">
          {record.link_url && (
            <a className="small" href={record.link_url} target="_blank" rel="noopener noreferrer">Open link <ExternalLink size={12} aria-hidden="true" /></a>
          )}
          {record.has_proof && (
            <a className="small" href={`/api/learning/${record.id}/proof`} download><Download size={12} aria-hidden="true" /> {record.proof_name ?? 'Proof'}</a>
          )}
        </div>
        {record.review_note && record.status === 'rejected' && <p className="small record-note">Note sent: {record.review_note}</p>}
        {declining && (
          <div className="field">
            <label htmlFor={`lv-note-${record.id}`}>What is missing?</label>
            <textarea id={`lv-note-${record.id}`} className="textarea" style={{ minHeight: 80 }} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The link does not open; please upload the certificate PDF." />
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
      <div className="row">
        {declining ? (
          <>
            <button type="button" className="btn btn-primary btn-small" disabled={busy || note.trim() === ''} onClick={() => void decide('rejected')}>{busy && <Spinner size={14} />}Send</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setDeclining(false)}>Cancel</button>
          </>
        ) : (
          <>
            {record.status !== 'verified' && (
              <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => void decide('verified')}>{busy && <Spinner size={14} />}Verify</button>
            )}
            {record.status !== 'rejected' && (
              <button type="button" className="btn btn-small" disabled={busy} onClick={() => setDeclining(true)}>Decline</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
