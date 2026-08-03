'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * One accessible expand/collapse primitive for the whole portal.
 *
 * It exists so that collapsing is consistent rather than re-invented per
 * module: same keyboard behaviour, same ARIA wiring, same chevron, same
 * remembered state. Nine modules each rolling their own `useState(false)` is
 * how a portal ends up feeling like nine different products.
 *
 * Three rules this component encodes, because they are what makes collapsing
 * help rather than hurt:
 *
 *  1. **Never collapse the primary action.** `defaultOpen` is the caller's
 *     decision, and the pathway/next-step surfaces pass `defaultOpen` so a
 *     student never has to hunt for what to do next. Collapsing is for
 *     supporting detail, not for the thing the page is FOR.
 *  2. **The summary must stand alone.** A collapsed section still shows its
 *     title, a count, and a status, so a student can decide whether to open it
 *     without opening it. A row that says only "Details ▸" is a worse
 *     experience than no collapsing at all.
 *  3. **State persists.** A student who collapses "Completed milestones"
 *     should not find it expanded again on their next visit. Persistence is
 *     localStorage-backed and per-key.
 *
 * Content is kept mounted and hidden with the `hidden` attribute rather than
 * unmounted. That preserves scroll position and in-progress form state, and it
 * keeps the content findable by the browser's own Ctrl+F.
 */

const STORAGE_PREFIX = 'qiu.disclosure.';

function readPersisted(key) {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? null : raw === '1';
  } catch {
    // Private mode / storage disabled. Fall back to the default.
    return null;
  }
}

function persist(key, open) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, open ? '1' : '0');
  } catch {
    // Not being able to remember a preference is not worth an error.
  }
}

export default function Disclosure({
  title,
  /** Short status shown on the collapsed row: a count, "3 pending", a date. */
  summary = null,
  /** Optional lucide icon component rendered before the title. */
  icon: Icon = null,
  /** Rendered at the right of the header, before the chevron (e.g. a badge). */
  badge = null,
  defaultOpen = false,
  /** Stable key to remember this section's state. Omit to not persist. */
  persistKey = null,
  /** Visual weight. 'section' is a full card; 'inline' is a lighter divider. */
  variant = 'section',
  className = '',
  children,
}) {
  const contentId = useId();
  const [open, setOpen] = useState(defaultOpen);

  // Read persisted state after mount only. Reading localStorage during render
  // would desynchronise the server and client HTML and trigger a hydration
  // mismatch, so the first paint is always `defaultOpen`.
  useEffect(() => {
    const saved = readPersisted(persistKey);
    if (saved !== null) setOpen(saved);
  }, [persistKey]);

  const toggle = useCallback(() => {
    setOpen((previous) => {
      const next = !previous;
      persist(persistKey, next);
      return next;
    });
  }, [persistKey]);

  const isSection = variant === 'section';

  return (
    <div
      className={`${
        isSection
          ? 'rounded-[18px] border border-black/10 bg-white/60'
          : 'border-b border-black/10 last:border-b-0'
      } ${className}`}
    >
      <h3 className="m-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          className={`flex min-h-[52px] w-full items-center justify-between gap-3 text-left ${
            isSection ? 'px-4 py-3 sm:px-5' : 'py-3'
          }`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {Icon ? <Icon className="h-4 w-4 flex-shrink-0 text-crimson" aria-hidden="true" /> : null}
            <span className="min-w-0">
              <span className="block truncate font-heading text-sm font-semibold text-[#1d1d1f]">
                {title}
              </span>
              {/* The collapsed summary. Present whether open or closed so the
                  row does not change height on toggle, which would make the
                  page jump under the student's cursor. */}
              {summary ? (
                <span className="mt-0.5 block truncate text-xs text-muted">{summary}</span>
              ) : null}
            </span>
          </span>

          <span className="flex flex-shrink-0 items-center gap-2">
            {badge}
            {/* Text, not just a rotating chevron: meaning is never carried by
                a visual affordance alone. Hidden from screen readers because
                aria-expanded already announces the state. */}
            <span className="hidden text-xs font-medium text-muted sm:inline" aria-hidden="true">
              {open ? 'Hide' : 'Show'}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </span>
        </button>
      </h3>

      <div
        id={contentId}
        hidden={!open}
        className={isSection ? 'border-t border-black/10 px-4 py-4 sm:px-5' : 'pb-4'}
      >
        {children}
      </div>
    </div>
  );
}
