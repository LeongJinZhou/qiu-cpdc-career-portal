// The student's final-year project: write it, add a picture, publish it to the talent feed.
import { Eye, EyeOff, ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiGet, apiUpload, apiWrite, useLoad } from '../api';
import type { Me } from '../auth';
import { PageHead } from '../shell/Shell';
import { errorText, LoadError, Notice, SkeletonLines, Spinner } from '../ui/parts';
import { ProjectFull } from './ProjectCard';
import { IMAGE_MAX_BYTES, IMAGE_TYPES, parseTags, type Project } from './types';
import '../logbook/logbook.css';
import './showcase.css';

interface Draft {
  title: string;
  summary: string;
  tech: string;
  project_year: string;
  repo_url: string;
  demo_url: string;
}

function toDraft(p: Project | null): Draft {
  return {
    title: p?.title ?? '',
    summary: p?.summary ?? '',
    tech: p?.tech.join(', ') ?? '',
    project_year: String(p?.project_year ?? new Date().getFullYear()),
    repo_url: p?.repo_url ?? '',
    demo_url: p?.demo_url ?? '',
  };
}

export function MyProject({ me }: { me: Me }) {
  const load = useLoad('showcase-mine', () => apiGet<{ project: Project | null }>('/api/showcase/mine'));
  const [fresh, setFresh] = useState<Project | null | undefined>(undefined);
  const project = fresh !== undefined ? fresh : load.data?.project;

  if (load.error && project === undefined) return <LoadError error={load.error} onRetry={load.reload} />;
  if (project === undefined) return <SkeletonLines lines={6} />;
  return <Editor me={me} project={project} onSaved={setFresh} />;
}

function Editor({ me, project, onSaved }: { me: Me; project: Project | null; onSaved: (p: Project) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(project));
  const [busy, setBusy] = useState<'save' | 'publish' | 'image' | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const save = (published: boolean) => (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(published === project?.published ? 'save' : 'publish');
    setNote(null);
    const body = { ...draft, tech: parseTags(draft.tech), project_year: Number(draft.project_year), published };
    apiWrite<{ project: Project }>('PUT', '/api/showcase/mine', body, me.csrf_token)
      .then(
        ({ project: saved }) => {
          onSaved(saved);
          setNote({ tone: 'ok', text: saved.published ? 'Published. Staff and CPDC can find it in the talent feed.' : 'Saved. Only you can see it.' });
        },
        (error: unknown) => setNote({ tone: 'error', text: errorText(error) }),
      )
      .finally(() => setBusy(null));
  };

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setNote({ tone: 'error', text: 'Use a PNG, JPEG or WebP image.' });
    if (file.size > IMAGE_MAX_BYTES) return setNote({ tone: 'error', text: 'The image must be 2 MB or smaller.' });
    setBusy('image');
    setNote(null);
    apiUpload<{ project: Project }>('/api/showcase/mine/image', 'file', file, me.csrf_token)
      .then(({ project: saved }) => onSaved(saved), (error: unknown) => setNote({ tone: 'error', text: errorText(error) }))
      .finally(() => setBusy(null));
  };
  const removeImage = () => {
    setBusy('image');
    apiWrite<{ project: Project }>('DELETE', '/api/showcase/mine/image', undefined, me.csrf_token)
      .then(({ project: saved }) => onSaved(saved), (error: unknown) => setNote({ tone: 'error', text: errorText(error) }))
      .finally(() => setBusy(null));
  };

  const set = (key: keyof Draft) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft({ ...draft, [key]: e.target.value });
  const ready = draft.title.trim().length >= 3 && draft.summary.trim().length >= 20;
  const published = project?.published ?? false;

  return (
    <>
      <PageHead title="My final-year project">
        Show what you built. Once published, QIU staff and CPDC find it in the talent feed with your LinkedIn.
      </PageHead>
      <div className="lb-grid">
        <form className="panel panel-pad stack" onSubmit={save(published)} noValidate aria-label="Project details">
          <div className="section-head">
            <h2>Details</h2>
            {project && <span className={published ? 'badge badge-ok' : 'badge'}>{published ? 'Published' : 'Draft'}</span>}
          </div>
          <div className="field">
            <label htmlFor="sc-title">Title</label>
            <input id="sc-title" className="input" maxLength={160} value={draft.title} onChange={set('title')} />
          </div>
          <div className="field">
            <label htmlFor="sc-summary">Summary</label>
            <textarea id="sc-summary" className="textarea" rows={6} maxLength={3000} value={draft.summary} onChange={set('summary')} aria-describedby="sc-summary-hint" />
            <span id="sc-summary-hint" className="hint">The problem, what you built and the result. At least 20 characters.</span>
          </div>
          <div className="grid-2 sc-fields">
            <div className="field">
              <label htmlFor="sc-tech">Technologies</label>
              <input id="sc-tech" className="input" value={draft.tech} onChange={set('tech')} aria-describedby="sc-tech-hint" />
              <span id="sc-tech-hint" className="hint">Separate with commas, up to 12.</span>
            </div>
            <div className="field">
              <label htmlFor="sc-year">Year</label>
              <input id="sc-year" className="input num" type="number" inputMode="numeric" min={1990} max={2100} value={draft.project_year} onChange={set('project_year')} />
            </div>
            <div className="field">
              <label htmlFor="sc-repo">Code link (optional)</label>
              <input id="sc-repo" className="input" type="url" placeholder="https://github.com/..." value={draft.repo_url} onChange={set('repo_url')} />
            </div>
            <div className="field">
              <label htmlFor="sc-demo">Demo link (optional)</label>
              <input id="sc-demo" className="input" type="url" placeholder="https://..." value={draft.demo_url} onChange={set('demo_url')} />
            </div>
          </div>
          {note && <Notice tone={note.tone}>{note.text}</Notice>}
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={busy !== null || !ready}>
              {busy === 'save' && <Spinner />} Save
            </button>
            <button type="button" className="btn" disabled={busy !== null || !ready} onClick={() => save(!published)()}>
              {busy === 'publish' ? <Spinner /> : published ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              {published ? 'Unpublish' : 'Save and publish'}
            </button>
          </div>
        </form>

        <aside className="side-stack">
          <section className="panel panel-pad stack" aria-labelledby="sc-picture">
            <h2 id="sc-picture" className="lb-side-title">Picture</h2>
            {project?.image_url ? (
              <img className="sc-thumb" src={project.image_url} alt="Your project picture" />
            ) : (
              <p className="small muted">A screenshot or photo makes the project stand out. PNG, JPEG or WebP, up to 2 MB.</p>
            )}
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="visually-hidden" id="sc-file" onChange={upload} disabled={!project || busy !== null} />
            <div className="row">
              <button type="button" className="btn btn-small" disabled={!project || busy !== null} onClick={() => fileInput.current?.click()}>
                {busy === 'image' ? <Spinner /> : <ImagePlus size={15} aria-hidden="true" />} {project?.image_url ? 'Replace picture' : 'Add picture'}
              </button>
              {project?.image_url && (
                <button type="button" className="btn btn-small btn-quiet" disabled={busy !== null} onClick={removeImage}>
                  <Trash2 size={15} aria-hidden="true" /> Remove
                </button>
              )}
            </div>
            {!project && <span className="small muted">Save the details first.</span>}
          </section>
        </aside>
      </div>
      {project && (
        <section className="sc-preview" aria-label="How staff see it">
          <h2 className="lb-side-title">How staff see it</h2>
          <ProjectFull project={project} />
        </section>
      )}
    </>
  );
}
