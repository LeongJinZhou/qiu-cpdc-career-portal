'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Circle,
  Clock,
  Compass,
  Lock,
} from 'lucide-react';

import Disclosure from '@/components/ui/Disclosure';
import { buildPathway } from '@/lib/pathway';
import { fetchMilestoneCompletions } from '@/lib/api';

/**
 * "Where am I, and what comes next?"
 *
 * The portal has sixteen modules. Without a spine, a student sees sixteen
 * equally-weighted doors and has to invent their own route through them. This
 * component is that spine: five stages, the student's real position in them,
 * and one clear next action.
 *
 * Design commitments, each of which is a decision that could have gone the
 * other way:
 *
 *  - **The next step is never collapsed.** It sits at the top, always open. If
 *    a student reads one thing on this page, it is this.
 *  - **Completed stages collapse, future stages do not.** Past work is
 *    reference; upcoming work is orientation. Hiding what is ahead would
 *    reproduce exactly the disorientation this component exists to fix.
 *  - **Nothing is locked.** A "coming up" checkpoint still links to its module.
 *    A Year 1 student may open the FYP page; they are simply not counted as
 *    behind for not having submitted one.
 *  - **A tick always states its evidence.** An unexplained green check invites
 *    the question "did it really record that?" — which is corrosive on a system
 *    students are asked to trust with their employability record.
 */

const STAGE_ICON = {
  setup: Compass,
  discover: Compass,
  build: Circle,
  prove: Circle,
  launch: ArrowRight,
};

function CheckpointRow({ checkpoint }) {
  const state = checkpoint.done ? 'done' : checkpoint.upcoming ? 'upcoming' : 'open';

  return (
    <li>
      <Link
        href={checkpoint.href}
        className="group flex min-h-[44px] items-start gap-3 rounded-[14px] px-2 py-2 transition hover:bg-black/[0.03]"
      >
        <span
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
            state === 'done'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : state === 'upcoming'
                ? 'border-black/15 text-muted'
                : 'border-crimson text-crimson'
          }`}
        >
          {state === 'done' ? <Check className="h-3 w-3" aria-hidden="true" strokeWidth={3} /> : null}
          {state === 'upcoming' ? <Clock className="h-3 w-3" aria-hidden="true" /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`text-sm ${state === 'done' ? 'text-muted line-through' : 'text-[#1d1d1f]'}`}>
              {checkpoint.label}
            </span>
            {/* Status in words, never colour alone. */}
            {state === 'upcoming' ? (
              <span className="rounded-full border border-black/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                From Year {checkpoint.fromYear}
              </span>
            ) : null}
            {state === 'open' && checkpoint.soft ? (
              <span className="rounded-full border border-black/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Optional
              </span>
            ) : null}
          </span>
          {/* Evidence for a tick, so a completed step is verifiable rather
              than merely asserted. */}
          {state === 'done' && checkpoint.evidence ? (
            <span className="mt-0.5 block text-xs text-muted">{checkpoint.evidence}</span>
          ) : null}
        </span>

        <ArrowRight
          className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-muted opacity-0 transition group-hover:opacity-100"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

export default function StudentPathway({ student, activeFaculty, onboarding: onboardingProp = null }) {
  const [selfReported, setSelfReported] = useState([]);
  const [onboardingState, setOnboardingState] = useState(onboardingProp);

  useEffect(() => {
    let cancelled = false;
    fetchMilestoneCompletions()
      .then((data) => {
        if (!cancelled) setSelfReported(data?.selfReported ?? data?.completed ?? []);
      })
      .catch(() => {
        // Non-fatal: the pathway still renders, treating milestones as open.
      });
    return () => { cancelled = true; };
  }, [activeFaculty?.id]);

  // Fetched here rather than threaded through the portal context, so this
  // component can be dropped onto any page without that page having to know
  // about onboarding. If the call fails, buildPathway treats the Set up
  // checkpoints as met — a student who already reached the dashboard has by
  // definition passed the onboarding gate, so assuming otherwise would show
  // them a step they cannot action.
  useEffect(() => {
    if (onboardingProp) return undefined;

    let cancelled = false;
    fetch('/api/onboarding', { cache: 'no-store', credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setOnboardingState(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [onboardingProp]);

  const onboarding = onboardingProp ?? onboardingState;

  const pathway = useMemo(
    () => buildPathway({ student, activeFaculty, onboarding, selfReportedMilestones: selfReported }),
    [student, activeFaculty, onboarding, selfReported],
  );

  const { nextStep, milestones } = pathway;

  return (
    <section aria-labelledby="pathway-heading" className="surface overflow-hidden">
      {/* Header: position and progress, always visible. */}
      <div className="border-b border-black/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="pathway-heading" className="font-heading text-base font-semibold text-[#1d1d1f]">
              Your career pathway
            </h2>
            <p className="mt-1 text-sm text-muted">
              Year {pathway.year} · {pathway.facultyName}
            </p>
          </div>
          <div className="text-right">
            <p className="font-heading text-2xl font-semibold text-[#1d1d1f]">{pathway.percent}%</p>
            <p className="text-xs text-muted">
              {pathway.completed} of {pathway.total} steps
            </p>
          </div>
        </div>

        {/* Stage rail. Labelled in text, so the current position is never
            communicated by colour or position alone. */}
        <ol className="mt-5 flex items-stretch gap-1.5" aria-label="Pathway stages">
          {pathway.stages.map((stage) => (
            <li key={stage.id} className="flex flex-1 flex-col gap-1.5">
              <div
                className={`h-1.5 w-full rounded-full ${
                  stage.complete ? 'bg-emerald-600' : stage.current ? 'bg-crimson' : 'bg-black/[0.08]'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-center text-[10px] font-medium leading-tight sm:text-xs ${
                  stage.current ? 'text-[#1d1d1f]' : 'text-muted'
                }`}
              >
                {stage.label}
                {stage.current ? (
                  <span className="block text-[9px] font-semibold uppercase tracking-wide text-crimson">
                    You are here
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* The one next action. Never collapsible — this is the point of the
          whole surface. */}
      {nextStep ? (
        <div className="border-b border-black/10 bg-crimson/[0.04] p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-crimson">
            Your next step
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading text-base font-semibold text-[#1d1d1f]">{nextStep.label}</p>
              <p className="mt-0.5 text-sm text-muted">
                {pathway.currentStage?.blurb}
              </p>
            </div>
            <Link href={nextStep.href} className="crimson-btn flex min-h-[44px] items-center gap-2 px-5 text-sm">
              <span>Start</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="border-b border-black/10 bg-emerald-50 p-5 sm:p-6">
          <p className="font-heading text-base font-semibold text-emerald-900">
            Every step on your pathway is done.
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Keep building evidence — more workshops, courses and logged hours all strengthen your CV
            and your standing in the talent feed.
          </p>
        </div>
      )}

      {/* Stages. Past stages collapse; the current and future ones stay open,
          because hiding what is ahead would recreate the disorientation this
          component exists to remove. */}
      <div className="divide-y divide-black/10">
        {pathway.stages.map((stage) => {
          const StageIcon = STAGE_ICON[stage.id] ?? Circle;
          return (
            <Disclosure
              key={stage.id}
              variant="inline"
              className="px-5 sm:px-6"
              icon={StageIcon}
              title={stage.label}
              summary={stage.blurb}
              persistKey={`pathway.${stage.id}`}
              defaultOpen={!stage.past}
              badge={
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    stage.complete
                      ? 'bg-emerald-600 text-white'
                      : stage.current
                        ? 'bg-crimson text-white'
                        : 'bg-black/[0.06] text-muted'
                  }`}
                >
                  {stage.done}/{stage.total}
                </span>
              }
            >
              <ul className="space-y-0.5">
                {stage.items.map((checkpoint) => (
                  <CheckpointRow key={checkpoint.id} checkpoint={checkpoint} />
                ))}
              </ul>
            </Disclosure>
          );
        })}

        {/* This year's faculty roadmap, collapsed by default: it is depth for
            students who want it, not a second competing to-do list. */}
        {milestones.total > 0 ? (
          <Disclosure
            variant="inline"
            className="px-5 sm:px-6"
            icon={Lock}
            title={`Year ${pathway.year} roadmap — ${milestones.stage?.title ?? ''}`}
            summary={`${milestones.done} of ${milestones.total} milestones marked for your programme`}
            persistKey="pathway.milestones"
            defaultOpen={false}
          >
            <ul className="space-y-0.5">
              {milestones.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex min-h-[44px] items-start gap-3 rounded-[14px] px-2 py-2 transition hover:bg-black/[0.03]"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                        item.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-black/20'
                      }`}
                    >
                      {item.done ? <Check className="h-3 w-3" aria-hidden="true" strokeWidth={3} /> : null}
                    </span>
                    <span className={`flex-1 text-sm ${item.done ? 'text-muted line-through' : 'text-[#1d1d1f]'}`}>
                      {item.label}
                      {item.required ? (
                        <span className="ml-2 rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                          Key milestone
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 px-2 text-xs leading-relaxed text-muted">
              Mark these off on your{' '}
              <Link href="/career-path" className="font-medium text-crimson underline">
                Career Path
              </Link>{' '}
              page. They are your own planning notes — CPDC treats verified evidence, not self-reports,
              as proof.
            </p>
          </Disclosure>
        ) : null}
      </div>
    </section>
  );
}
