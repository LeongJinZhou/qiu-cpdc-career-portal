import { Compass, Wrench, Briefcase, Rocket } from 'lucide-react';
import RevealSection from '@/components/marketing/RevealSection';

const STEPS = [
  {
    year: 'Year 1',
    title: 'Discover',
    icon: Compass,
    description: 'Explore faculties, industries and pathways while building your foundational profile.',
  },
  {
    year: 'Year 2',
    title: 'Skill Up',
    icon: Wrench,
    description: 'Stack workshops, certifications and early XP toward a career you can point to.',
  },
  {
    year: 'Year 3',
    title: 'Practice',
    icon: Briefcase,
    description: 'Log fieldwork, internships and clinical or industry placements with supervisor sign-off.',
  },
  {
    year: 'Year 4',
    title: 'Launch',
    icon: Rocket,
    description: 'Showcase your final year project and step out with an ATS-ready CV and portfolio.',
  },
];

export default function JourneyTimeline() {
  return (
    <section id="journey" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <RevealSection as="div" className="mx-auto max-w-2xl text-center">
          <h2 className="section-title text-3xl sm:text-4xl">The four-year journey</h2>
          <p className="section-subtitle mt-3 text-base">
            Every milestone, from orientation to graduation, tracked in one place.
          </p>
        </RevealSection>

        <div className="relative mt-14 flex flex-col gap-6 md:flex-row md:items-stretch md:gap-4">
          <div
            aria-hidden="true"
            className="absolute left-6 top-0 hidden h-px w-full bg-gradient-to-r from-transparent via-black/10 to-transparent md:block md:top-9"
          />
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <RevealSection
                key={step.title}
                as="div"
                delay={i * 100}
                className="surface relative flex-1 p-6 sm:p-7"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-crimson/10 text-crimson">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <p className="badge-pill mt-5 inline-block bg-black/[0.03] text-muted">{step.year}</p>
                <h3 className="mt-3 font-heading text-xl font-semibold text-[#1d1d1f]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
              </RevealSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
