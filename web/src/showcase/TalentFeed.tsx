// Staff and CPDC: published final-year projects, filtered by technology, faculty and year; one project in full.
import { ArrowLeft, Search, Sparkles } from 'lucide-react';
import { useState, type FormEvent, type MouseEvent } from 'react';
import { apiGet, useLoad, type Paged } from '../api';
import { Pager } from '../admin/Pager';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, SkeletonLines } from '../ui/parts';
import { ProjectCard, ProjectFull } from './ProjectCard';
import type { Filters, Project } from './types';
import '../logbook/logbook.css';
import './showcase.css';

const NONE = { q: '', tech: '', faculty: '', year: '' };

export function TalentFeed({ go }: { go: (to: string) => void }) {
  const [draft, setDraft] = useState(NONE);
  const [filters, setFilters] = useState(NONE);
  const [page, setPage] = useState(1);
  const query = { ...filters, page, per_page: 24 };
  const list = useLoad(`feed:${JSON.stringify(query)}`, () => apiGet<Paged<Project>>('/api/showcase', query), 'feed');
  const options = useLoad('feed-filters', () => apiGet<Filters>('/api/showcase/filters'));

  const apply = (next: typeof NONE) => {
    setDraft(next);
    setFilters(next);
    setPage(1);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply(draft);
  };
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHead title="Talent feed">Final-year projects QIU students have published. Names open their LinkedIn.</PageHead>
      <form className="panel panel-pad toolbar" onSubmit={submit} style={{ marginBottom: 16 }}>
        <div className="field" style={{ flex: '2 1 220px' }}>
          <label htmlFor="tf-q">Search</label>
          <input id="tf-q" className="input" placeholder="Title, summary or student" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="tf-faculty">Faculty</label>
          <select id="tf-faculty" className="select" value={draft.faculty} onChange={(e) => apply({ ...draft, faculty: e.target.value })}>
            <option value="">All</option>
            {options.data?.faculties.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '0 1 120px' }}>
          <label htmlFor="tf-year">Year</label>
          <select id="tf-year" className="select" value={draft.year} onChange={(e) => apply({ ...draft, year: e.target.value })}>
            <option value="">All</option>
            {options.data?.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          <Search size={16} aria-hidden="true" /> Show
        </button>
        {options.data && options.data.tech.length > 0 && (
          <div className="sc-tech-filter" role="group" aria-label="Technology">
            {options.data.tech.slice(0, 16).map(({ tech, count }) => (
              <button
                key={tech}
                type="button"
                className="sc-chip"
                aria-pressed={filters.tech === tech}
                onClick={() => apply({ ...draft, tech: filters.tech === tech ? '' : tech })}
              >
                {tech} <span className="num">{count}</span>
              </button>
            ))}
          </div>
        )}
      </form>
      {list.error && <LoadError error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <SkeletonLines lines={5} />}
      {list.data && list.data.items.length === 0 && (
        <div className="panel">
          <Empty icon={Sparkles} title={filtered ? 'No project matches' : 'No projects published yet'}>
            {filtered ? (
              <button type="button" className="btn btn-small" onClick={() => apply(NONE)}>
                Clear filters
              </button>
            ) : (
              'Students publish theirs from "My project".'
            )}
          </Empty>
        </div>
      )}
      {list.data && list.data.items.length > 0 && (
        <div className="sc-grid" aria-busy={list.loading}>
          {list.data.items.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={(id) => go(`/showcase/${id}`)} />
          ))}
        </div>
      )}
      {list.data && list.data.total > list.data.per_page && (
        <Pager page={page} perPage={list.data.per_page} total={list.data.total} onPage={setPage} />
      )}
    </>
  );
}

export function ProjectPage({ id, go }: { id: number; go: (to: string) => void }) {
  const load = useLoad(`project:${id}`, () => apiGet<Project>(`/api/showcase/${id}`));
  const back = (event: MouseEvent) => {
    event.preventDefault();
    go('/showcase');
  };
  return (
    <div className="sc-page">
      <a className="back-link" href="/showcase" onClick={back}>
        <ArrowLeft size={16} aria-hidden="true" /> Talent feed
      </a>
      {load.error && <LoadError error={load.error} onRetry={load.reload} />}
      {!load.data && !load.error && <SkeletonLines lines={6} />}
      {load.data && <ProjectFull project={load.data} />}
    </div>
  );
}
