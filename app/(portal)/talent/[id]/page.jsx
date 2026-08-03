'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BadgeCheck, ExternalLink, GraduationCap, LoaderCircle, ShieldCheck, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import { fetchTalentProject } from '@/lib/api';

export default function TalentProjectPage() {
  const params = useParams();
  const id = params?.id;
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    fetchTalentProject(id)
      .then((body) => body.project)
      .then((next) => { if (!cancelled) setProject(next); })
      .catch((loadError) => { if (!cancelled) setError(loadError.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return <div className="mx-auto max-w-3xl space-y-5"><Link href="/talent" className="inline-flex items-center gap-2 text-sm font-semibold text-crimson hover:underline"><ArrowLeft className="h-4 w-4" /> Back to talent showcase</Link><div className="surface p-8" role="alert"><h1 className="font-heading text-xl font-semibold">Showcase unavailable</h1><p className="mt-2 text-sm text-muted">{error}</p></div></div>;
  }

  if (!project) return <div className="surface flex items-center justify-center gap-2 p-10 text-sm text-muted" role="status"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading full showcase…</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fadeIn">
      <Link href="/talent" className="inline-flex items-center gap-2 text-sm font-semibold text-crimson hover:underline"><ArrowLeft className="h-4 w-4" /> Back to talent showcase</Link>
      <header className="surface space-y-5 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={project.student.name} src={project.student.avatarUrl} size={64} className="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">Approved public showcase</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold text-[#1d1d1f] sm:text-3xl">{project.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted"><span className="font-semibold text-[#1d1d1f]">{project.student.name}</span><span aria-hidden="true">·</span><span>{project.student.programme}</span><span aria-hidden="true">·</span><span>{project.student.faculty?.name}</span></p>
          </div>
          <span className="badge-pill inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> QIU approved</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted"><span className="badge-pill inline-flex items-center gap-1 border border-black/10 bg-black/[0.03]"><GraduationCap className="h-3.5 w-3.5 text-crimson" /> {project.student.courseCode || 'QIU student showcase'}</span>{project.reviewedAt ? <span className="badge-pill border border-black/10 bg-black/[0.03]">Reviewed {new Date(project.reviewedAt).toLocaleDateString()}</span> : null}</div>
      </header>

      <section className="surface space-y-3 p-6 sm:p-8"><h2 className="font-heading text-xl font-semibold">Project brief</h2><p className="whitespace-pre-line text-sm leading-7 text-[#424245]">{project.abstract}</p>{project.supervisorName ? <p className="text-sm text-muted"><span className="font-semibold text-[#1d1d1f]">Academic supervisor:</span> {project.supervisorName}</p> : null}</section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="surface space-y-3 p-6"><h2 className="flex items-center gap-2 font-heading text-base font-semibold"><Wrench className="h-4 w-4 text-crimson" /> Verified skills</h2>{project.student.verifiedSkills.length ? <div className="flex flex-wrap gap-2">{project.student.verifiedSkills.map((skill) => <span key={skill} className="badge-pill border border-crimson/20 bg-crimson/5 text-crimson">{skill}</span>)}</div> : <p className="text-sm text-muted">No verified skill tags are published for this showcase.</p>}{project.student.badges.length ? <div className="flex flex-wrap gap-2 pt-2">{project.student.badges.map((badge) => <span key={badge.title} className="badge-pill inline-flex items-center gap-1 border border-amber-200 bg-amber-50 text-amber-700"><BadgeCheck className="h-3.5 w-3.5" />{badge.title}</span>)}</div> : null}</section>
        <section className="surface space-y-3 p-6"><h2 className="font-heading text-base font-semibold">Project links</h2>{project.repositoryUrl || project.liveUrl ? <div className="flex flex-wrap gap-3">{project.repositoryUrl ? <a href={project.repositoryUrl} target="_blank" rel="noreferrer" className="secondary-btn text-xs"><ExternalLink className="h-3.5 w-3.5" /> Repository</a> : null}{project.liveUrl ? <a href={project.liveUrl} target="_blank" rel="noreferrer" className="crimson-btn text-xs"><ExternalLink className="h-3.5 w-3.5" /> Live demo</a> : null}</div> : <p className="text-sm text-muted">No external project link was published.</p>}<p className="pt-2 text-xs leading-relaxed text-muted">This page only shows information the student chose to publish and QIU approved. Employers and alumni can send a structured invitation from the opportunities workspace.</p></section>
      </div>
    </div>
  );
}
