'use client';

import { Plus, Trash2, PencilLine } from 'lucide-react';
import { MANUAL_SECTIONS } from '@/lib/cv';
import BulletFeedback from './BulletFeedback';

/**
 * The sections a student owns outright (§9.3): work experience, volunteering
 * and achievements. Everything here is freely editable — which is exactly why
 * the recheck attaches to these lines and not to the verified ones.
 */
export default function ManualEntries({ entries, setEntries, feedback, onApplyRewrite }) {
  const addEntry = (section) => {
    setEntries((previous) => [
      ...previous,
      {
        id: `manual-${section}-${Date.now()}`,
        section,
        title: '',
        organisation: '',
        period: '',
        bullets: [''],
      },
    ]);
  };

  const patch = (id, changes) =>
    setEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)));

  const remove = (id) => setEntries((previous) => previous.filter((entry) => entry.id !== id));

  const patchBullet = (id, index, value) =>
    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id
          ? { ...entry, bullets: entry.bullets.map((bullet, i) => (i === index ? value : bullet)) }
          : entry,
      ),
    );

  const addBullet = (id) =>
    setEntries((previous) =>
      previous.map((entry) => (entry.id === id ? { ...entry, bullets: [...entry.bullets, ''] } : entry)),
    );

  const removeBullet = (id, index) =>
    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, bullets: entry.bullets.filter((_, i) => i !== index) } : entry,
      ),
    );

  return (
    <div className="surface space-y-5 p-5 sm:p-6">
      <div className="flex items-start gap-2.5 border-b border-black/10 pb-3">
        <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
        <div>
          <h3 className="font-heading text-sm font-semibold text-[#1d1d1f]">Your own sections</h3>
          <p className="mt-0.5 text-xs text-muted">
            Yours to write and edit. Run Recheck to get line-by-line feedback on anything here.
          </p>
        </div>
      </div>

      {MANUAL_SECTIONS.map((section) => {
        const sectionEntries = entries.filter((entry) => entry.section === section.id);
        return (
          <div key={section.id} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{section.label}</p>
              <button
                type="button"
                onClick={() => addEntry(section.id)}
                className="secondary-btn min-h-[44px] px-3 text-[11px] sm:min-h-0 sm:py-2"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add
              </button>
            </div>

            {sectionEntries.length === 0 && (
              <p className="rounded-[14px] border border-dashed border-black/10 p-3 text-xs text-muted">
                Nothing added yet. This section is hidden from the resume until you add something.
              </p>
            )}

            {sectionEntries.map((entry) => (
              <div key={entry.id} className="rounded-[18px] border border-black/10 bg-black/[0.02] p-4 space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="sr-only">Role or title</span>
                    <input
                      value={entry.title}
                      onChange={(event) => patch(entry.id, { title: event.target.value })}
                      placeholder="Role or title"
                      className="min-h-[44px] w-full rounded-[12px] border border-black/10 bg-white px-3 text-sm text-[#1d1d1f] placeholder:text-black/25 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/30"
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">Organisation</span>
                    <input
                      value={entry.organisation}
                      onChange={(event) => patch(entry.id, { organisation: event.target.value })}
                      placeholder="Organisation"
                      className="min-h-[44px] w-full rounded-[12px] border border-black/10 bg-white px-3 text-sm text-[#1d1d1f] placeholder:text-black/25 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/30"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="sr-only">Dates</span>
                    <input
                      value={entry.period}
                      onChange={(event) => patch(entry.id, { period: event.target.value })}
                      placeholder="Dates, e.g. Jun 2026 – Aug 2026"
                      className="min-h-[44px] w-full rounded-[12px] border border-black/10 bg-white px-3 text-sm text-[#1d1d1f] placeholder:text-black/25 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/30"
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  {entry.bullets.map((bullet, index) => {
                    const key = `${entry.id}:${index}`;
                    return (
                      <div key={key}>
                        <div className="flex items-start gap-2">
                          <textarea
                            value={bullet}
                            onChange={(event) => patchBullet(entry.id, index, event.target.value)}
                            rows={2}
                            placeholder="What you did, at what scale, and what changed as a result"
                            className="w-full rounded-[12px] border border-black/10 bg-white p-3 text-sm leading-relaxed text-[#424245] placeholder:text-black/25 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/30"
                          />
                          <button
                            type="button"
                            onClick={() => removeBullet(entry.id, index)}
                            aria-label="Remove this bullet"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-black/10 text-muted transition hover:border-crimson/40 hover:text-crimson"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <BulletFeedback
                          result={feedback?.[key]}
                          onApply={(text) => onApplyRewrite(entry.id, index, text)}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addBullet(entry.id)}
                    className="secondary-btn min-h-[44px] px-3 text-[11px] sm:min-h-0 sm:py-2"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add bullet
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(entry.id)}
                    className="secondary-btn min-h-[44px] px-3 text-[11px] sm:min-h-0 sm:py-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete entry
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
