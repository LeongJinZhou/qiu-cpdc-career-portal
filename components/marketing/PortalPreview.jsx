'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Bot,
  Calendar,
  Check,
  Clock,
  FileText,
  LayoutDashboard,
  QrCode,
  Sparkles,
} from 'lucide-react';

/**
 * An in-page mock of the student portal, used as the hero's visual anchor.
 *
 * It is explicitly labelled a sample view: everything inside is illustrative
 * interface, not university data. Nothing here claims an outcome, a rate or a
 * partner — it shows the shape of the product.
 *
 * The tabs auto-advance so the hero has motion, but they are real buttons: a
 * visitor can steer it, and hovering or focusing pauses the rotation so the
 * thing does not slide out from under a pointer. Reduced-motion visitors get a
 * static first view they can still click through.
 */

const VIEWS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    title: 'Next best actions',
    render: () => (
      <>
        <div className="rounded-[14px] border border-black/[0.06] bg-[#fbfbfd] p-3.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-crimson">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Career XP
            </span>
            <span className="font-semibold text-[#1d1d1f]">Silver tier</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
            <div className="h-full w-[58%] rounded-full bg-crimson" />
          </div>
          <p className="mt-2 text-[10px] text-muted">Progress toward the next tier</p>
        </div>
        <ul className="mt-3 space-y-2">
          {[
            'Log this week’s placement hours',
            'Book the CV clinic workshop',
            'Add your FYP abstract',
          ].map((item) => (
            <li
              key={item}
              className="flex items-center gap-2.5 rounded-[12px] border border-black/[0.06] bg-white px-3 py-2.5 text-[11px] text-[#424245]"
            >
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-black/15" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'logbook',
    label: 'Logbook',
    icon: BookOpen,
    title: 'Fieldwork sign-off',
    render: () => (
      <ul className="space-y-2.5">
        {[
          { name: 'Ward rotation entry', state: 'Approved', done: true },
          { name: 'Community attachment', state: 'Awaiting supervisor', done: false },
          { name: 'Lab session log', state: 'Approved', done: true },
        ].map((row) => (
          <li
            key={row.name}
            className="flex items-center justify-between gap-3 rounded-[12px] border border-black/[0.06] bg-white px-3 py-3"
          >
            <span className="truncate text-[11px] font-medium text-[#1d1d1f]">{row.name}</span>
            <span
              className={`badge-pill inline-flex flex-shrink-0 items-center gap-1 text-[9px] ${
                row.done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {row.done ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : <Clock className="h-2.5 w-2.5" aria-hidden="true" />}
              {row.state}
            </span>
          </li>
        ))}
        <li className="rounded-[12px] border border-dashed border-black/[0.12] px-3 py-3 text-[10px] text-muted">
          Supervisors approve by magic link — no account needed.
        </li>
      </ul>
    ),
  },
  {
    id: 'workshops',
    label: 'Workshops',
    icon: Calendar,
    title: 'Matched sessions',
    render: () => (
      <ul className="space-y-2.5">
        {['Interview practice clinic', 'Portfolio & LinkedIn lab', 'Industry panel briefing'].map(
          (name) => (
            <li
              key={name}
              className="flex items-center justify-between gap-3 rounded-[12px] border border-black/[0.06] bg-white px-3 py-3"
            >
              <span className="truncate text-[11px] font-medium text-[#1d1d1f]">{name}</span>
              <span className="badge-pill inline-flex flex-shrink-0 items-center gap-1 bg-crimson/10 text-[9px] text-crimson">
                <QrCode className="h-2.5 w-2.5" aria-hidden="true" />
                QR check-in
              </span>
            </li>
          )
        )}
        <li className="rounded-[12px] border border-dashed border-black/[0.12] px-3 py-3 text-[10px] text-muted">
          Matched to your programme and year of study.
        </li>
      </ul>
    ),
  },
  {
    id: 'cv',
    label: 'My CV',
    icon: FileText,
    title: 'Built from verified records',
    render: () => (
      <div className="rounded-[14px] border border-black/[0.06] bg-white p-3.5">
        <div className="h-2 w-24 rounded-full bg-[#1d1d1f]" aria-hidden="true" />
        <div className="mt-1.5 h-1.5 w-16 rounded-full bg-black/15" aria-hidden="true" />
        <div className="mt-4 space-y-3">
          {['Placements & fieldwork', 'Workshops & certificates', 'Final year project'].map(
            (section) => (
              <div key={section}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-crimson">
                  {section}
                </p>
                <div className="mt-1.5 space-y-1.5" aria-hidden="true">
                  <div className="h-1.5 w-full rounded-full bg-black/[0.08]" />
                  <div className="h-1.5 w-4/5 rounded-full bg-black/[0.08]" />
                </div>
              </div>
            )
          )}
        </div>
        <p className="mt-4 text-[10px] text-muted">Exports as an ATS-friendly PDF.</p>
      </div>
    ),
  },
];

const RAIL = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Logbook', icon: BookOpen },
  { label: 'Workshops', icon: Calendar },
  { label: 'My CV', icon: FileText },
  { label: 'Interview Practice', icon: Bot },
];

export default function PortalPreview() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    try {
      reducedRef.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    } catch {
      reducedRef.current = false;
    }
    if (reducedRef.current || paused) return undefined;

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % VIEWS.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [paused]);

  const view = VIEWS[active];

  return (
    <div
      className="relative w-full max-w-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="surface overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.10)]">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-black/[0.06] bg-[#fbfbfd] px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-black/[0.14]" />
            <span className="h-2 w-2 rounded-full bg-black/[0.14]" />
            <span className="h-2 w-2 rounded-full bg-black/[0.14]" />
          </span>
          <span className="mx-auto rounded-full bg-black/[0.05] px-3 py-1 text-[10px] text-muted">
            careerhub.qiu.edu.my
          </span>
          <span className="badge-pill bg-black/[0.05] text-[9px] text-muted">Sample view</span>
        </div>

        <div className="flex">
          {/* Module rail */}
          <div className="hidden w-32 flex-shrink-0 border-r border-black/[0.06] bg-white py-3 sm:block">
            {RAIL.map((item) => {
              const Icon = item.icon;
              const isActive = item.label === view.label;
              return (
                <div
                  key={item.label}
                  className={`mx-2 mb-1 flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-[10px] transition-colors ${
                    isActive ? 'bg-crimson font-semibold text-white' : 'text-muted'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>

          {/* Panel */}
          <div className="min-w-0 flex-1 bg-canvas p-4">
            <p className="font-heading text-sm font-semibold text-[#1d1d1f]">{view.title}</p>
            <div key={view.id} className="qiu-fade-up mt-3">
              {view.render()}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — real controls, and the pause target for the auto-rotation. */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Portal preview">
        {VIEWS.map((item, index) => {
          const Icon = item.icon;
          const isActive = index === active;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActive(index)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-crimson bg-crimson text-white'
                  : 'border-black/10 bg-white text-muted hover:text-[#1d1d1f]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
