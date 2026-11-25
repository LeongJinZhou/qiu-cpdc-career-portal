// Career path: target roles for a programme, the skills they need (marked when the profile lists them) and the
// steps toward them, which the person ticks. CPDC writes the paths.
import { Check, Pencil, Plus, Route } from 'lucide-react';
import { useState } from 'react';
import { apiGet, apiWrite, useLoad } from '../api';
import { can, type Me } from '../auth';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, Notice, SkeletonLines, errorText } from '../ui/parts';
import { PathEditor } from './PathEditor';
import type { CareerPath, Overview } from './types';
import './careerpath.css';

type Editing = { path: CareerPath | null } | null;

export function CareerPathPage({ me, go }: { me: Me; go: (to: string) => void }) {
  const manager = can(me, 'careerpath.manage');
  const [asked, setAsked] = useState<string | undefined>(undefined);
  const load = useLoad(`career-paths-${asked ?? ''}`, () => apiGet<Overview>('/api/career-paths', { programme: asked }), 'career-paths');
  const [fresh, setFresh] = useState<Overview | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const data = fresh ?? load.data;

  if (editing) {
    return (
      <PathEditor
        path={editing.path}
        programme={data?.programme ?? data?.my_programme ?? ''}
        programmes={data?.programmes ?? []}
        csrf={me.csrf_token}
        onClose={() => setEditing(null)}
        onSaved={(overview) => {
          setEditing(null);
          if (overview) {
            setFresh(overview);
            setAsked(overview.programme ?? undefined);
          } else {
            setFresh(null);
            load.reload();
          }
        }}
      />
    );
  }

  async function tick(step: number, done: boolean) {
    if (!data) return;
    setError(null);
    const mark = (value: boolean): Overview => ({
      ...data,
      paths: data.paths.map((p) => {
        const steps = p.steps.map((s) => (s.id === step ? { ...s, done: value } : s));
        return { ...p, steps, done_count: steps.filter((s) => s.done).length };
      }),
    });
    setFresh(mark(done));
    try {
      await apiWrite('PUT', `/api/career-paths/steps/${step}`, { done }, me.csrf_token);
    } catch (e) {
      setFresh(mark(!done));
      setError(errorText(e));
    }
  }

  return (
    <>
      <PageHead
        title="Career path"
        actions={manager && (
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ path: null })}>
            <Plus size={17} aria-hidden="true" /> New path
          </button>
        )}
      >
        Roles graduates of your programme go into, the skills they need and the steps to get there. Tick what you have done.
      </PageHead>
      {load.error && !data && <LoadError error={load.error} onRetry={load.reload} />}
      {!data && !load.error && <div className="panel panel-pad"><SkeletonLines lines={5} /></div>}
      {data && (
        <>
          {data.programmes.length > 0 && (
            <div className="cp-bar">
              <div className="field">
                <label htmlFor="cp-pick">Programme</label>
                <select
                  id="cp-pick"
                  className="select"
                  value={data.programme ?? ''}
                  onChange={(e) => { setFresh(null); setAsked(e.target.value); }}
                >
                  {data.programmes.map((p) => <option key={p} value={p}>{p}{p === data.my_programme ? ' (yours)' : ''}</option>)}
                </select>
              </div>
              {!data.my_programme && (
                <p className="small muted">
                  Add your programme on <a href="/profile" onClick={(e) => { e.preventDefault(); go('/profile'); }}>My profile</a> to open your own paths first.
                </p>
              )}
            </div>
          )}
          {error && <div className="cp-gap"><Notice tone="error">{error}</Notice></div>}
          {data.paths.length === 0 ? (
            <div className="panel panel-pad">
              <Empty icon={Route} title="No career paths yet">
                {manager ? 'Write the first one with New path.' : 'CPDC adds career paths for each programme. Check back soon.'}
              </Empty>
            </div>
          ) : (
            <div className="cp-list" aria-busy={load.loading}>
              {data.paths.map((path) => (
                <PathCard key={path.id} path={path} manager={manager} onTick={tick} onEdit={() => setEditing({ path })} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function PathCard({ path, manager, onTick, onEdit }: { path: CareerPath; manager: boolean; onTick: (step: number, done: boolean) => void; onEdit: () => void }) {
  const percent = path.step_count === 0 ? 0 : Math.round((path.done_count / path.step_count) * 100);
  const have = path.skills.filter((s) => s.have).length;
  return (
    <article className="panel panel-pad cp-card" aria-labelledby={`cp-${path.id}`}>
      <header className="cp-card-head">
        <div>
          <h2 id={`cp-${path.id}`}>{path.title}</h2>
          {path.summary && <p className="muted cp-summary">{path.summary}</p>}
        </div>
        {manager && (
          <button type="button" className="btn btn-quiet btn-small" onClick={onEdit} aria-label={`Edit ${path.title}`}>
            <Pencil size={15} aria-hidden="true" /> Edit
          </button>
        )}
      </header>
      {path.step_count > 0 && (
        <div className="cp-progress">
          <div className="cp-meter" role="progressbar" aria-valuemin={0} aria-valuemax={path.step_count} aria-valuenow={path.done_count} aria-label={`${path.title} progress`}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <span className="small num">{path.done_count} of {path.step_count} steps done</span>
        </div>
      )}
      {path.skills.length > 0 && (
        <section aria-label="Skills">
          <h3 className="cp-h3">Skills <span className="small muted num">you list {have} of {path.skills.length}</span></h3>
          <ul className="cp-skills">
            {path.skills.map((s) => (
              <li key={s.name} className={s.have ? 'have' : undefined}>
                {s.have && <Check size={13} aria-hidden="true" />}
                {s.name}
                {s.have && <span className="visually-hidden"> (in your profile)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {path.steps.length > 0 && (
        <ol className="cp-steps">
          {path.steps.map((step) => (
            <li key={step.id} className={step.done ? 'done' : undefined}>
              <label className="check">
                <input type="checkbox" checked={step.done} onChange={(e) => onTick(step.id, e.target.checked)} />
                <span>
                  <span className="cp-step-title">{step.title}</span>
                  {step.detail && <span className="small muted cp-step-detail">{step.detail}</span>}
                </span>
              </label>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
