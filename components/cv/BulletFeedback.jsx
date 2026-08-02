'use client';

import { AlertTriangle, CheckCircle2, OctagonAlert, WandSparkles } from 'lucide-react';

// Same red / amber / green scale the diagnostics module uses, so a student who
// has seen one recognises the other. Severity is never carried by colour alone:
// every row also has an icon and a word.
const TONES = {
  emerald: {
    icon: CheckCircle2,
    text: 'text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    rail: 'border-emerald-400',
  },
  amber: {
    icon: AlertTriangle,
    text: 'text-amber-700',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    rail: 'border-amber-400',
  },
  rose: {
    icon: OctagonAlert,
    text: 'text-rose-700',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
    rail: 'border-rose-400',
  },
};

export function toneClasses(tone) {
  return TONES[tone] ?? TONES.amber;
}

/**
 * Inline verdict for a single line of the resume.
 *
 * Rendered directly beneath the field it belongs to and sharing its left
 * margin — the blueprint is explicit that this must not be a modal wall of
 * text.
 */
export default function BulletFeedback({ result, onApply }) {
  if (!result) return null;

  const tone = toneClasses(result.severity.tone);
  const Icon = tone.icon;

  return (
    <div
      className={`mt-2 border-l-[3px] pl-3 ${tone.rail}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge-pill border text-[11px] ${tone.chip}`}>
          <Icon className="h-3 w-3" aria-hidden="true" />
          {result.severity.label}
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-muted">
          Clarity {result.score}%
          {result.projectedScore != null && result.projectedScore > result.score && (
            <span className="text-emerald-700"> → {result.projectedScore}% with the rewrite</span>
          )}
        </span>
      </div>

      <div className="mt-1.5 h-1.5 w-full max-w-[220px] rounded-full bg-black/[0.06]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
          style={{ width: `${Math.max(6, result.score)}%` }}
        />
      </div>

      <ul className="mt-2 space-y-1.5">
        {result.findings.map((finding) => {
          const findingTone = toneClasses(finding.tone);
          const FindingIcon = findingTone.icon;
          return (
            <li key={finding.id} className={`flex gap-2 text-[11px] leading-snug ${findingTone.text}`}>
              <FindingIcon className="mt-[1px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-semibold">{finding.label}</span>
                <span className="text-[#424245]"> — {finding.message}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {result.suggestion && (
        <div className="mt-2.5 rounded-[14px] border border-black/10 bg-black/[0.025] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Suggested rewrite</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#1d1d1f]">{result.suggestion}</p>
          <p className="mt-1.5 text-[10px] text-muted">
            Square brackets are yours to fill in — the checker will not invent numbers for you. The
            projected score assumes you replace them.
          </p>
          {onApply && (
            <button
              type="button"
              onClick={() => onApply(result.suggestion)}
              className="secondary-btn mt-2.5 min-h-[44px] w-full justify-center text-[11px] sm:min-h-0 sm:w-auto sm:py-2"
            >
              <WandSparkles className="h-3.5 w-3.5" />
              Use this rewrite
            </button>
          )}
        </div>
      )}
    </div>
  );
}
