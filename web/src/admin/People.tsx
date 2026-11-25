// Everyone in the portal: search, role, LinkedIn status. Names open LinkedIn; "View" opens the full profile.
import { Search, Users } from 'lucide-react';
import { useState, type FormEvent, type MouseEvent } from 'react';
import { apiGet, useLoad, type Paged } from '../api';
import { ROLE_LABEL, type Role } from '../auth';
import { dateLabel } from '../profile/types';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, PersonName, SkeletonLines } from '../ui/parts';
import { Pager } from './Pager';
import './admin.css';

interface PersonRow {
  id: number;
  display_name: string;
  email: string | null;
  picture_url: string | null;
  role: Role;
  matric_no: string | null;
  employee_id: string | null;
  department: string | null;
  onboarded_at: string | null;
  last_sign_in_at: string | null;
  linkedin_url: string | null;
  linkedin_linked: boolean;
}

export function People({ go }: { go: (to: string) => void }) {
  const [draft, setDraft] = useState({ q: '', role: '', linkedin: '' });
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const query = { ...filters, page, per_page: 25 };
  const list = useLoad(`people:${JSON.stringify(query)}`, () => apiGet<Paged<PersonRow>>('/api/people', query), 'people');

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilters(draft);
  };
  const open = (id: number) => (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    go(`/people/${id}`);
  };

  return (
    <>
      <PageHead title="People">Students, staff and alumni who have signed in, and whether their LinkedIn is linked.</PageHead>
      <section className="panel panel-pad">
        <form className="toolbar" onSubmit={apply} style={{ marginBottom: 16 }}>
          <div className="field" style={{ flex: '2 1 240px' }}>
            <label htmlFor="pp-q">Search</label>
            <input id="pp-q" className="input" placeholder="Name, email, matric or staff number" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pp-role">Role</label>
            <select id="pp-role" className="select" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
              <option value="">All</option>
              {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pp-li">LinkedIn</label>
            <select id="pp-li" className="select" value={draft.linkedin} onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })}>
              <option value="">All</option>
              <option value="linked">Linked</option>
              <option value="missing">Not linked</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary"><Search size={16} aria-hidden="true" /> Show</button>
        </form>
        {list.error && <LoadError error={list.error} onRetry={list.reload} />}
        {list.loading && !list.data && <SkeletonLines lines={5} />}
        {list.data && list.data.items.length === 0 && <Empty icon={Users} title="Nobody matches">Try another search.</Empty>}
        {list.data && list.data.items.length > 0 && (
          <div className="table-wrap" aria-busy={list.loading}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Faculty or department</th>
                  <th>LinkedIn</th>
                  <th>Last sign-in</th>
                  <th><span className="visually-hidden">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <PersonName name={p.display_name} linkedinUrl={p.linkedin_url} photo={p.picture_url} />
                      <div className="small muted num" style={{ marginLeft: 42 }}>{p.matric_no ?? p.employee_id ?? p.email ?? ''}</div>
                    </td>
                    <td><span className="badge">{ROLE_LABEL[p.role]}</span></td>
                    <td className="small">{p.department ?? '-'}</td>
                    <td>
                      {p.linkedin_linked ? <span className="badge badge-ok">Linked</span> : <span className="badge badge-warn">Not linked</span>}
                    </td>
                    <td className="small muted num">{dateLabel(p.last_sign_in_at)}</td>
                    <td><a className="btn btn-small" href={`/people/${p.id}`} onClick={open(p.id)}>View</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pager page={page} perPage={list.data.per_page} total={list.data.total} onPage={setPage} />}
      </section>
    </>
  );
}
