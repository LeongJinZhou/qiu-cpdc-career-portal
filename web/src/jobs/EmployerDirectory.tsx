// CPDC: the employer directory. Add or edit an employer; an inactive one keeps its history but its jobs are hidden.
import { Building2, ExternalLink, Plus, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiGet, apiWrite, useLoad, type Paged } from '../api';
import type { Me } from '../auth';
import { Empty, LoadError, Notice, SkeletonLines, Spinner, errorText } from '../ui/parts';
import { ListFooter } from './ListFooter';
import type { Employer } from './types';

type Editing = { kind: 'none' } | { kind: 'new' } | { kind: 'edit'; employer: Employer };

export function EmployerDirectory({ me }: { me: Me }) {
  const [draftQ, setDraftQ] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>({ kind: 'none' });
  const [saved, setSaved] = useState<string | null>(null);
  const query = { q, page, per_page: 25 };
  const list = useLoad(`employers:${JSON.stringify(query)}`, () => apiGet<Paged<Employer>>('/api/employers', query), 'employers');
  const search = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQ(draftQ);
  };

  return (
    <div className="stack">
      {saved && <Notice tone="ok">{saved}</Notice>}
      {editing.kind !== 'none' && (
        <EmployerForm
          key={editing.kind === 'edit' ? editing.employer.id : 'new'}
          me={me}
          employer={editing.kind === 'edit' ? editing.employer : null}
          onCancel={() => setEditing({ kind: 'none' })}
          onSaved={(name) => { setSaved(`${name} is saved.`); setEditing({ kind: 'none' }); list.reload(); }}
        />
      )}
      <section className="panel panel-pad" aria-label="Employers">
        <form className="toolbar" onSubmit={search} style={{ marginBottom: 14 }}>
          <div className="field" style={{ flex: '2 1 220px' }}>
            <label htmlFor="em-q">Search</label>
            <input id="em-q" className="input" placeholder="Name or industry" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} />
          </div>
          <button type="submit" className="btn"><Search size={16} aria-hidden="true" /> Show</button>
          {editing.kind === 'none' && (
            <button type="button" className="btn btn-primary" onClick={() => { setSaved(null); setEditing({ kind: 'new' }); }}>
              <Plus size={16} aria-hidden="true" /> Add employer
            </button>
          )}
        </form>
        {list.error && <LoadError error={list.error} onRetry={list.reload} />}
        {list.loading && !list.data && <SkeletonLines lines={4} />}
        {list.data && list.data.items.length === 0 && (
          <Empty icon={Building2} title={q ? 'No employers match' : 'No employers yet'}>
            {q ? 'Try another name.' : 'Add the companies and organisations CPDC works with.'}
          </Empty>
        )}
        {list.data && list.data.items.length > 0 && (
          <div className="table-wrap" aria-busy={list.loading}>
            <table className="table table-cards">
              <thead>
                <tr>
                  <th>Employer</th>
                  <th>Industry · Location</th>
                  <th className="num">Jobs</th>
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong className="cell-title">{e.name}</strong>
                      {!e.active && <span className="badge" style={{ marginLeft: 8 }}>Inactive</span>}
                      {e.website && (
                        <div className="small">
                          <a href={e.website} target="_blank" rel="noopener noreferrer">Website <ExternalLink size={12} aria-hidden="true" /></a>
                        </div>
                      )}
                    </td>
                    <td className="small">{[e.industry, e.location].filter(Boolean).join(' · ') || <span className="muted">Not set</span>}</td>
                    <td className="num" data-label="Jobs">{e.jobs}</td>
                    <td className="cell-actions">
                      <button type="button" className="btn btn-quiet btn-small" onClick={() => { setSaved(null); setEditing({ kind: 'edit', employer: e }); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && list.data.total > 0 && <ListFooter page={page} perPage={list.data.per_page} total={list.data.total} noun="employer" onPage={setPage} />}
      </section>
    </div>
  );
}

function EmployerForm({
  me,
  employer,
  onCancel,
  onSaved,
}: {
  me: Me;
  employer: Employer | null;
  onCancel: () => void;
  onSaved: (name: string) => void;
}) {
  const [draft, setDraft] = useState({
    name: employer?.name ?? '',
    industry: employer?.industry ?? '',
    website: employer?.website ?? '',
    location: employer?.location ?? '',
    about: employer?.about ?? '',
    active: employer?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof draft, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = { ...draft, name: draft.name.trim(), website: draft.website.trim() };
    try {
      await apiWrite(employer ? 'PUT' : 'POST', employer ? `/api/employers/${employer.id}` : '/api/employers', body, me.csrf_token);
      onSaved(body.name);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel panel-pad stack" onSubmit={submit} aria-labelledby="ef-h">
      <h2 id="ef-h">{employer ? `Edit ${employer.name}` : 'Add an employer'}</h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="ef-name">Name</label>
          <input id="ef-name" className="input" required maxLength={200} value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ef-industry">Industry</label>
          <input id="ef-industry" className="input" maxLength={200} value={draft.industry} onChange={(e) => set('industry', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ef-web">Website</label>
          <input id="ef-web" className="input" type="url" maxLength={300} placeholder="https://" value={draft.website} onChange={(e) => set('website', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ef-loc">Location</label>
          <input id="ef-loc" className="input" maxLength={200} value={draft.location} onChange={(e) => set('location', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ef-about">About</label>
        <textarea id="ef-about" className="textarea" maxLength={3000} value={draft.about} onChange={(e) => set('about', e.target.value)} />
      </div>
      {employer && (
        <label className="check">
          <input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} />
          <span>Active. When off, this employer's jobs are hidden from students and graduates.</span>
        </label>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{employer ? 'Save changes' : 'Add employer'}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
