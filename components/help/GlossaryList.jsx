'use client';

/**
 * Plain-English glossary.
 *
 * Rendered as a description list so the pairing of term and meaning survives a
 * screen reader, and so it prints sensibly if CPDC hand the page out.
 */
export default function GlossaryList({ items }) {
  if (items.length === 0) {
    return (
      <p className="surface p-5 text-sm leading-relaxed text-muted">
        No word matches that search. Try typing only the first few letters.
      </p>
    );
  }

  return (
    <dl className="space-y-3">
      {items.map((item) => (
        <div key={item.term} className="surface p-4 sm:p-5">
          <dt className="font-heading text-[15px] font-semibold text-[#1d1d1f]">{item.term}</dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-[#424245]">{item.plain}</dd>
        </div>
      ))}
    </dl>
  );
}
