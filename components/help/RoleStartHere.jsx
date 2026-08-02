'use client';

import Link from 'next/link';
import { ArrowRight, Compass, Eye } from 'lucide-react';
import { ROLE_GUIDES, ROLE_LABELS } from '@/lib/data/guides';

/**
 * "Start here" for whichever role the reader is signed in as.
 *
 * This is the first thing on the help page because the commonest question from
 * a new account is not "how does feature X work" but "what am I supposed to do
 * with this at all". Screens are listed with a reason, so the reader chooses by
 * purpose rather than by guessing at a label.
 */
export default function RoleStartHere({ role }) {
  const guide = ROLE_GUIDES[role];
  const label = ROLE_LABELS[role] ?? 'your account';

  if (!guide) {
    return (
      <section className="surface p-5">
        <h2 className="font-heading text-lg font-semibold text-[#1d1d1f]">Start here</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We do not have a start-here guide for this account type yet. Use the search box below to
          find the task you need, or take the walkthrough from the button at the top of this page.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="start-here-heading" className="surface p-5 sm:p-6">
      <p className="badge-pill">{label}</p>
      <h2
        id="start-here-heading"
        className="mt-3 font-heading text-xl font-semibold text-[#1d1d1f]"
      >
        Start here
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#424245]">{guide.whoYouAre}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <Compass aria-hidden="true" className="h-4 w-4 text-crimson" />
            Your first five minutes
          </h3>
          <ol className="mt-3 space-y-3">
            {guide.firstSteps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-[#424245]">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-xs font-semibold text-[#1d1d1f]"
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {guide.keyScreens.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              The screens that matter most
            </h3>
            <ul className="mt-3 space-y-2">
              {guide.keyScreens.map((screen) => (
                <li key={screen.href}>
                  <Link
                    href={screen.href}
                    className="surface-interactive flex min-h-[44px] items-center gap-3 p-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#1d1d1f]">
                        {screen.label}
                      </span>
                      <span className="block text-sm text-muted">{screen.why}</span>
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-6 flex gap-2.5 rounded-[14px] border border-black/10 bg-black/[0.02] p-4 text-sm leading-relaxed text-[#424245]">
        <Eye aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
        <span>
          <span className="font-semibold text-[#1d1d1f]">What you can see: </span>
          {guide.scopeNote}
        </span>
      </p>
    </section>
  );
}
