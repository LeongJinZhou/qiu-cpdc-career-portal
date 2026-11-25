// Learning: the person logs courses and certificates with a link or a PDF proof; CPDC verifies them.
import { Award, BookOpenCheck, Download, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiGet, apiPostForm, apiWrite, useLoad } from '../api';
import type { Me } from '../auth';
import { PdfPicker } from '../jobs/PdfPicker';
import { dayLabel, todayInMalaysia } from '../jobs/types';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, Notice, SkeletonLines, Spinner, errorText } from '../ui/parts';
import { LEARNING_LABEL, LEARNING_TONE, type LearningRecord } from './types';
import '../jobs/jobs.css';
import './learning.css';

export function LearningPage({ me }: { me: Me }) {
  const load = useLoad('learning', () => apiGet<{ items: LearningRecord[] }>('/api/learning'));
  const [items, setItems] = useState<LearningRecord[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const records = items ?? load.data?.items;

  async function remove(record: LearningRecord) {
    setMessage(null);
    try {
      await apiWrite('DELETE', `/api/learning/${record.id}`, undefined, me.csrf_token);
      setItems((records ?? []).filter((r) => r.id !== record.id));
      setMessage({ tone: 'ok', text: `${record.name} is removed.` });
    } catch (failure) {
      setMessage({ tone: 'error', text: errorText(failure) });
    }
  }

  return (
    <>
      <PageHead
        title="Learning"
        actions={!adding && (
          <button type="button" className="btn btn-primary" onClick={() => { setMessage(null); setAdding(true); }}>
            <Plus size={16} aria-hidden="true" /> Add a course or certificate
          </button>
        )}
      >
        Courses and certificates you finished outside your programme. Add a link or the certificate PDF; CPDC
        checks it and marks it verified.
      </PageHead>
      <div className="stack">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {adding && (
          <AddForm
            me={me}
            onCancel={() => setAdding(false)}
            onSaved={(next, name) => { setItems(next); setAdding(false); setMessage({ tone: 'ok', text: `${name} is added. CPDC will check it.` }); }}
          />
        )}
        <section className="panel panel-pad" aria-label="My courses and certificates">
          {load.error && !records && <LoadError error={load.error} onRetry={load.reload} />}
          {!records && !load.error && <SkeletonLines lines={4} />}
          {records && records.length === 0 && (
            <Empty icon={BookOpenCheck} title="Nothing logged yet">
              Add an online course, a short course or a professional certificate you have finished.
            </Empty>
          )}
          {records && records.length > 0 && (
            <ul className="record-list">
              {records.map((r) => <RecordRow key={r.id} record={r} onRemove={() => void remove(r)} />)}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function RecordRow({ record, onRemove }: { record: LearningRecord; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="record">
      <span className="record-icon" aria-hidden="true">{record.kind === 'certificate' ? <Award size={20} /> : <BookOpenCheck size={20} />}</span>
      <div className="record-body">
        <div className="record-title">
          <strong>{record.name}</strong>
          <span className={LEARNING_TONE[record.status]}>{LEARNING_LABEL[record.status]}</span>
        </div>
        <div className="small muted">
          {record.kind === 'certificate' ? 'Certificate' : 'Course'} · {record.provider} · finished <span className="num">{dayLabel(record.completed_on)}</span>
        </div>
        {record.status === 'rejected' && record.review_note && (
          <p className="small record-note">CPDC: {record.review_note}</p>
        )}
        <div className="row record-links">
          {record.link_url && (
            <a className="small" href={record.link_url} target="_blank" rel="noopener noreferrer">
              Open link <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
          {record.has_proof && (
            <a className="small" href={`/api/learning/${record.id}/proof`} download>
              <Download size={12} aria-hidden="true" /> {record.proof_name ?? 'Proof'}
            </a>
          )}
        </div>
      </div>
      {record.status !== 'verified' && (
        <div className="record-actions">
          {confirming ? (
            <div className="row">
              <button type="button" className="btn btn-small" onClick={onRemove}>Remove</button>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirming(false)}>Keep</button>
            </div>
          ) : (
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirming(true)} aria-label={`Remove ${record.name}`}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function AddForm({
  me,
  onCancel,
  onSaved,
}: {
  me: Me;
  onCancel: () => void;
  onSaved: (items: LearningRecord[], name: string) => void;
}) {
  const [draft, setDraft] = useState({ kind: 'certificate', name: '', provider: '', completed_on: '', link_url: '' });
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof draft, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const noEvidence = draft.link_url.trim() === '' && proof === null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (noEvidence) {
      setError('Add a link or a PDF as proof.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await apiPostForm<{ items: LearningRecord[] }>(
        '/api/learning',
        { ...draft, name: draft.name.trim(), provider: draft.provider.trim(), link_url: draft.link_url.trim(), proof },
        me.csrf_token,
      );
      onSaved(saved.items, draft.name.trim());
    } catch (failure) {
      setError(errorText(failure));
      setBusy(false);
    }
  }

  return (
    <form className="panel panel-pad stack" onSubmit={submit} aria-labelledby="lr-h">
      <h2 id="lr-h">Add a course or certificate</h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="lr-kind">Kind</label>
          <select id="lr-kind" className="select" value={draft.kind} onChange={(e) => set('kind', e.target.value)}>
            <option value="certificate">Certificate</option>
            <option value="course">Course</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="lr-name">Name</label>
          <input id="lr-name" className="input" required maxLength={200} placeholder="Google Data Analytics" value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lr-provider">Provider</label>
          <input id="lr-provider" className="input" required maxLength={200} placeholder="Coursera, HRD Corp, AWS" value={draft.provider} onChange={(e) => set('provider', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lr-date">Finished on</label>
          <input id="lr-date" className="input" type="date" required max={todayInMalaysia()} value={draft.completed_on} onChange={(e) => set('completed_on', e.target.value)} />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="lr-link">Link to the certificate</label>
          <input id="lr-link" className="input" type="url" maxLength={500} placeholder="https://" value={draft.link_url} onChange={(e) => set('link_url', e.target.value)} />
          <span className="hint">A verification page from the provider, if there is one.</span>
        </div>
        <PdfPicker label="Or the certificate PDF" hint="PDF, up to 5 MB. Only you and CPDC can open it." file={proof} onChange={setProof} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Spinner />}Add</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
