'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Map,
  Target,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  Zap,
  Lock,
  AlertTriangle,
  Sparkles,
  Flag,
  Loader2,
  Award,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import { careerPathFor, milestoneId } from '@/lib/data/roadmaps';
import Disclosure from '@/components/ui/Disclosure';
import {
  fetchLifecycleStatus,
  fetchMilestoneCompletions,
  refreshLifecycleStatus,
  toggleMilestone,
} from '@/lib/api';

/**
 * Year-by-Year Career Path (Blueprint Module 7).
 *
 * A single vertical timeline from Year 1 to Final Year, scoped to the student's
 * active faculty. The student's current year is expanded and highlighted; other
 * years collapse but expand in place. Self-reported progress is loaded from
 * the database and is kept distinct from verified evidence.
 */

const clampYear = (year) => Math.min(4, Math.max(1, Number(year) || 1));

export default function CareerPath({ student, activeFaculty }) {
  const currentYear = clampYear(student?.year);
  const facultyId = activeFaculty?.id;
  const path = useMemo(
    () => careerPathFor(facultyId),
    [facultyId],
  );

  // Each stage expanded state; current year open by default.
  const [openYears, setOpenYears] = useState(() => ({ [currentYear]: true }));

  // Milestones the student has self-reported, loaded from the database so the
  // planning state survives a refresh. A self-report is not verified evidence
  // and must not be treated as an authoritative XP event.
  const [selfReportedIds, setSelfReportedIds] = useState(() => new Set());
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [lifecycle, setLifecycle] = useState(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(true);
  const [lifecycleChecking, setLifecycleChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMilestoneCompletions()
      .then((data) => {
        if (!cancelled) setSelfReportedIds(new Set(data?.selfReported ?? data?.completed ?? []));
      })
      .catch(() => {
        // Non-fatal: the roadmap remains usable and treats items as open until
        // the server confirms a persisted self-report.
      });
    return () => {
      cancelled = true;
    };
  }, [facultyId]);

  useEffect(() => {
    let cancelled = false;
    setLifecycleLoading(true);
    fetchLifecycleStatus()
      .then((data) => {
        if (!cancelled) setLifecycle(data);
      })
      .catch(() => {
        if (!cancelled) setLifecycle(null);
      })
      .finally(() => {
        if (!cancelled) setLifecycleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [facultyId]);

  const handleLifecycleCheck = async () => {
    if (lifecycleChecking) return;
    setLifecycleChecking(true);
    try {
      const data = await refreshLifecycleStatus();
      setLifecycle(data.lifecycle ?? data);
      setToast(data.transitioned
        ? 'Internship completion recorded from verified logbook hours. The lifecycle event is now in the audit trail.'
        : `Lifecycle checked: ${Number(data.approvedHours ?? data.lifecycle?.approvedHours ?? 0).toFixed(1)} approved hours. No transition was required.`);
      setTimeout(() => setToast(null), 3600);
    } catch {
      setToast('Could not check lifecycle status right now.');
      setTimeout(() => setToast(null), 2600);
    } finally {
      setLifecycleChecking(false);
    }
  };

  const handleToggle = useCallback(
    async (id, nextSelfReported) => {
      setSavingId(id);
      // Optimistic update; reconciled/rolled back on the server response.
      setSelfReportedIds((prev) => {
        const next = new Set(prev);
        if (nextSelfReported) next.add(id);
        else next.delete(id);
        return next;
      });
      try {
        await toggleMilestone(id, nextSelfReported);
        setToast(nextSelfReported
          ? 'Self-reported completion saved. Evidence or staff approval is still required for XP.'
          : 'Self-reported completion removed.');
        setTimeout(() => setToast(null), nextSelfReported ? 3600 : 2600);
      } catch {
        // Roll back on failure.
        setSelfReportedIds((prev) => {
          const next = new Set(prev);
          if (nextSelfReported) next.delete(id);
          else next.add(id);
          return next;
        });
        setToast('Could not save that milestone — try again.');
        setTimeout(() => setToast(null), 2600);
      } finally {
        setSavingId(null);
      }
    },
    [],
  );

  const toggleYear = (year) =>
    setOpenYears((prev) => ({ ...prev, [year]: !prev[year] }));

  // Annotate every stage/item with a stable id and persisted self-report.
  const stages = useMemo(
    () =>
      path.map((stage) => {
        const items = stage.items.map((item, index) => {
          const id = milestoneId(facultyId, stage.year, index);
          const selfReported = selfReportedIds.has(id);
          return { ...item, id, selfReported };
        });
        const selfReportedCount = items.filter((i) => i.selfReported).length;
        return {
          ...stage,
          items,
          selfReportedCount,
          total: items.length,
          ratio: items.length ? selfReportedCount / items.length : 0,
        };
      }),
    [path, facultyId, selfReportedIds],
  );

  // Self-reported progress — self-reported items / all items across all 4 years.
  const selfReportedProgress = useMemo(() => {
    const total = stages.reduce((n, s) => n + s.total, 0);
    const selfReported = stages.reduce((n, s) => n + s.selfReportedCount, 0);
    return total ? Math.round((selfReported / total) * 100) : 0;
  }, [stages]);

  // Smart reprioritisation: for a year >= 3 student, find the first required
  // item in the current or an earlier year that has not been self-reported.
  const behindItem = useMemo(() => {
    if (currentYear < 3) return null;
    for (const stage of stages) {
      if (stage.year > currentYear) break;
      const missing = stage.items.find((i) => i.required && !i.selfReported);
      if (missing) return { ...missing, year: stage.year };
    }
    return null;
  }, [stages, currentYear]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Milestone save toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 crimson-btn shadow-lg pointer-events-none animate-fadeIn"
        >
          <Sparkles className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="space-y-1.5">
        <h2 className="section-title font-heading flex items-center gap-2.5">
          <Map className="w-5 h-5 text-crimson" />
          <span>Your Career Path</span>
        </h2>
        <p className="section-subtitle max-w-2xl">
          A year-by-year plan for{' '}
          <span className="text-[#1d1d1f] font-semibold">{activeFaculty?.name}</span>. Every
          step links to where you do the work or submit evidence.
        </p>
      </div>

      {/* Reprioritisation banner */}
      {behindItem && (
        <Link
          href={behindItem.href}
          className="block surface surface-interactive border-crimson/40 bg-crimson/[0.05] p-4 md:p-5"
        >
          <div className="flex items-center gap-4">
            <span className="p-2.5 rounded-2xl bg-crimson/10 text-crimson shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-crimson">
                Next required step
              </p>
              <p className="font-heading font-bold text-[#1d1d1f] leading-snug mt-0.5">
                {behindItem.label}
              </p>
              <p className="text-xs text-muted mt-0.5">
                A required Year {behindItem.year} milestone has not been self-reported. Start it now.
              </p>
            </div>
            <span className="crimson-btn shrink-0 hidden sm:inline-flex">
              Start now <ChevronRight className="w-4 h-4" />
            </span>
            <ChevronRight className="w-5 h-5 text-crimson shrink-0 sm:hidden" />
          </div>
        </Link>
      )}

      {/* INTERACTIVE MULTI-YEAR VISUAL STUDY PATH GRAPH (NODE MATRIX) */}
      <div className="surface p-6 space-y-5 border border-black/10 rounded-3xl shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-black/10 pb-4">
          <div>
            <h3 className="text-lg font-heading font-bold text-[#1d1d1f] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-crimson" />
              <span>Full Multi-Year Study Path & Milestone Graph</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Interactive visual roadmap representing foundational Year 1 orientation through to Year 4 capstone and graduation placement.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/[0.04] text-[#1d1d1f] border border-black/10 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-crimson" /> Active Discipline: {activeFaculty?.code}
          </span>
        </div>

        {/* 4-Stage Horizontal Flow Diagram */}
        <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-4">
          {stages.map((stage, idx) => {
            const isCurrent = stage.year === currentYear;
            const isPast = stage.year < currentYear;
            const isFuture = stage.year > currentYear;

            return (
              <div key={stage.year} className="relative flex flex-col justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setOpenYears(prev => ({ ...prev, [stage.year]: true }));
                    if (typeof document !== 'undefined') {
                      document.getElementById(`career-year-${stage.year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className={`w-full text-left p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between h-44 shadow-xs hover:shadow-md ${
                    isCurrent ? 'bg-gradient-to-br from-crimson/[0.08] to-rose-50/50 border-crimson/40 ring-1 ring-crimson/30' :
                    isPast ? 'bg-emerald-50/40 border-emerald-500/30 hover:bg-emerald-50/70' :
                    'bg-black/[0.02] border-black/10 hover:bg-black/[0.04]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className={`text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full border ${
                        isCurrent ? 'bg-crimson text-white border-crimson shadow-xs' :
                        isPast ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        'bg-black/[0.05] text-muted border-black/10'
                      }`}>
                        {stage.label}
                      </span>
                      <span className="text-xs font-bold text-muted">
                        {isPast ? <Circle className="w-4 h-4 text-emerald-600" /> : isCurrent ? <Zap className="w-4 h-4 text-crimson animate-pulse" /> : <Lock className="w-3.5 h-3.5 text-black/30" />}
                      </span>
                    </div>
                    <h4 className="font-heading font-bold text-sm text-[#1d1d1f] leading-snug">{stage.title}</h4>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-black/[0.06]">
                    <div className="flex items-center justify-between text-[11px] text-muted font-bold">
                      <span>Self-reported progress</span>
                      <span className="tabular-nums">{stage.selfReportedCount}/{stage.total} steps</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-black/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isPast ? 'bg-emerald-500' : 'bg-crimson'}`}
                        style={{ width: `${Math.max(4, Math.round(stage.ratio * 100))}%` }}
                      />
                    </div>
                  </div>
                </button>

                {idx < stages.length - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-black/10 shadow-xs items-center justify-center text-muted">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/*
        VERIFIED LIFECYCLE RULES

        Restructured for two reasons. First, this was a dark slate/black
        gradient panel dropped into a light app -- a visible design break on the
        flagship student screen. Second, ~85 lines of governance prose sat
        permanently above the live state a student actually returns to check.

        So: the live state and its action stay open (that is the recurring
        need), and the three rule explanations -- read once, never again -- move
        behind a disclosure. Nothing was deleted; the governance text is one tap
        away and still fully readable.
      */}
      <section aria-labelledby="lifecycle-heading" className="surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-black/10 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0 space-y-1">
            <h3 id="lifecycle-heading" className="flex items-center gap-2.5 font-heading text-base font-semibold text-[#1d1d1f]">
              <ShieldCheck className="h-5 w-5 flex-shrink-0 text-crimson" aria-hidden="true" />
              <span>Verified lifecycle</span>
            </h3>
            <p className="max-w-2xl text-xs leading-relaxed text-muted">
              Your internship status updates automatically from supervisor-approved logbook hours.
            </p>
          </div>
          <span className="badge-pill self-start whitespace-nowrap border border-emerald-300 bg-emerald-50 text-emerald-800">
            Approved-hours rule active
          </span>
        </div>

        {/* Live lifecycle state. The action re-checks real approved hours; it
            cannot mark an internship complete by itself. */}
        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="font-semibold uppercase tracking-wide text-muted">Live lifecycle state</span>
              <span className={`font-bold ${lifecycle?.status === 'INTERNSHIP_COMPLETE' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {lifecycleLoading ? 'Loading…' : (lifecycle?.status ?? 'ACTIVE_STUDENT').replaceAll('_', ' ')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>Verified logbook hours</span>
              <span className="font-bold text-[#1d1d1f]">
                {Number(lifecycle?.approvedHours ?? 0).toFixed(1)} / {lifecycle?.threshold ?? 100} hours
              </span>
            </div>
            <div className="h-2 rounded-full bg-black/[0.08]" role="progressbar" aria-label="Verified internship hours" aria-valuemin="0" aria-valuemax={lifecycle?.threshold ?? 100} aria-valuenow={Math.min(Number(lifecycle?.approvedHours ?? 0), lifecycle?.threshold ?? 100)}>
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.min(100, (Number(lifecycle?.approvedHours ?? 0) / (lifecycle?.threshold || 100)) * 100)}%` }} />
            </div>
          </div>

          <button
            type="button"
            onClick={handleLifecycleCheck}
            disabled={lifecycleChecking}
            className="secondary-btn inline-flex min-h-[44px] items-center justify-center gap-2 px-4 text-xs font-semibold disabled:opacity-60"
          >
            {lifecycleChecking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            {lifecycleChecking ? 'Checking verified hours…' : 'Re-check lifecycle status'}
          </button>
        </div>

        <div className="border-t border-black/10 px-5 sm:px-6">
          <Disclosure
            variant="inline"
            title="How these rules work"
            summary="What updates automatically, and what stays with your supervisor"
            persistKey="careerpath.lifecycle-rules"
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-2 rounded-[14px] border border-black/10 bg-black/[0.02] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-crimson">
                  <Briefcase className="h-4 w-4" aria-hidden="true" /> Rule 1: Internship completion
                </div>
                <p className="text-sm font-semibold text-[#1d1d1f]">Approved-hours lifecycle transition</p>
                <p className="text-xs leading-relaxed text-muted">
                  When approved Logbook hours reach the configured threshold, the lifecycle status changes to <span className="font-semibold text-[#1d1d1f]">Internship Complete</span> and the transition is recorded in the event and audit trails. This does not approve other student work.
                </p>
              </div>

              <div className="space-y-2 rounded-[14px] border border-black/10 bg-black/[0.02] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  <GraduationCap className="h-4 w-4" aria-hidden="true" /> Rule 2: FYP approval
                </div>
                <p className="text-sm font-semibold text-[#1d1d1f]">FYP approval stays in the FYP workflow</p>
                <p className="text-xs leading-relaxed text-muted">
                  A supervisor or programme approval is the source of truth for FYP status. This career-path panel does not grant approval, change email access, or claim alumni-directory placement.
                </p>
              </div>

              <div className="space-y-2 rounded-[14px] border border-black/10 bg-black/[0.02] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
                  <Zap className="h-4 w-4" aria-hidden="true" /> Rule 3: Diagnostic scoring
                </div>
                <p className="text-sm font-semibold text-[#1d1d1f]">Rules-based diagnostic score</p>
                <p className="text-xs leading-relaxed text-muted">
                  The diagnostic scores submitted answers against its question key, labels lower-scoring categories as focus areas, and feeds those tags into workshop matching. It does not register students for events or academic tracks automatically.
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Supervisor approvals trigger these rules automatically. The outbox event, audit entry, and student lifecycle state are recorded together.
            </p>
          </Disclosure>
        </div>
      </section>

      {/* Self-reported progress + sticky year tabs */}
      <div className="surface p-5 md:p-6 space-y-5 sticky top-2 z-20">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Target className="w-5 h-5 text-crimson" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                Self-reported progress
              </p>
              <p className="font-heading font-bold text-2xl text-[#1d1d1f] tabular-nums leading-tight">
                {selfReportedProgress}%
              </p>
            </div>
          </div>
          <span className="badge-pill bg-crimson/10 text-crimson border border-crimson/25">
            Year {currentYear} of 4
          </span>
        </div>

        <div
          className="h-2.5 rounded-full bg-black/[0.06]"
          role="progressbar"
          aria-label="Overall self-reported career-path progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={selfReportedProgress}
        >
          <div
            className="h-full rounded-full bg-crimson transition-all duration-700"
            style={{ width: `${Math.max(3, selfReportedProgress)}%` }}
          />
        </div>

        {/* Sticky year selector — jumps to and opens the chosen year. */}
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
          {stages.map((stage) => {
            const isCurrent = stage.year === currentYear;
            return (
              <button
                key={stage.year}
                type="button"
                onClick={() => {
                  setOpenYears((prev) => ({ ...prev, [stage.year]: true }));
                  if (typeof document !== 'undefined') {
                    document
                      .getElementById(`career-year-${stage.year}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className={`flex min-h-11 shrink-0 items-center px-3.5 rounded-full text-xs font-semibold border transition ${
                  isCurrent
                    ? 'bg-crimson text-white border-crimson'
                    : 'bg-black/[0.03] text-[#424245] border-black/10 hover:border-crimson/40 hover:text-crimson'
                }`}
              >
                {stage.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <ol className="relative space-y-4">
        {/* Continuous spine behind the year markers. */}
        <span
          aria-hidden="true"
          className="absolute left-[19px] top-3 bottom-3 w-px bg-black/10"
        />

        {stages.map((stage) => {
          const isCurrent = stage.year === currentYear;
          const isPast = stage.year < currentYear;
          const isFuture = stage.year > currentYear;
          const isOpen = !!openYears[stage.year];
          const panelId = `career-panel-${stage.year}`;

          return (
            <li
              key={stage.year}
              id={`career-year-${stage.year}`}
              className="relative pl-14 scroll-mt-40"
            >
              {/* Year marker on the spine */}
              <span
                className={`absolute left-0 top-2 w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-extrabold shrink-0 ${
                  isPast
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : isCurrent
                    ? 'bg-crimson text-white shadow-lg shadow-crimson/30'
                    : 'bg-black/[0.03] text-[#424245] border border-black/10'
                }`}
              >
                {isPast ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : stage.year === 4 ? (
                  <Flag className="w-4 h-4" />
                ) : (
                  stage.year
                )}
              </span>

              <div
                className={`surface overflow-hidden transition-all ${
                  isCurrent ? 'border-crimson/30 shadow-sm' : ''
                }`}
              >
                {/* Header / toggle */}
                <button
                  type="button"
                  onClick={() => toggleYear(stage.year)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 hover:bg-black/[0.015] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/40 focus-visible:ring-inset"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${
                          isPast
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isCurrent
                            ? 'bg-crimson/15 text-crimson border-crimson/30'
                            : 'bg-black/[0.03] text-muted border-black/10'
                        }`}
                      >
                        {stage.label}
                      </span>
                      <span className="text-xs text-muted font-medium flex items-center gap-1">
                        {isPast ? (
                          <>
                            <Circle className="w-3 h-3 text-emerald-600" /> Earlier stage
                          </>
                        ) : isCurrent ? (
                          <>
                            <Zap className="w-3 h-3 text-crimson" /> In progress
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" /> Upcoming
                          </>
                        )}
                      </span>
                    </div>
                    <h3
                      className={`font-heading font-bold text-lg leading-snug mt-1.5 ${
                        isFuture ? 'text-[#424245]' : 'text-[#1d1d1f]'
                      }`}
                    >
                      {stage.title}
                    </h3>

                    {/* Per-year progress */}
                    <div className="flex items-center gap-3 mt-2.5">
                      <div
                        className="h-1.5 w-32 sm:w-44 rounded-full bg-black/[0.06]"
                        role="progressbar"
                        aria-label={`${stage.label} progress`}
                        aria-valuemin={0}
                        aria-valuemax={stage.total}
                        aria-valuenow={stage.selfReportedCount}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isPast ? 'bg-emerald-500' : 'bg-crimson'
                          }`}
                          style={{ width: `${Math.max(3, Math.round(stage.ratio * 100))}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted font-medium tabular-nums shrink-0">
                        {stage.selfReportedCount}/{stage.total} self-reported
                      </span>
                    </div>
                  </div>

                  <ChevronDown
                    className={`w-5 h-5 text-muted shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Collapsible body — animated max-height for a smooth expand. */}
                <div
                  id={panelId}
                  role="region"
                  hidden={!isOpen}
                  className={`grid transition-all duration-300 ease-out ${
                    isOpen
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="grid grid-cols-1 gap-2.5 border-t border-black/[0.06] px-5 pb-5 pt-1 lg:grid-cols-2">
                      {stage.items.map((item, i) => (
                        <div
                          key={item.id}
                          className="group surface-interactive rounded-[14px] p-3.5 flex items-start gap-3"
                        >
                          {/* Self-report toggle — persists planning state to the
                              DB; it does not verify evidence or award XP. */}
                          <button
                            type="button"
                            onClick={() => handleToggle(item.id, !item.selfReported)}
                            disabled={savingId === item.id}
                            aria-pressed={item.selfReported}
                            aria-label={item.selfReported ? `Remove self-report for "${item.label}"` : `Self-report "${item.label}" as complete`}
                            /* The 20px icon was the entire hit area, for the
                               primary action of the whole module -- under half
                               the 44px minimum. Negative margins keep the icon
                               optically where it was while the touch target
                               grows around it, so nothing shifts visually. */
                            className="-m-2.5 mt-[-0.375rem] flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-black/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/40 disabled:opacity-60"
                          >
                            {savingId === item.id ? (
                              <Loader2 className="w-5 h-5 text-crimson animate-spin" />
                            ) : item.selfReported ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Circle
                                className={`w-5 h-5 transition hover:text-crimson ${
                                  item.required ? 'text-crimson' : 'text-black/25'
                                }`}
                              />
                            )}
                          </button>
                          <Link
                            href={item.href}
                            className="min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/40 rounded"
                          >
                            <span
                              className={`block text-sm leading-snug ${
                                item.selfReported
                                  ? 'text-[#424245] line-through decoration-black/20'
                                  : 'text-[#1d1d1f] font-medium'
                              }`}
                            >
                              {item.label}
                            </span>
                            <span className="mt-1.5 flex items-center gap-2">
                              {item.required && !item.selfReported && (
                                <span className="badge-pill bg-crimson/10 text-crimson border border-crimson/25 text-[10px]">
                                  Required
                                </span>
                              )}
                              {item.selfReported && (
                                <span className="badge-pill bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">
                                  Self-reported · awaiting verification
                                </span>
                              )}
                              <span className="text-[11px] text-muted inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                Open <ChevronRight className="w-3 h-3" />
                              </span>
                            </span>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <Sparkles className="w-3.5 h-3.5 text-crimson" />
        <span>
          Self-reported progress is calculated from the milestones you mark across all four
          years. It is a planning signal only; evidence or staff approval is required for XP.
        </span>
      </div>
    </div>
  );
}
