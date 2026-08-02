'use client';

import { CheckCircle2, Circle, Hourglass, Layers, Sparkles, Trophy } from 'lucide-react';
import { courseById, pathProgress } from '@/lib/data/courses';
import { gradientFor } from './CourseCard';

const STEP_ICON = {
  VERIFIED: CheckCircle2,
  PENDING: Hourglass,
  AVAILABLE: Circle,
};

const STEP_TEXT = {
  VERIFIED: 'Verified',
  PENDING: 'Pending',
  AVAILABLE: 'Not started',
};

const STEP_CLASS = {
  VERIFIED: 'text-emerald-700',
  PENDING: 'text-amber-800',
  AVAILABLE: 'text-muted',
};

/**
 * A CPDC-curated bundle of 3-5 courses with visible progress.
 *
 * Progress is derived from the same per-course status map the catalogue uses,
 * so a certificate verified in the catalogue immediately advances every path
 * that contains it — one record, many views.
 */
export default function PathCard({ path, statusById, recommended = false, onSelectCourse }) {
  const progress = pathProgress(path, statusById);

  return (
    <div className="surface p-6 space-y-4 flex flex-col justify-between">
      <div className="space-y-3">
        <div className={`flex h-28 items-end rounded-[18px] p-4 text-white ${gradientFor(path.theme)}`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Learning path</p>
            <p className="mt-1 font-heading text-lg font-bold leading-tight">{path.title}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="badge-pill border border-black/10 bg-black/[0.03] text-muted">
            {path.courses.length} courses
          </span>
          <span className="text-xs font-semibold text-muted whitespace-nowrap">+{path.bonusXp} XP bonus</span>
        </div>

        {recommended && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-crimson px-3 py-1.5 text-xs font-bold text-white">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Recommended for you</span>
          </span>
        )}

        <div className="space-y-1.5">
          <p className="text-xs text-muted">Curated by <span className="font-medium text-[#6e6e73]">{path.curator}</span></p>
          <p className="text-xs leading-relaxed text-muted">{path.blurb}</p>
        </div>

        {/* Progress through the path */}
        <div className="space-y-2 rounded-[18px] border border-black/[0.06] bg-black/[0.03] p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-muted">
            <span>Path progress</span>
            <span>{progress.verified} of {progress.total} verified · {progress.percent}%</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]"
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${path.title} progress`}
          >
            <div className="h-full rounded-full bg-crimson transition-all" style={{ width: `${progress.percent}%` }} />
          </div>

          <ol className="space-y-1.5 pt-1">
            {path.courses.map((courseId, index) => {
              const course = courseById(courseId);
              if (!course) return null;
              const status = statusById[courseId] ?? 'AVAILABLE';
              const Icon = STEP_ICON[status];
              return (
                <li key={courseId}>
                  <button
                    type="button"
                    onClick={() => onSelectCourse?.(course)}
                    className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2 text-left text-xs transition hover:bg-black/[0.03]"
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${STEP_CLASS[status]}`} aria-hidden="true" />
                    <span className="flex-1 truncate text-[#1d1d1f]">{index + 1}. {course.title}</span>
                    <span className={`whitespace-nowrap font-semibold ${STEP_CLASS[status]}`}>{STEP_TEXT[status]}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="border-t border-black/10 pt-4">
        {progress.complete ? (
          <div className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-50/60 px-3 text-xs font-semibold text-emerald-700">
            <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Path complete — +{path.bonusXp} XP bonus awarded</span>
          </div>
        ) : (
          <div className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.02] px-3 text-xs font-semibold text-muted">
            <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {progress.total - progress.verified} course{progress.total - progress.verified === 1 ? '' : 's'} to go
              {progress.pending > 0 ? ` · ${progress.pending} awaiting verification` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
