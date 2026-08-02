import Link from 'next/link';
import { ArrowRight, Building2, Handshake, ShieldCheck, Users } from 'lucide-react';
import RevealSection from '@/components/marketing/RevealSection';

/**
 * Who else the hub is for. Deliberately describes capabilities rather than
 * naming partners: the platform has no verified employer roster to advertise,
 * and a wall of borrowed logos would be a claim QIU has not made.
 */

const AUDIENCES = [
  {
    icon: Building2,
    title: 'Employers',
    body: 'Search the opt-in talent pool by faculty, programme and verified skill, then reach out to the students whose work already fits the brief.',
    points: ['Reverse hiring search', 'Project showcases', 'Post opportunities'],
  },
  {
    icon: Handshake,
    title: 'Alumni mentors',
    body: 'Give back on your own terms — structured coffee chats and ongoing mentorship, matched to students following the path you took.',
    points: ['Mentor matching', 'Coffee chats', 'Alumni network feed'],
  },
  {
    icon: Users,
    title: 'CPDC & faculty staff',
    body: 'Publish workshops, verify submitted certificates, and see engagement across faculties without chasing spreadsheets.',
    points: ['Workshop management', 'Approval queues', 'Faculty-scoped analytics'],
  },
];

export default function EmployersSection() {
  return (
    <section id="employers" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <RevealSection className="mx-auto max-w-2xl text-center">
          <span className="badge-pill inline-block bg-crimson/10 text-crimson">Beyond students</span>
          <h2 className="section-title mt-4 text-3xl sm:text-4xl">
            The same record, from three more sides
          </h2>
          <p className="section-subtitle mt-3 text-base">
            Students build the record. Employers, alumni and staff work from it — no re-typing, no
            separate systems.
          </p>
        </RevealSection>

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {AUDIENCES.map((audience, index) => {
            const Icon = audience.icon;
            return (
              <RevealSection
                key={audience.title}
                delay={index * 90}
                className="surface surface-interactive flex flex-col p-6 sm:p-7"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-crimson/10 text-crimson">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold text-[#1d1d1f]">
                  {audience.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{audience.body}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {audience.points.map((point) => (
                    <li
                      key={point}
                      className="badge-pill border border-black/[0.08] bg-[#fbfbfd] text-[11px] font-medium text-[#424245]"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </RevealSection>
            );
          })}
        </div>

        <RevealSection className="surface mt-6 flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] bg-black/[0.04] text-[#1d1d1f]">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-heading text-base font-semibold text-[#1d1d1f]">
                Nothing goes public by accident
              </h3>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                Showcases are opt-in and coordinator-approved before they reach the talent feed, and
                supervisors sign off on fieldwork through single-use magic links.
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="secondary-btn min-h-[44px] w-full justify-center sm:w-auto sm:flex-shrink-0"
          >
            Sign in
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </RevealSection>
      </div>
    </section>
  );
}
