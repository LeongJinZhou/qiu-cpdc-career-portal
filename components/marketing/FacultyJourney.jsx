'use client';

import { useState } from 'react';
import { Check, Compass, Rocket, Wrench, Briefcase } from 'lucide-react';
import { FACULTIES } from '@/lib/data/facultyData';

/**
 * The interactive centrepiece: pick a faculty, and the four-year journey
 * rewrites itself around how that faculty actually tracks practical work.
 *
 * Everything on screen is read from the faculty registry in
 * lib/data/facultyData.js — the description, the programme count, the tracking
 * model and its features. Nothing is authored here, so the page cannot claim
 * something the platform does not model, and adding a faculty upstream adds a
 * chip here for free.
 */

const shortName = (name) => name.replace(/^Faculty of /, '');

/** The four-year arc, with year three coloured by the faculty's own model. */
function stepsFor(faculty) {
  const [firstFeature, secondFeature] = faculty.systemAssignment.features;
  return [
    {
      year: 'Year 1',
      title: 'Discover',
      icon: Compass,
      body: `Set up your profile, explore ${shortName(faculty.name).toLowerCase()} pathways, and start earning Career XP at your first CPDC workshop.`,
    },
    {
      year: 'Year 2',
      title: 'Skill up',
      icon: Wrench,
      body: 'Stack workshops, skills diagnostics and external certificates against the gaps your programme cares about.',
    },
    {
      year: 'Year 3',
      title: 'Practice',
      icon: Briefcase,
      body: `${faculty.systemAssignment.type} — record ${firstFeature.toLowerCase()} and ${secondFeature.toLowerCase()}, signed off by your supervisor through a magic link.`,
    },
    {
      year: 'Year 4',
      title: 'Launch',
      icon: Rocket,
      body: 'Publish your final year project to the showcase and export an ATS-ready CV assembled from every verified record above.',
    },
  ];
}

export default function FacultyJourney() {
  const [activeId, setActiveId] = useState(FACULTIES[0].id);
  const faculty = FACULTIES.find((item) => item.id === activeId) ?? FACULTIES[0];
  const steps = stepsFor(faculty);

  return (
    <section id="journey" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="badge-pill inline-block bg-crimson/10 text-crimson">The journey</span>
          <h2 className="section-title mt-4 text-3xl sm:text-4xl">
            One platform, {FACULTIES.length} very different journeys
          </h2>
          <p className="section-subtitle mt-3 text-base">
            A clinical rotation, a hotel shift and a code review are not the same thing. Choose a
            faculty to see how the hub tracks its four years.
          </p>
        </div>

        {/* ---------- Faculty selector ---------- */}
        <div
          className="mt-10 -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
          role="group"
          aria-label="Choose a faculty"
        >
          {FACULTIES.map((item) => {
            const isActive = item.id === faculty.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveId(item.id)}
                className={`inline-flex min-h-[44px] flex-shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-crimson bg-crimson text-white shadow-[0_6px_18px_rgba(229,9,20,0.18)]'
                    : 'border-black/10 bg-surface text-muted hover:border-black/20 hover:text-[#1d1d1f]'
                }`}
              >
                {/* Selection is carried by the check + fill, never by colour alone. */}
                {isActive ? (
                  <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                )}
                {shortName(item.name)}
              </button>
            );
          })}
        </div>

        {/* ---------- Panel ---------- */}
        <div
          key={faculty.id}
          className="qiu-float-in mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[0.85fr_1.15fr]"
        >
          {/* Faculty summary */}
          <div className="surface relative overflow-hidden p-7 sm:p-8">
            <span
              className="absolute inset-x-0 top-0 h-1"
              style={{ backgroundColor: faculty.color }}
              aria-hidden="true"
            />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              {faculty.code}
            </p>
            <h3 className="mt-2 font-heading text-2xl font-semibold leading-snug text-[#1d1d1f]">
              {faculty.name}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{faculty.description}</p>

            <dl className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[14px] bg-black/[0.03] px-4 py-3">
                <dt className="text-xs text-muted">Programmes</dt>
                <dd className="mt-0.5 font-heading text-xl font-bold text-[#1d1d1f]">
                  {faculty.programmes.length}
                </dd>
              </div>
              <div className="rounded-[14px] bg-black/[0.03] px-4 py-3">
                <dt className="text-xs text-muted">Tracked as</dt>
                <dd className="mt-0.5 text-xs font-semibold leading-snug text-[#1d1d1f]">
                  {faculty.systemAssignment.type}
                </dd>
              </div>
            </dl>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              What the logbook captures
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {faculty.systemAssignment.features.map((feature) => (
                <li
                  key={feature}
                  className="badge-pill border border-black/[0.08] bg-white text-[11px] font-medium text-[#424245]"
                >
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Four-year timeline */}
          <ol className="flex flex-col gap-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.year}
                  className="surface qiu-fade-up relative flex gap-4 p-5 sm:p-6"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] bg-crimson/10 text-crimson">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      {step.year}
                    </p>
                    <h4 className="mt-1 font-heading text-lg font-semibold text-[#1d1d1f]">
                      {step.title}
                    </h4>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
