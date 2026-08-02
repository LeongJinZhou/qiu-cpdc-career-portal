'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Route,
  CalendarCheck,
  FileText,
  BookOpen,
  Users,
  Building2,
  ShieldCheck,
  GraduationCap,
  Settings,
  LayoutDashboard,
  Bot,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  X,
} from 'lucide-react';
import { usePortal } from '@/components/portal/PortalProvider';
import { ROLE_LABELS, tourStepsForRole } from '@/lib/data/guides';

/**
 * The first-login walkthrough.
 *
 * Shown once per role, the first time someone lands in the portal, then never
 * again unless they ask for it from Help. The content is role-specific: a
 * Registrar is walked through clearance evidence, not a student's XP bar, so
 * the tour is useful rather than something to click past.
 *
 * Steps live in lib/data/guides.js alongside the written guides, so the words
 * a new user meets on day one and the words in the manual cannot drift apart.
 * Every browser global is touched after mount, so this renders safely on the
 * server.
 */

const SEEN_KEY = 'qiu.tour.seen';

/**
 * Icons by step id. Keyed here rather than in the content data so guides.js
 * stays plain, copy-editable data with no React imports in it.
 */
const STEP_ICONS = {
  welcome: Sparkles,
  dashboard: LayoutDashboard,
  workshops: CalendarCheck,
  logbook: BookOpen,
  cv: FileText,
  network: Users,
  talent: Users,
  employers: Building2,
  vacancy: Building2,
  process: ShieldCheck,
  admin: ClipboardCheck,
  learning: GraduationCap,
  fyp: Route,
  settings: Settings,
  audit: ShieldCheck,
  'ai-suite': Bot,
};

export default function OnboardingTour() {
  const { currentRole } = usePortal();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  const steps = useMemo(() => tourStepsForRole(currentRole), [currentRole]);
  const roleLabel = ROLE_LABELS[currentRole] ?? 'your account';

  const safeIndex = Math.min(index, steps.length - 1);
  const step = steps[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === steps.length - 1;
  const Icon = STEP_ICONS[step?.id] ?? Sparkles;

  // Remember that this role has seen its tour, so it never auto-opens again.
  const markSeen = useCallback(() => {
    try {
      window.localStorage?.setItem(`${SEEN_KEY}.${currentRole}`, '1');
    } catch {
      // Private browsing or storage disabled — worst case the tour reappears.
    }
  }, [currentRole]);

  const openTour = useCallback(() => {
    setIndex(0);
    setExpanded(false);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    markSeen();
  }, [markSeen]);

  // Auto-open on a role's first visit, respect reduced motion, and let Help
  // replay the tour on demand.
  useEffect(() => {
    try {
      setReducedMotion(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    } catch {
      // matchMedia unavailable — assume motion is acceptable.
    }

    try {
      if (window.localStorage?.getItem(`${SEEN_KEY}.${currentRole}`) !== '1') {
        openTour();
      }
    } catch {
      // Cannot read storage — skip auto-open rather than risk showing it forever.
    }

    const replay = () => openTour();
    window.addEventListener('qiu:start-tour', replay);
    return () => window.removeEventListener('qiu:start-tour', replay);
  }, [openTour, currentRole]);

  // Collapse the extra detail whenever the step changes.
  useEffect(() => {
    setExpanded(false);
  }, [safeIndex]);

  // Escape closes, Tab stays inside the dialog, and focus returns where it came
  // from — so a keyboard user is never stranded behind the overlay.
  useEffect(() => {
    if (!open) {
      previousFocus.current?.focus?.();
      previousFocus.current = null;
      return undefined;
    }
    previousFocus.current = document.activeElement;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || !step) return null;

  const next = () => (isLast ? close() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));
  const transition = reducedMotion ? '' : 'transition';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-summary"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`surface max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto p-6 outline-none sm:p-8 ${
          reducedMotion ? '' : 'animate-fadeIn'
        }`}
      >
        {/* Where am I in this, and how do I leave? */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted tabular-nums">
            Step {safeIndex + 1} of {steps.length} · {roleLabel}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close the walkthrough"
            className={`-mr-1.5 rounded-full p-2.5 text-muted hover:bg-black/[0.03] hover:text-[#1d1d1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/30 ${transition}`}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center text-center">
          <span className="rounded-2xl bg-crimson/10 p-3.5 text-crimson">
            <Icon aria-hidden="true" className="h-7 w-7" />
          </span>
          <h2 id="tour-title" className="mt-4 font-heading text-xl font-bold text-[#1d1d1f]">
            {step.title}
          </h2>
          <p id="tour-summary" className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {step.summary}
          </p>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls="tour-detail"
            className={`mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-crimson hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/30 ${transition}`}
          >
            {expanded ? 'Show less' : 'Tell me more'}
            <ChevronDown
              aria-hidden="true"
              className={`h-3.5 w-3.5 ${transition} ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
          {expanded && (
            <div
              id="tour-detail"
              className={`mt-2 w-full rounded-[14px] border border-black/10 bg-black/[0.03] p-4 text-left ${
                reducedMotion ? '' : 'animate-fadeIn'
              }`}
            >
              <p className="text-sm leading-relaxed text-[#424245]">{step.detail}</p>
            </div>
          )}

          {step.href && (
            <Link
              href={step.href}
              onClick={close}
              className="secondary-btn mt-4 inline-flex min-h-[44px] items-center"
            >
              Take me there now
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Progress. The step count above carries the same information in words,
            so this never has to be read from colour alone. */}
        <div className="mt-6 flex items-center justify-center gap-2" aria-hidden="true">
          {steps.map((item, i) => (
            <span
              key={item.id}
              className={`h-1.5 rounded-full ${transition} ${
                i === safeIndex ? 'w-6 bg-crimson' : 'w-1.5 bg-black/15'
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            disabled={isFirst}
            className={`secondary-btn min-h-[44px] ${isFirst ? 'invisible' : ''}`}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Back
          </button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button type="button" onClick={close} className="secondary-btn min-h-[44px]">
                Skip
              </button>
            )}
            <button type="button" onClick={next} className="crimson-btn min-h-[44px]">
              {isLast ? 'Done' : 'Next'}
              {!isLast && <ChevronRight aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          You can see this again at any time from Help in the menu.
        </p>
      </div>
    </div>
  );
}
