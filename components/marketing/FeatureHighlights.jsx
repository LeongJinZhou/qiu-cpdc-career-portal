import { Bot, ClipboardCheck, FileText, GraduationCap, QrCode, Trophy } from 'lucide-react';
import { TIERS, XP_VALUES } from '@/lib/xp';
import RevealSection from '@/components/marketing/RevealSection';

/**
 * Feature section, laid out as a bento rather than a uniform grid so the two
 * anchor features get room to show a small piece of the real thing.
 *
 * The XP ladder and award values are imported from lib/xp.js — the same source
 * the portal awards against — so the marketing page and the product can never
 * quote different numbers at each other.
 */

// Ordered low -> high for the ladder; lib/xp stores them high -> low.
const LADDER = [...TIERS].reverse();

const SMALL_FEATURES = [
  {
    icon: QrCode,
    title: 'Smart Workshop Hub',
    description:
      'Sessions matched to your programme and year, with QR check-in that credits your XP on the spot.',
  },
  {
    icon: ClipboardCheck,
    title: 'Faculty fieldwork logbooks',
    description:
      'Clinical rotations, teaching practicums, lab work and internships — each with the fields its faculty actually needs, and passwordless supervisor sign-off.',
  },
  {
    icon: FileText,
    title: 'FYP Showcase',
    description:
      'Publish your final year project once; it flows into your CV and, if you opt in, the employer talent feed.',
  },
  {
    icon: GraduationCap,
    title: 'Coursera & edX certificates',
    description:
      'Bring external credentials into the same record, so everything you have earned counts in one place.',
  },
];

export default function FeatureHighlights() {
  return (
    <section id="features" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <RevealSection className="mx-auto max-w-2xl text-center">
          <span className="badge-pill inline-block bg-crimson/10 text-crimson">The platform</span>
          <h2 className="section-title mt-4 text-3xl sm:text-4xl">
            Built for every stage of growth
          </h2>
          <p className="section-subtitle mt-3 text-base">
            Coursework, workshops, placements and projects, connected instead of scattered across
            forms and inboxes.
          </p>
        </RevealSection>

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* ---- Anchor: Career XP ---- */}
          <RevealSection className="surface surface-interactive flex flex-col p-6 sm:p-8 lg:col-span-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-crimson/10 text-crimson">
              <Trophy size={22} aria-hidden="true" />
            </div>
            <h3 className="mt-5 font-heading text-xl font-semibold text-[#1d1d1f]">
              Career XP, earned not claimed
            </h3>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              Every verified action moves you along the ladder — {XP_VALUES.WORKSHOP_ATTENDANCE} XP
              for a workshop you actually checked into, {XP_VALUES.COURSE_COMPLETION} for a completed
              course, {XP_VALUES.FYP_SUBMISSION} for your final year project.
            </p>

            {/* Tier ladder, straight from lib/xp.js */}
            <div className="mt-7">
              <div className="flex items-end gap-1.5 sm:gap-2.5">
                {LADDER.map((tier, index) => (
                  <div key={tier.name} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div
                      className={`w-full rounded-t-[6px] ${
                        index === LADDER.length - 1 ? 'bg-crimson' : 'bg-crimson/25'
                      }`}
                      style={{ height: `${18 + index * 13}px` }}
                      aria-hidden="true"
                    />
                    <span className="w-full truncate text-center text-[10px] font-medium text-muted sm:text-[11px]">
                      {tier.name}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                {LADDER.length} tiers, from {LADDER[0].name} to {LADDER[LADDER.length - 1].name}.
              </p>
            </div>
          </RevealSection>

          {/* ---- Anchor: AI Career Suite ---- */}
          <RevealSection delay={90} className="surface surface-interactive flex flex-col p-6 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-crimson/10 text-crimson">
              <Bot size={22} aria-hidden="true" />
            </div>
            <h3 className="mt-5 font-heading text-xl font-semibold text-[#1d1d1f]">
              AI Career Suite
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Rehearse interviews, see your skill gaps on a live radar, and ask the career copilot
              what to do next.
            </p>

            <div className="mt-6 space-y-2.5">
              {[
                'Mock interview practice',
                'Skill gap radar',
                '24/7 career copilot',
              ].map((line) => (
                <div
                  key={line}
                  className="flex items-center gap-2.5 rounded-[12px] border border-black/[0.06] bg-[#fbfbfd] px-3.5 py-2.5"
                >
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-crimson" aria-hidden="true" />
                  <span className="text-xs font-medium text-[#424245]">{line}</span>
                </div>
              ))}
            </div>
          </RevealSection>

        </div>

        {/* ---- Supporting features ---- */}
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {SMALL_FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <RevealSection
                key={feature.title}
                delay={(index % 2) * 80}
                className="surface surface-interactive p-6 sm:p-7"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-black/[0.04] text-[#1d1d1f]">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold text-[#1d1d1f]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
              </RevealSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
