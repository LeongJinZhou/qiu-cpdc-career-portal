// CPDC's interview question bank: add questions by field, edit them, switch them off (never deleted).
import { BookOpenCheck, Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiFailure, apiGet, apiWrite, useLoad, type Paged } from '../api';
import { Pager } from '../admin/Pager';
import type { Me } from '../auth';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, Notice, SkeletonLines, Spinner, errorText } from '../ui/parts';
import type { Question } from './types';
import './interview.css';

type Draft = { field: string; question: string; tip: string };

export function QuestionBank({ me }: { me: Me }) {
  const [field, setField] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<number | null>(null);
  const query = { field, page, per_page: 50 };
  const list = useLoad(`interview-bank:${JSON.stringify(query)}`, () => apiGet<Paged<Question> & { fields: string[] }>('/api/interview/questions', query), 'interview-bank');

  return (
    <>
      <PageHead title="Interview questions">
        The questions students and alumni practise with. Switched-off questions stay in old sessions. Every change is in the audit log.
      </PageHead>
      <div className="iv-bank">
        <QuestionForm me={me} fields={list.data?.fields ?? []} onSaved={() => list.reload()} />
        <section className="panel panel-pad" aria-labelledby="bank-h">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 id="bank-h">Question bank</h2>
            <div className="field" style={{ minWidth: 200 }}>
              <label htmlFor="bank-field" className="visually-hidden">Field</label>
              <select id="bank-field" className="select" value={field} onChange={(e) => { setField(e.target.value); setPage(1); }}>
                <option value="">All fields</option>
                {(list.data?.fields ?? []).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          {list.error && <LoadError error={list.error} onRetry={list.reload} />}
          {list.loading && !list.data && <SkeletonLines lines={6} />}
          {list.data && list.data.items.length === 0 && <Empty icon={BookOpenCheck} title="No questions here">Add the first one.</Empty>}
          {list.data && list.data.items.length > 0 && (
            <ul className="iv-bank-list" aria-busy={list.loading}>
              {list.data.items.map((q) =>
                editing === q.id ? (
                  <li key={q.id}>
                    <QuestionForm me={me} fields={list.data?.fields ?? []} question={q} onSaved={() => { setEditing(null); list.reload(); }} onCancel={() => setEditing(null)} />
                  </li>
                ) : (
                  <QuestionRow key={q.id} me={me} question={q} onEdit={() => setEditing(q.id)} onChanged={list.reload} />
                ),
              )}
            </ul>
          )}
          {list.data && <Pager page={page} perPage={list.data.per_page} total={list.data.total} onPage={setPage} />}
        </section>
      </div>
    </>
  );
}

function QuestionRow({ me, question: q, onEdit, onChanged }: { me: Me; question: Question; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await apiWrite('PUT', `/api/interview/questions/${q.id}`, { active: !q.active }, me.csrf_token);
      onChanged();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className={`iv-bank-row${q.active ? '' : ' is-off'}`}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="small muted">{q.field}{q.active ? '' : ' · switched off'}</span>
        <strong>{q.question}</strong>
        {q.tip && <span className="small muted">Tip: {q.tip}</span>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <button type="button" className="btn btn-small btn-quiet" onClick={onEdit} aria-label={`Edit: ${q.question}`}>
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-small" onClick={() => void toggle()} disabled={busy}>
          {busy && <Spinner size={14} />}{q.active ? 'Switch off' : 'Switch on'}
        </button>
      </div>
    </li>
  );
}

function QuestionForm({ me, fields, question, onSaved, onCancel }: { me: Me; fields: string[]; question?: Question; onSaved: () => void; onCancel?: () => void }) {
  const empty: Draft = { field: question?.field ?? '', question: question?.question ?? '', tip: question?.tip ?? '' };
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field: string | null; text: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const id = question ? `q${question.id}` : 'new';

  async function save(event: FormEvent) {
    event.preventDefault();
    if (draft.field.trim().length < 2) return setError({ field: 'field', text: 'Add the field, for example "Business".' });
    if (draft.question.trim().length < 10) return setError({ field: 'question', text: 'Write the question (at least 10 characters).' });
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body = { field: draft.field.trim(), question: draft.question.trim(), tip: draft.tip.trim() };
      if (question) await apiWrite('PUT', `/api/interview/questions/${question.id}`, body, me.csrf_token);
      else await apiWrite('POST', '/api/interview/questions', body, me.csrf_token);
      if (!question) {
        setDraft({ field: draft.field, question: '', tip: '' });
        setSaved(true);
      }
      onSaved();
    } catch (failure) {
      setError({ field: failure instanceof ApiFailure ? failure.field : null, text: errorText(failure) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={question ? 'iv-bank-edit stack' : 'panel panel-pad stack'} onSubmit={save} noValidate aria-label={question ? 'Edit question' : 'Add a question'}>
      {!question && <h2>Add a question</h2>}
      <div className="field">
        <label htmlFor={`${id}-field`}>Field</label>
        <input id={`${id}-field`} className="input" list={`${id}-fields`} maxLength={80} value={draft.field} aria-invalid={error?.field === 'field' ? true : undefined} onChange={(e) => setDraft({ ...draft, field: e.target.value })} />
        <datalist id={`${id}-fields`}>{fields.map((f) => <option key={f} value={f} />)}</datalist>
      </div>
      <div className="field">
        <label htmlFor={`${id}-question`}>Question</label>
        <textarea id={`${id}-question`} className="textarea" rows={2} maxLength={500} value={draft.question} aria-invalid={error?.field === 'question' ? true : undefined} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-tip`}>Tip for the student (optional)</label>
        <input id={`${id}-tip`} className="input" maxLength={500} value={draft.tip} onChange={(e) => setDraft({ ...draft, tip: e.target.value })} />
      </div>
      {error && <Notice tone="error">{error.text}</Notice>}
      {saved && <Notice tone="ok">Question added.</Notice>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Spinner /> : !question && <Plus size={16} aria-hidden="true" />}{question ? 'Save question' : 'Add question'}
        </button>
        {onCancel && <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
