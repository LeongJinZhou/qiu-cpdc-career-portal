// CPDC writes a career path: programme, target role, skills and ordered steps. Steps keep their ids (and ticks).
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { apiWrite } from '../api';
import { Notice, Spinner, errorText } from '../ui/parts';
import { draftOf, pathProblem, type CareerPath, type Overview, type PathDraft } from './types';

export function PathEditor({
  path,
  programme,
  programmes,
  csrf,
  onSaved,
  onClose,
}: {
  path: CareerPath | null;
  programme: string;
  programmes: string[];
  csrf: string;
  onSaved: (overview: Overview | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PathDraft>(() => draftOf(path, programme));
  const [skill, setSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const change = (next: PathDraft) => {
    setDraft(next);
    setProblem(null);
  };
  const setStep = (i: number, patch: Partial<PathDraft['steps'][number]>) =>
    change({ ...draft, steps: draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, by: number) => {
    const steps = [...draft.steps];
    const [step] = steps.splice(i, 1);
    steps.splice(i + by, 0, step);
    change({ ...draft, steps });
  };
  const addSkill = () => {
    const name = skill.trim();
    if (name && !draft.skills.some((s) => s.toLowerCase() === name.toLowerCase()) && draft.skills.length < 30) {
      change({ ...draft, skills: [...draft.skills, name] });
    }
    setSkill('');
  };
  const onSkillKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkill();
    }
  };

  async function run(work: () => Promise<Overview | null>) {
    setSaving(true);
    try {
      onSaved(await work());
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = pathProblem(draft);
    if (found) {
      setProblem(found);
      return;
    }
    const body = {
      programme: draft.programme.trim(),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      skills: draft.skills,
      steps: draft.steps.map((s) => (s.id ? { id: s.id, title: s.title.trim(), detail: s.detail.trim() } : { title: s.title.trim(), detail: s.detail.trim() })),
    };
    void run(() => apiWrite<Overview>(path ? 'PUT' : 'POST', path ? `/api/career-paths/${path.id}` : '/api/career-paths', body, csrf));
  }

  return (
    <form className="panel panel-pad stack" onSubmit={submit} noValidate>
      <h2>{path ? 'Edit career path' : 'New career path'}</h2>
      <div className="cp-grid">
        <div className="field">
          <label htmlFor="cp-prog">Programme</label>
          <input id="cp-prog" className="input" list="cp-programmes" maxLength={200} value={draft.programme} onChange={(e) => change({ ...draft, programme: e.target.value })} placeholder="Bachelor of Computer Science" />
          <datalist id="cp-programmes">
            {programmes.map((p) => <option key={p} value={p} />)}
          </datalist>
          <span className="hint">Students see the paths of the programme in their profile.</span>
        </div>
        <div className="field">
          <label htmlFor="cp-title">Target role</label>
          <input id="cp-title" className="input" maxLength={200} value={draft.title} onChange={(e) => change({ ...draft, title: e.target.value })} placeholder="Data Analyst" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="cp-summary">What the role is</label>
        <textarea id="cp-summary" className="textarea" rows={2} maxLength={2000} value={draft.summary} onChange={(e) => change({ ...draft, summary: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="cp-skill">Skills the role needs</label>
        <div className="row">
          <input id="cp-skill" className="input" maxLength={80} value={skill} onChange={(e) => setSkill(e.target.value)} onKeyDown={onSkillKey} placeholder="Type a skill, press Enter" />
          <button type="button" className="btn btn-small" onClick={addSkill}>Add</button>
        </div>
        {draft.skills.length > 0 && (
          <ul className="cp-chips">
            {draft.skills.map((s) => (
              <li key={s}>
                {s}
                <button type="button" onClick={() => change({ ...draft, skills: draft.skills.filter((x) => x !== s) })} aria-label={`Remove ${s}`}>
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <fieldset className="cp-fieldset">
        <legend className="label">Steps, in order</legend>
        {draft.steps.map((step, i) => (
          <div key={step.id ?? `new-${i}`} className="cp-step-edit">
            <span className="cp-step-no num" aria-hidden="true">{i + 1}</span>
            <div className="stack cp-grow">
              <div className="field">
                <label htmlFor={`cp-st-${i}`}>Step {i + 1}</label>
                <input id={`cp-st-${i}`} className="input" maxLength={200} value={step.title} onChange={(e) => setStep(i, { title: e.target.value })} placeholder="Finish a data internship" />
              </div>
              <div className="field">
                <label htmlFor={`cp-sd-${i}`}>How (optional)</label>
                <input id={`cp-sd-${i}`} className="input" maxLength={1000} value={step.detail} onChange={(e) => setStep(i, { detail: e.target.value })} />
              </div>
            </div>
            <div className="cp-step-tools">
              <button type="button" className="btn btn-quiet btn-small" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move step ${i + 1} up`}><ArrowUp size={15} aria-hidden="true" /></button>
              <button type="button" className="btn btn-quiet btn-small" disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)} aria-label={`Move step ${i + 1} down`}><ArrowDown size={15} aria-hidden="true" /></button>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => change({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })} aria-label={`Remove step ${i + 1}`}><Trash2 size={15} aria-hidden="true" /></button>
            </div>
          </div>
        ))}
        {draft.steps.length < 30 && (
          <button type="button" className="btn btn-small cp-add" onClick={() => change({ ...draft, steps: [...draft.steps, { title: '', detail: '' }] })}>
            <Plus size={15} aria-hidden="true" /> Add step
          </button>
        )}
      </fieldset>
      {problem && <Notice tone="error">{problem}</Notice>}
      <div className="row cp-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && <Spinner size={14} />}
          {path ? 'Save path' : 'Publish path'}
        </button>
        <button type="button" className="btn" onClick={onClose} disabled={saving}>Back</button>
        {path && (confirmDelete ? (
          <span className="row">
            <span className="small">Delete it and everyone's ticks?</span>
            <button type="button" className="btn btn-small" disabled={saving} onClick={() => void run(() => apiWrite('DELETE', `/api/career-paths/${path.id}`, undefined, csrf).then(() => null))}>Yes, delete</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirmDelete(false)}>No</button>
          </span>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(true)}>Delete path</button>
        ))}
      </div>
    </form>
  );
}
