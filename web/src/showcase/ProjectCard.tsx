// A project as staff see it in the talent feed, and in full on its own page.
import { ExternalLink, FolderGit2, ImageOff, MonitorPlay } from 'lucide-react';
import type { MouseEvent } from 'react';
import { PersonName } from '../ui/parts';
import type { Project } from './types';

export function ProjectCard({ project, onOpen }: { project: Project; onOpen?: (id: number) => void }) {
  const open = (event: MouseEvent) => {
    if (!onOpen || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    onOpen(project.id);
  };
  return (
    <article className="sc-card">
      <a className="sc-card-image" href={`/showcase/${project.id}`} onClick={open} tabIndex={-1} aria-hidden="true">
        {project.image_url ? <img src={project.image_url} alt="" loading="lazy" /> : <ImageOff size={26} />}
      </a>
      <div className="sc-card-body">
        <h3>
          <a href={`/showcase/${project.id}`} onClick={open}>
            {project.title}
          </a>
        </h3>
        <p className="sc-clamp small muted">{project.summary}</p>
        <Tags tech={project.tech} />
        <div className="sc-card-foot">
          <PersonName name={project.student.display_name} linkedinUrl={project.student.linkedin_url} photo={project.student.picture_url} size={26} />
          <span className="small muted num">{project.project_year}</span>
        </div>
      </div>
    </article>
  );
}

export function Tags({ tech }: { tech: string[] }) {
  if (tech.length === 0) return null;
  return (
    <ul className="sc-tags" aria-label="Technologies">
      {tech.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function ProjectFull({ project }: { project: Project }) {
  return (
    <article className="panel sc-full">
      {project.image_url && <img className="sc-full-image" src={project.image_url} alt={`Picture of ${project.title}`} />}
      <div className="panel-pad stack">
        <div>
          <h1>{project.title}</h1>
          <p className="muted small">
            {[project.faculty, `Final-year project ${project.project_year}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <PersonName name={project.student.display_name} linkedinUrl={project.student.linkedin_url} photo={project.student.picture_url} />
        <p className="lb-text">{project.summary}</p>
        <Tags tech={project.tech} />
        {(project.repo_url || project.demo_url) && (
          <div className="row">
            {project.repo_url && (
              <a className="btn btn-small" href={project.repo_url} target="_blank" rel="noopener noreferrer">
                <FolderGit2 size={15} aria-hidden="true" /> Code <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
            {project.demo_url && (
              <a className="btn btn-small" href={project.demo_url} target="_blank" rel="noopener noreferrer">
                <MonitorPlay size={15} aria-hidden="true" /> Demo <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
