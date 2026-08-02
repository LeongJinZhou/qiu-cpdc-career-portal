'use client';

import { AlertCircle } from 'lucide-react';

/**
 * "Something is wrong" list.
 *
 * Every entry is phrased as the sentence the reader would say out loud, and
 * every entry ends in an action — never a bare explanation of the fault.
 */
export default function TroubleshootingList({ items }) {
  if (items.length === 0) {
    return (
      <p className="surface p-5 text-sm leading-relaxed text-muted">
        No matching problems. Try a shorter search word, such as &ldquo;email&rdquo; or
        &ldquo;sign in&rdquo;.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="surface p-4 sm:p-5">
          <h3 className="flex items-start gap-2.5 font-heading text-[15px] font-semibold text-[#1d1d1f]">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
            <span>{item.problem}</span>
          </h3>
          <ol className="mt-3 space-y-2.5 pl-7">
            {item.steps.map((step, i) => (
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
        </li>
      ))}
    </ul>
  );
}
