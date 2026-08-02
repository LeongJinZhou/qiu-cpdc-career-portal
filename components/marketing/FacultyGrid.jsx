import { Cpu, Stethoscope, Pill, FlaskConical, Briefcase, BookOpen } from 'lucide-react';
import RevealSection from '@/components/marketing/RevealSection';

const FACULTIES = [
  {
    icon: Cpu,
    name: 'Computing & Engineering',
    tracks: 'Corporate internships and FYP repositories',
  },
  {
    icon: Stethoscope,
    name: 'Medicine',
    tracks: 'Clinical rotations and supervisor sign-off',
  },
  {
    icon: Pill,
    name: 'Pharmacy',
    tracks: 'Practicum placements and competency logs',
  },
  {
    icon: FlaskConical,
    name: 'Integrated Life Sciences',
    tracks: 'Lab milestones and research placements',
  },
  {
    icon: Briefcase,
    name: 'Business',
    tracks: 'Corporate internships and industry projects',
  },
  {
    icon: BookOpen,
    name: 'Education & Social Sciences',
    tracks: 'Teaching practicums and placement logs',
  },
];

export default function FacultyGrid() {
  return (
    <section id="faculties" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <RevealSection as="div" className="mx-auto max-w-2xl text-center">
          <h2 className="section-title text-3xl sm:text-4xl">Six faculties, one platform</h2>
          <p className="section-subtitle mt-3 text-base">
            Every faculty tracks a different kind of practical experience — the hub keeps it all in one place.
          </p>
        </RevealSection>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FACULTIES.map((faculty, i) => {
            const Icon = faculty.icon;
            return (
              <RevealSection
                key={faculty.name}
                as="div"
                delay={(i % 3) * 100}
                className="surface p-6 sm:p-7"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-black/[0.03] text-[#1d1d1f]">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold text-[#1d1d1f]">{faculty.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{faculty.tracks}</p>
              </RevealSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
