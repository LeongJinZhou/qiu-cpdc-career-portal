'use client';

import { Award, CheckCircle2, Clock, ExternalLink, GraduationCap, Hourglass, Signal, Sparkles, UploadCloud } from 'lucide-react';
import { PROVIDERS } from '@/lib/data/courses';

/**
 * Gradient "thumbnails".
 *
 * External course artwork is not hotlinked: the platforms' images live on hosts
 * next/image is not configured for, and mirroring their marketing assets is not
 * ours to do. A themed gradient plate carrying the skill badge gives the card
 * the same visual weight at the same aspect ratio.
 *
 * Full class strings (not interpolated fragments) so Tailwind's scanner keeps
 * them.
 */
export const THEME_GRADIENTS = {
  crimson: 'bg-gradient-to-br from-crimson to-rose-900',
  slate: 'bg-gradient-to-br from-slate-700 to-slate-950',
  emerald: 'bg-gradient-to-br from-emerald-600 to-teal-950',
  indigo: 'bg-gradient-to-br from-indigo-600 to-indigo-950',
  sky: 'bg-gradient-to-br from-sky-600 to-slate-900',
  amber: 'bg-gradient-to-br from-amber-500 to-amber-900',
};

export function gradientFor(theme) {
  return THEME_GRADIENTS[theme] ?? THEME_GRADIENTS.slate;
}

/**
 * Status chrome. Every state pairs a colour with an icon and a word, so the
 * meaning survives for a colour-blind reader or a greyscale print.
 */
const STATUS = {
  VERIFIED: {
    label: 'Verified — badge, CV line and XP granted',
    short: 'Verified',
    icon: CheckCircle2,
    className: 'bg-emerald-50/60 border-emerald-500/30 text-emerald-700',
  },
  PENDING: {
    label: 'Pending verification by CPDC',
    short: 'Pending verification',
    icon: Hourglass,
    className: 'bg-amber-50/70 border-amber-500/30 text-amber-800',
  },
};

export default function CourseCard({
  course,
  status = 'AVAILABLE',
  score,
  why,
  recommended = false,
  xpValue,
  evidence,
  onSubmit,
  onOpen,
  actionLabel,
}) {
  const providerLabel = PROVIDERS[course.provider]?.label ?? course.provider;
  const state = STATUS[status];
  const StateIcon = state?.icon;
  const xp = xpValue ?? course.xp;

  return (
    <div className="surface surface-interactive relative p-6 space-y-4 flex flex-col justify-between">
      <div className="space-y-3">
        {/* Thumbnail plate — same h-28 rounded plate the workshop hub uses. */}
        <div className={`flex h-28 items-end rounded-[18px] p-4 text-white ${gradientFor(course.theme)}`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">{providerLabel}</p>
            <p className="mt-1 font-heading text-lg font-bold leading-tight">{course.skillBadge}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="badge-pill bg-black/[0.03] text-muted border border-black/10">
            {providerLabel}
          </span>
          <span className="text-xs font-semibold text-muted whitespace-nowrap">+{xp} XP</span>
        </div>

        {recommended && (
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-crimson px-3 py-1.5 text-xs font-bold text-white">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Recommended for you{typeof score === 'number' ? ` · ${score}% match` : ''}</span>
            </span>
            {why && <p className="text-xs leading-relaxed text-crimson">{why}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <h3 className="font-heading text-lg font-semibold leading-snug text-[#1d1d1f]">{course.title}</h3>
          <p className="text-xs text-muted">
            Taught by <span className="font-medium text-[#6e6e73]">{course.taughtBy}</span>
          </p>
          <p className="text-xs leading-relaxed text-muted">{course.summary}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-black/[0.06] bg-black/[0.03] p-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{course.duration}</span>
          </div>
          <div className="flex items-center gap-2">
            <Signal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{course.level}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {course.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-black/[0.03] px-2.5 py-1 text-[10px] font-medium text-muted">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Footer — button placement mirrors the workshop card. */}
      <div className="space-y-3 border-t border-black/10 pt-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Skill badge</span>
          <span className="font-semibold text-[#6e6e73]">{course.skillBadge}</span>
        </div>

        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="secondary-btn min-h-[44px] w-full justify-center text-xs"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span>View full course details</span>
          </button>
        )}

        {state ? (
          <div className="space-y-2">
            <div className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold ${state.className}`}>
              <StateIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{state.label}</span>
            </div>
            {evidence?.type === 'link' && (
              <a
                href={evidence.value}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1 text-[11px] font-medium text-muted transition hover:text-[#1d1d1f]"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                <span>View submitted credential</span>
              </a>
            )}
            {evidence?.type === 'file' && (
              <p className="text-center text-[11px] font-medium text-muted">Attached: {evidence.value}</p>
            )}
          </div>
        ) : onSubmit ? (
          <button
            type="button"
            onClick={() => onSubmit(course)}
            className="crimson-btn min-h-[44px] w-full justify-center text-xs"
          >
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            <span>{actionLabel ?? 'Submit certificate'}</span>
          </button>
        ) : (
          <div className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.02] px-3 text-xs font-semibold text-muted">
            <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Listed in the CPDC catalogue</span>
          </div>
        )}

        {status === 'VERIFIED' && (
          <p className="flex items-center justify-center gap-1 text-[11px] font-medium text-muted">
            <Award className="h-3 w-3" aria-hidden="true" />
            <span>Added to your Auto-CV</span>
          </p>
        )}
      </div>
    </div>
  );
}
