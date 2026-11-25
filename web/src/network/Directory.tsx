// The opt-in alumni directory: search, filters, and "Ask for mentoring" for students.
import { HandHelping, Search, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiGet, useLoad, type Paged } from '../api';
import { Pager } from '../admin/Pager';
import { can, type Me } from '../auth';
import { Empty, LoadError, Notice, PersonName, SkeletonLines } from '../ui/parts';
import { AskMentor } from './AskMentor';
import type { DirectoryEntry } from './types';

type Filters = { q: string; faculty: string; year: string; mentors: string };
const NO_FILTERS: Filters = { q: '', faculty: '', year: '', mentors: '' };

export function Directory({ me, askedIds, onAsked }: { me: Me; askedIds: Set<number>; onAsked: () => void }) {
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [asking, setAsking] = useState<number | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const query = { ...filters, page, per_page: 24 };
  const list = useLoad(`directory:${JSON.stringify(query)}`, () => apiGet<Paged<DirectoryEntry> & { faculties: string[] }>('/api/network/directory', query), 'directory');
  const mayAsk = can(me, 'mentoring.request');

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilters(draft);
  };

  return (
    <section className="panel panel-pad" aria-labelledby="dir-h">
      <h2 id="dir-h" style={{ marginBottom: 14 }}>Alumni directory</h2>
      <form className="toolbar" onSubmit={apply} style={{ marginBottom: 18 }}>
        <div className="field" style={{ flex: '2 1 220px' }}>
          <label htmlFor="dir-q">Search</label>
          <input id="dir-q" className="input" placeholder="Name, job or company" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="dir-fac">Faculty</label>
          <select id="dir-fac" className="select" value={draft.faculty} onChange={(e) => setDraft({ ...draft, faculty: e.target.value })}>
            <option value="">All</option>
            {(list.data?.faculties ?? []).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '0 1 120px', minWidth: 100 }}>
          <label htmlFor="dir-year">Graduated</label>
          <input id="dir-year" className="input" inputMode="numeric" placeholder="Any year" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
        </div>
        <label className="check net-toggle">
          <input type="checkbox" checked={draft.mentors === '1'} onChange={(e) => setDraft({ ...draft, mentors: e.target.checked ? '1' : '' })} />
          <span>Mentors only</span>
        </label>
        <button type="submit" className="btn btn-primary"><Search size={16} aria-hidden="true" /> Show</button>
      </form>
      {sentTo && <Notice tone="ok">Request sent to {sentTo}. You see their answer under "Your mentoring requests".</Notice>}
      {list.error && <LoadError error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <SkeletonLines lines={5} />}
      {list.data && list.data.items.length === 0 && (
        <Empty icon={Users} title={JSON.stringify(filters) === JSON.stringify(NO_FILTERS) ? 'No alumni have joined the directory yet' : 'Nobody matches'}>
          {JSON.stringify(filters) === JSON.stringify(NO_FILTERS) ? 'Alumni choose to appear here. Check again soon.' : 'Try other filters.'}
        </Empty>
      )}
      {list.data && list.data.items.length > 0 && (
        <ul className="net-cards" aria-busy={list.loading}>
          {list.data.items.map((a) => {
            const where = [a.title, a.company].filter(Boolean).join(' at ');
            const school = [a.faculty, a.graduation_year ? `Class of ${a.graduation_year}` : null].filter(Boolean).join(' · ');
            return (
              <li key={a.id} className="net-card">
                <PersonName name={a.display_name} linkedinUrl={a.linkedin_url} size={40} />
                {where && <p className="net-where">{where}</p>}
                {school && <p className="small muted">{school}</p>}
                {a.mentor && (
                  <div className="net-mentor">
                    <div className="net-mentor-head">
                      <span className="small"><HandHelping size={15} aria-hidden="true" /> Mentor</span>
                      <span className="small muted num">
                        {a.mentor.slots_left === 0 ? 'Full this month' : `${a.mentor.slots_left} ${a.mentor.slots_left === 1 ? 'place' : 'places'} left this month`}
                      </span>
                    </div>
                    <ul className="chips" aria-label="Topics">
                      {a.mentor.topics.map((t) => <li key={t} className="chip">{t}</li>)}
                    </ul>
                    {mayAsk && asking !== a.id && (
                      askedIds.has(a.id) ? (
                        <span className="small muted">You asked this mentor.</span>
                      ) : (
                        <button type="button" className="btn btn-small" disabled={a.mentor.slots_left === 0} onClick={() => { setAsking(a.id); setSentTo(null); }}>
                          Ask for mentoring
                        </button>
                      )
                    )}
                    {asking === a.id && (
                      <AskMentor
                        me={me}
                        mentorId={a.id}
                        name={a.display_name}
                        onCancel={() => setAsking(null)}
                        onSent={() => { setAsking(null); setSentTo(a.display_name); onAsked(); }}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {list.data && <Pager page={page} perPage={list.data.per_page} total={list.data.total} onPage={setPage} />}
    </section>
  );
}
