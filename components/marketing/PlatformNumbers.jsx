import { FACULTIES } from '@/lib/data/facultyData';
import { MODULES, ROLES } from '@/lib/modules';
import CountUp from '@/components/marketing/CountUp';
import RevealSection from '@/components/marketing/RevealSection';

/**
 * The numbers band.
 *
 * Every figure here is *derived from the codebase at build time* — the faculty
 * registry, the module registry, the role list — rather than typed in by hand.
 * That is the point: this section can never drift into claiming a placement
 * rate or an employability percentage, because there is nowhere to put one. If
 * a module is retired, the number moves on its own.
 */

const enabledModules = MODULES.filter((mod) => mod.enabled).length;

const STATS = [
  { value: FACULTIES.length, label: 'Faculties', detail: 'Each with its own fieldwork model' },
  { value: enabledModules, label: 'Modules', detail: 'From logbooks to the AI coach' },
  { value: ROLES.length, label: 'Roles', detail: 'Students, alumni, employers, staff' },
  { value: 4, label: 'Years', detail: 'One record, orientation to graduation' },
];

export default function PlatformNumbers() {
  return (
    <section aria-label="The platform at a glance" className="px-4 pb-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <RevealSection className="surface grid grid-cols-2 gap-px overflow-hidden bg-black/[0.06] lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-surface px-5 py-7 text-center sm:px-6 sm:py-8">
              <p className="font-heading text-4xl font-bold tracking-tight text-[#1d1d1f] sm:text-5xl">
                <CountUp value={stat.value} />
              </p>
              <p className="mt-2 text-sm font-semibold text-crimson">{stat.label}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{stat.detail}</p>
            </div>
          ))}
        </RevealSection>
      </div>
    </section>
  );
}
