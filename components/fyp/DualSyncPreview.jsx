import React from 'react';
import { FileText, CheckCircle2, Globe2, Lock, Eye, GraduationCap, Wrench, Link2 } from 'lucide-react';

/**
 * The point of the module: once a poster or guided entry has enough
 * information, this shows the two places it will land — the student's
 * Auto-CV, always, and the public QIU Talent Showcase, only if opted in.
 */
export default function DualSyncPreview({
  student,
  activeFaculty,
  title,
  summary,
  techStack,
  supervisor,
  posterPreviewUrl,
  isPdf,
  publicOptIn,
  onTogglePublicOptIn,
}) {
  const displayTitle = title || 'Untitled Final Year Project';
  const displaySupervisor = supervisor || 'Supervisor not yet specified';
  const techList = techStack
    ? techStack.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-6">

      {/* Auto-CV Sync Preview */}
      <div className="surface p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-black/10 pb-3">
          <h3 className="font-heading font-semibold text-sm text-[#1d1d1f] flex items-center gap-2">
            <FileText className="w-4 h-4 text-crimson" />
            <span>Auto-CV Sync</span>
          </h3>
          <span className="text-emerald-600 text-[10px] flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Always Synced
          </span>
        </div>
        <p className="text-xs text-muted">
          This becomes a verified capstone entry on your CV automatically — no opt-in needed, only visible to you until you export it.
        </p>

        {/* Mini printable-style preview, echoing the Auto-CV Engine's paper card */}
        <div className="rounded-[14px] bg-white text-slate-900 p-4 space-y-2 border border-slate-200">
          <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1">
            Final Year Project
          </h4>
          <div className="text-xs space-y-1">
            <p className="font-bold text-slate-900">{displayTitle}</p>
            <p className="text-[10px] text-slate-600">
              {student.programme} • {activeFaculty.name} • Supervisor: {displaySupervisor}
            </p>
            {summary && <p className="text-[10.5px] text-slate-700 leading-relaxed line-clamp-3">{summary}</p>}
            {techList.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {techList.map((t) => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QIU Talent Showcase Preview + opt-in */}
      <div className="surface p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-black/10 pb-3">
          <h3 className="font-heading font-semibold text-sm text-[#1d1d1f] flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-crimson" />
            <span>QIU Talent Showcase</span>
          </h3>
          <span
            className={`text-[10px] flex items-center gap-1 font-semibold ${publicOptIn ? 'text-emerald-600' : 'text-muted'}`}
          >
            {publicOptIn ? <Eye className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {publicOptIn ? 'Visible to Employers' : 'Private'}
          </span>
        </div>

        {/* Opt-in toggle — defaults off, plain-language explanation of consequence */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-[18px] bg-black/[0.03] border border-black/[0.06]">
          <div className="pr-2">
            <p className="text-xs font-semibold text-[#424245]">Show this project publicly on the Talent Showcase</p>
            <p className="text-[11px] text-muted mt-1 leading-relaxed">
              If switched on, employers and alumni browsing QIU Talent Showcase will be able to see your project title,
              abstract, tech stack, supervisor name, and poster — plus your name and programme.
              Your logbook, CV contact details and the raw data in this form stay private either way. Off by default; you can
              turn it off again at any time.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={publicOptIn}
            aria-label="Show this project publicly on the QIU Talent Showcase"
            onClick={onTogglePublicOptIn}
            className={`relative flex-shrink-0 w-14 h-8 rounded-full transition-colors duration-200 ${
              publicOptIn ? 'bg-crimson' : 'bg-black/[0.08]'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                publicOptIn ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {publicOptIn ? (
          <div className="rounded-[18px] overflow-hidden border border-crimson/30 bg-gradient-to-b from-crimson/10 to-transparent">
            {posterPreviewUrl && !isPdf && (
              // A local object URL for a file the student just picked. next/image
              // optimises assets it can fetch and cache — a blob: URL is neither,
              // so the plain tag is correct here, not a shortcut.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterPreviewUrl} alt="" className="w-full h-36 object-cover" />
            )}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{student.name} • {student.programme}</span>
              </div>
              <h4 className="font-heading font-semibold text-sm text-[#1d1d1f]">{displayTitle}</h4>
              {summary && <p className="text-xs text-muted line-clamp-2">{summary}</p>}
              {techList.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <Wrench className="w-3 h-3 text-muted" />
                  {techList.map((t) => (
                    <span key={t} className="badge-pill bg-black/[0.03] text-muted border border-black/10">{t}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-muted pt-1">
                <Link2 className="w-3 h-3" />
                <span>Repository / demo links shown if provided</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted italic px-1">
            Nothing has been published. Turn the toggle on to preview your public Talent Showcase card.
          </p>
        )}
      </div>
    </div>
  );
}
