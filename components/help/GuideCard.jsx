'use client';

import Link from 'next/link';
import { ChevronDown, ArrowRight, Info } from 'lucide-react';

/**
 * One task guide, shown as an expandable card.
 *
 * Collapsed it answers "is this the thing I want?"; expanded it gives numbered
 * steps and says what happens afterwards. The steps are a real <ol> so screen
 * readers announce "step 3 of 5" without us faking it, and the open/closed
 * state is conveyed by the word "Steps" and aria-expanded rather than by the
 * chevron's colour alone.
 */
export default function GuideCard({ guide, isOpen, onToggle }) {
  const panelId = `guide-panel-${guide.id}`;
  const headingId = `guide-heading-${guide.id}`;

  return (
    <article className="surface overflow-hidden">
      <h3 id={headingId}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full min-h-[44px] items-start gap-3 p-4 text-left transition hover:bg-black/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/30 sm:p-5"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-[15px] font-semibold text-[#1d1d1f]">
              {guide.title}
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-muted">{guide.summary}</span>
          </span>
          <span className="mt-0.5 flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted">
            <span className="hidden sm:inline">{isOpen ? 'Hide steps' : 'Steps'}</span>
            <ChevronDown
              aria-hidden="true"
              className={`h-5 w-5 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
            />
          </span>
        </button>
      </h3>

      {isOpen && (
        <div id={panelId} role="region" aria-labelledby={headingId} className="px-4 pb-5 sm:px-5">
          <ol className="space-y-3 rounded-[14px] border border-black/10 bg-black/[0.02] p-4">
            {guide.steps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-[#424245]">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#1d1d1f] ring-1 ring-black/10"
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          {guide.result && (
            <p className="mt-3 flex gap-2.5 rounded-[14px] border border-black/10 bg-white p-4 text-sm leading-relaxed text-[#424245]">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
              <span>
                <span className="font-semibold text-[#1d1d1f]">What happens next: </span>
                {guide.result}
              </span>
            </p>
          )}

          {guide.href && (
            <Link
              href={guide.href}
              className="secondary-btn mt-4 inline-flex min-h-[44px] items-center"
            >
              {guide.hrefLabel ?? 'Open this screen'}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
