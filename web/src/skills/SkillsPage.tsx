// Skills diagnostics: rate yourself per area (kept over time), see progress, and the gap against a chosen job.
import { Gauge, Target } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiGet, apiWrite, useLoad } from '../api';
import type { Me } from '../auth';
import { dateLabel } from '../profile/types';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, Notice, SkeletonLines, Spinner, errorText } from '../ui/parts';
import { LEVEL_LABEL, LevelPips } from './LevelPips';
import type { Assessment, GapView, SkillArea } from './types';
import '../jobs/jobs.css';
import './skills.css';

interface SkillsData {
  areas: SkillArea[];
  history: Assessment[];
  jobs: { id: number; title: string; employer_name: string }[];
}

export function SkillsPage({ me }: { me: Me }) {
  const load = useLoad('skills', () => apiGet<SkillsData>('/api/skills'));
  const [history, setHistory] = useState<Assessment[] | null>(null);
  // A job chosen on the Jobs page ("Compare with my skills") arrives as ?job=<id>.
  const [jobId, setJobId] = useState(() => new URLSearchParams(window.location.search).get('job') ?? '');

  if (load.error && !load.data) {
    return (
      <>
        <PageHead title="Skills" />
        <LoadError error={load.error} onRetry={load.reload} />
      </>
    );
  }
  if (!load.data) return <SkeletonLines lines={8} />;
  const { areas, jobs } = load.data;
  const past = history ?? load.data.history;

  return (
    <>
      <PageHead title="Skills">
        Rate yourself honestly in each area. Each rating is kept, so you and CPDC can see how you grow, and you can
        compare yourself with what a job asks for.
      </PageHead>
      <div className="skills-grid">
        <RateForm key={past[0]?.id ?? 'first'} me={me} areas={areas} latest={past[0] ?? null} justSaved={history !== null} onSaved={setHistory} />
        <div className="stack">
          <section className="panel panel-pad stack" aria-labelledby="gap-h">
            <h2 id="gap-h">Compare with a job</h2>
            {jobs.length === 0 ? (
              <Empty icon={Target} title="No job to compare with yet">Open jobs that list the skills they need appear here.</Empty>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="gap-job">Job</label>
                  <select id="gap-job" className="select" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                    <option value="">Choose a job</option>
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} · {j.employer_name}</option>)}
                  </select>
                </div>
                {jobId && jobs.some((j) => String(j.id) === jobId) && (
                  <GapPanel key={`${jobId}-${past[0]?.id ?? 0}`} jobId={Number(jobId)} rated={past.length > 0} />
                )}
              </>
            )}
          </section>
          <Progress areas={areas} history={past} />
        </div>
      </div>
    </>
  );
}

function RateForm({
  me,
  areas,
  latest,
  justSaved,
  onSaved,
}: {
  me: Me;
  areas: SkillArea[];
  latest: Assessment | null;
  justSaved: boolean;
  onSaved: (history: Assessment[]) => void;
}) {
  const [levels, setLevels] = useState<Record<number, number>>(() =>
    Object.fromEntries(areas.map((a) => [a.id, latest?.ratings[String(a.id)] ?? 0])),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const missing = areas.filter((a) => !levels[a.id]).length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const ratings = areas.filter((a) => levels[a.id]).map((a) => ({ area_id: a.id, level: levels[a.id] }));
      const saved = await apiWrite<{ history: Assessment[] }>('POST', '/api/skills/assessments', { ratings }, me.csrf_token);
      onSaved(saved.history);
    } catch (failure) {
      setMessage({ tone: 'error', text: errorText(failure) });
      setBusy(false);
    }
  }

  return (
    <form className="panel panel-pad stack" onSubmit={submit} aria-labelledby="rate-h">
      <div>
        <h2 id="rate-h">Rate yourself</h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          1 Beginner · 2 Basic · 3 Good · 4 Strong · 5 Expert.
          {latest ? ` Your last rating, from ${dateLabel(latest.created_at)}, is filled in.` : ''}
        </p>
      </div>
      {justSaved && <div className="saved-pop"><Notice tone="ok">Your rating is saved. Rate again any time to track your growth.</Notice></div>}
      <div className="rate-list">
        {areas.map((area) => (
          <fieldset key={area.id} className="rate-row">
            <legend>
              <strong>{area.name}</strong>
              <span className="small muted">{area.description}</span>
            </legend>
            <div className="scale" role="radiogroup" aria-label={`${area.name} level`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="scale-step" title={LEVEL_LABEL[n]}>
                  <input
                    type="radio"
                    name={`area-${area.id}`}
                    value={n}
                    checked={levels[area.id] === n}
                    onChange={() => setLevels((l) => ({ ...l, [area.id]: n }))}
                  />
                  <span>{n}</span>
                  <span className="visually-hidden">{LEVEL_LABEL[n]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy || missing === areas.length}>
          {busy && <Spinner />}Save my rating
        </button>
        {missing > 0 && missing < areas.length && <span className="small muted">{missing} not rated yet: they are left out.</span>}
      </div>
    </form>
  );
}

function GapPanel({ jobId, rated }: { jobId: number; rated: boolean }) {
  const load = useLoad(`gap:${jobId}`, () => apiGet<GapView>(`/api/skills/gap/${jobId}`));
  if (load.error) return <LoadError error={load.error} onRetry={load.reload} />;
  if (!load.data) return <SkeletonLines lines={3} />;
  const { rows, met, total } = load.data;

  return (
    <div className="stack" style={{ gap: 12 }}>
      {!rated && <Notice tone="info">Rate yourself first: every area counts as not rated until you do.</Notice>}
      <p className="gap-summary">
        <strong className="num">{met} of {total}</strong> skills at the level this job asks for.
      </p>
      <ul className="gap-list">
        {rows.map((row) => (
          <li key={row.area_id} data-gap={row.gap > 0}>
            <span className="gap-name">{row.name}</span>
            <span className="gap-bars">
              <span><span className="small muted">Asked</span> <LevelPips level={row.required} tone="need" /></span>
              <span><span className="small muted">You</span> <LevelPips level={row.mine} /></span>
            </span>
            <span className="gap-text">
              {row.gap === 0 ? 'On track' : `${row.gap} level${row.gap === 1 ? '' : 's'} to go`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Progress({ areas, history }: { areas: SkillArea[]; history: Assessment[] }) {
  const columns = history.slice(0, 4).reverse(); // oldest of the last four on the left
  return (
    <section className="panel panel-pad" aria-labelledby="prog-h">
      <h2 id="prog-h" style={{ marginBottom: 12 }}>Your progress</h2>
      {history.length < 2 ? (
        <Empty icon={Gauge} title={history.length === 0 ? 'No rating yet' : 'One rating so far'}>
          Rate yourself again after a course, an internship or a semester to see how you have grown.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Area</th>
                {columns.map((c) => <th key={c.id} className="num">{dateLabel(c.created_at)}</th>)}
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  {columns.map((c) => <td key={c.id} className="num">{c.ratings[String(a.id)] ?? '-'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
