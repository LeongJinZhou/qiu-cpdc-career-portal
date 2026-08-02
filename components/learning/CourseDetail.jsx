'use client';

import { useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  Clock,
  BarChart3,
  User,
  Building2,
  Search,
  CheckCircle2,
  Target,
  Sparkles,
} from 'lucide-react';
import { PROVIDERS, courseCredit, courseLink } from '@/lib/data/courses';
import DismissibleDialog from '@/components/ui/DismissibleDialog';

/**
 * Full course detail.
 *
 * The catalogue cards answer "what is this?"; a student deciding whether to
 * spend six weeks on something needs "who teaches it, how much work is it,
 * what will I be able to do afterwards, and where do I actually enrol?".
 * That was the gap — the module could show a course but not open one.
 *
 * Two honesty rules are visible in the UI rather than buried:
 *   - a link is labelled "Open on X" only when we hold the real course URL;
 *     otherwise it is plainly a provider search.
 *   - outcomes are marked as CPDC's expectations, not scraped syllabus text.
 */
export default function CourseDetail({ course, score, why, recommended, xpValue, status, onSubmit, onClose }) {
  const closeRef = useRef(null);

  // Focus the close control on open and restore Escape-to-dismiss: this is a
  // modal, so keyboard users must be able to leave it without a mouse.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!course) return null;

  const link = courseLink(course);
  const credit = courseCredit(course);
  const providerLabel = PROVIDERS[course.provider]?.label ?? course.provider;
  const xp = xpValue ?? course.xp;

  return (
    <DismissibleDialog
      onClose={onClose}
      labelledBy="course-detail-title"
      className="surface max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none rounded-t-[24px] sm:rounded-[24px]"
    >
        <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] p-5 sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge-pill bg-black/[0.06] text-[#1d1d1f]">{providerLabel}</span>
              <span className="badge-pill bg-black/[0.03] text-muted">{course.level}</span>
              {recommended && (
                <span className="badge-pill inline-flex items-center gap-1 bg-crimson/10 text-crimson">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Recommended for you
                </span>
              )}
            </div>
            <h2 id="course-detail-title" className="mt-2 font-heading text-xl font-bold leading-snug sm:text-2xl">
              {course.title}
            </h2>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close course details"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-muted hover:bg-black/[0.04] hover:text-[#1d1d1f]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-[#424245]">{course.summary}</p>

          {/* Facts a student weighs before committing. */}
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Fact
              icon={credit.kind === 'instructor' ? User : Building2}
              label={credit.kind === 'instructor' ? 'Taught by' : 'Published by'}
              value={credit.name}
              hint={credit.kind === 'instructor' ? `Published by ${credit.publishedBy}` : null}
            />
            <Fact icon={Clock} label="Typical effort" value={course.effort} hint={course.duration} />
            <Fact icon={BarChart3} label="Level" value={course.level} hint={course.prerequisite} />
            <Fact icon={Sparkles} label="Earns" value={`${xp} XP`} hint={`Badge: ${course.skillBadge}`} />
          </dl>

          {why && (
            <div className="rounded-[16px] border border-crimson/20 bg-crimson/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-crimson">
                Why you are seeing this{typeof score === 'number' ? ` · ${score}% match` : ''}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#424245]">{why}</p>
            </div>
          )}

          {Array.isArray(course.outcomes) && course.outcomes.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
                <Target className="h-4 w-4 text-crimson" aria-hidden="true" />
                What CPDC expects you to be able to do
              </h3>
              <p className="mt-1 text-xs text-muted">
                Written by CPDC for QIU students — not the provider&rsquo;s syllabus.
              </p>
              <ul className="mt-3 space-y-2">
                {course.outcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#424245]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            {course.tags.map((tag) => (
              <span key={tag} className="badge-pill bg-black/[0.04] text-muted">{tag}</span>
            ))}
          </div>
        </div>

        {/* Actions pinned at the end of the sheet, thumb-reachable on a phone. */}
        <div className="flex flex-col gap-3 border-t border-black/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          {link && (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="secondary-btn min-h-[44px] justify-center"
            >
              {link.exact ? (
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              {link.label}
              {/* Say plainly when this is a search rather than the course page. */}
              {!link.exact && <span className="sr-only"> (opens a provider search)</span>}
            </a>
          )}

          {onSubmit && status !== 'VERIFIED' && (
            <button
              type="button"
              onClick={() => onSubmit(course)}
              className="crimson-btn min-h-[44px] justify-center"
            >
              Log my completion
            </button>
          )}
        </div>
    </DismissibleDialog>
  );
}

function Fact({ icon: Icon, label, value, hint }) {
  if (!value) return null;
  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-black/[0.02] p-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[#1d1d1f]">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
