'use client';

import { useMemo, useState } from 'react';
import { LifeBuoy, Search, PlayCircle, X } from 'lucide-react';
import { usePortal } from '@/components/portal/PortalProvider';
import {
  CONTACT_PLACEHOLDER,
  GLOSSARY,
  GUIDE_CATEGORIES,
  ROLE_LABELS,
  guidesForRole,
  matchesQuery,
  troubleshootingForRole,
} from '@/lib/data/guides';
import GuideCard from '@/components/help/GuideCard';
import RoleStartHere from '@/components/help/RoleStartHere';
import TroubleshootingList from '@/components/help/TroubleshootingList';
import GlossaryList from '@/components/help/GlossaryList';

/**
 * The help centre.
 *
 * Organised around three questions a person actually has — "what am I meant to
 * do here", "how do I do one specific thing", and "why isn't it working" —
 * rather than around the platform's own module names. Guides are filtered to
 * the reader's role by default, because showing a first-year student the
 * Registrar's clearance process is worse than showing them nothing.
 *
 * Searching looks across every task, problem and word at once, so the reader
 * never has to guess which tab their answer is filed under.
 */

const TABS = [
  { id: 'start', label: 'Start here' },
  { id: 'tasks', label: 'How do I…' },
  { id: 'fix', label: 'Fix a problem' },
  { id: 'words', label: 'What the words mean' },
];

/** Roles a reader can look up, including the account-less workplace supervisor. */
const ROLE_OPTIONS = Object.keys(ROLE_LABELS);

export default function HelpCenter() {
  const { currentRole } = usePortal();
  const [viewRole, setViewRole] = useState(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('start');
  const [openId, setOpenId] = useState(null);

  const role = viewRole ?? currentRole ?? 'STUDENT';
  const searching = query.trim().length > 0;

  const tasks = useMemo(
    () => guidesForRole(role).filter((guide) => matchesQuery(guide, query)),
    [role, query],
  );

  const problems = useMemo(
    () =>
      troubleshootingForRole(role).filter((item) =>
        matchesQuery({ title: item.problem, summary: '', steps: item.steps }, query),
      ),
    [role, query],
  );

  const words = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOSSARY;
    return GLOSSARY.filter((item) =>
      `${item.term} ${item.plain}`.toLowerCase().includes(q),
    );
  }, [query]);

  // Group the (possibly filtered) tasks under their category headings, dropping
  // any category that ended up empty.
  const grouped = useMemo(
    () =>
      GUIDE_CATEGORIES.map((category) => ({
        ...category,
        items: tasks.filter((guide) => guide.category === category.id),
      })).filter((category) => category.items.length > 0),
    [tasks],
  );

  const totalResults = tasks.length + problems.length + words.length;

  // Re-run the first-login walkthrough. OnboardingTour listens for this event.
  const startTour = () => {
    try {
      window.dispatchEvent(new CustomEvent('qiu:start-tour'));
    } catch {
      // No window, or the event was blocked — nothing to replay against.
    }
  };

  const showTasks = searching || tab === 'tasks';
  const showProblems = searching || tab === 'fix';
  const showWords = searching || tab === 'words';

  return (
    <div className="animate-fadeIn space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <h1 className="section-title font-heading flex items-center gap-2.5">
            <LifeBuoy aria-hidden="true" className="h-5 w-5 text-crimson" />
            <span>Help and guides</span>
          </h1>
          <p className="section-subtitle max-w-2xl">
            Every guide here is written for someone who has never used this platform before. Find
            the thing you are trying to do, follow the numbered steps, and you are done.
          </p>
        </div>
        <button type="button" onClick={startTour} className="crimson-btn min-h-[44px] shrink-0">
          <PlayCircle aria-hidden="true" className="h-4 w-4" /> Show me around again
        </button>
      </header>

      {/* Search — deliberately above the tabs, because it searches all of them. */}
      <div className="space-y-3">
        <div className="relative max-w-xl">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type what you want to do, e.g. add my placement hours"
            aria-label="Search the guides"
            aria-describedby="help-search-hint"
            className="min-h-[44px] w-full rounded-[14px] border border-black/10 bg-white py-3 pl-10 pr-10 text-sm text-[#1d1d1f] transition placeholder:text-muted focus:border-crimson/40 focus:outline-none focus:ring-2 focus:ring-crimson/10"
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear the search"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-black/[0.04] hover:text-[#1d1d1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/30"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
        <p id="help-search-hint" className="text-xs text-muted">
          Use ordinary words. The search looks through every guide, problem and definition at once.
        </p>
      </div>

      {/* Whose guides am I reading? Defaults to your own role. */}
      <div className="surface flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="help-role" className="text-sm text-[#424245]">
          Showing the guides for:
        </label>
        <select
          id="help-role"
          value={role}
          onChange={(event) => setViewRole(event.target.value)}
          className="min-h-[44px] rounded-[14px] border border-black/10 bg-white px-3 py-2 text-sm text-[#1d1d1f] focus:border-crimson/40 focus:outline-none focus:ring-2 focus:ring-crimson/10"
        >
          {ROLE_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {ROLE_LABELS[id]}
              {id === currentRole ? ' (you)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs. Hidden while searching, because a search covers all of them. */}
      {!searching && (
        <div role="tablist" aria-label="Kinds of help" className="flex flex-wrap gap-2">
          {TABS.map((item) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`help-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`help-tabpanel-${item.id}`}
                onClick={() => setTab(item.id)}
                className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold transition motion-reduce:transition-none ${
                  selected
                    ? 'border-crimson bg-crimson text-white'
                    : 'border-black/10 bg-white text-[#424245] hover:bg-black/[0.03]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {searching && (
        <p aria-live="polite" className="text-sm text-[#424245]">
          {totalResults === 0
            ? `Nothing matches “${query.trim()}”.`
            : `${totalResults} result${totalResults === 1 ? '' : 's'} for “${query.trim()}”.`}
        </p>
      )}

      {searching && totalResults === 0 && (
        <div className="surface max-w-2xl p-5">
          <p className="text-sm leading-relaxed text-[#424245]">
            Try one word instead of a sentence — for example <strong>hours</strong>,{' '}
            <strong>certificate</strong>, <strong>interview</strong> or <strong>sign in</strong>. If
            you are looking for something another role does, change the role in the box above. If
            nothing here answers your question, contact {CONTACT_PLACEHOLDER}.
          </p>
          <button type="button" onClick={() => setQuery('')} className="secondary-btn mt-4 min-h-[44px]">
            Clear the search
          </button>
        </div>
      )}

      {/* Start here */}
      {!searching && tab === 'start' && (
        <div role="tabpanel" id="help-tabpanel-start" aria-labelledby="help-tab-start">
          <RoleStartHere role={role} />
        </div>
      )}

      {/* Tasks */}
      {showTasks && (
        <div
          role={searching ? undefined : 'tabpanel'}
          id={searching ? undefined : 'help-tabpanel-tasks'}
          aria-labelledby={searching ? undefined : 'help-tab-tasks'}
          className="space-y-8"
        >
          {searching && tasks.length > 0 && (
            <h2 className="font-heading text-lg font-semibold text-[#1d1d1f]">
              Things you can do
            </h2>
          )}
          {!searching && grouped.length === 0 && (
            <p className="surface p-5 text-sm leading-relaxed text-muted">
              There are no task guides for this role yet.
            </p>
          )}
          {grouped.map((category) => (
            <section key={category.id} aria-labelledby={`help-cat-${category.id}`} className="space-y-3">
              <h2
                id={`help-cat-${category.id}`}
                className="text-xs font-semibold uppercase tracking-wide text-muted"
              >
                {category.label}
              </h2>
              <div className="space-y-2.5">
                {category.items.map((guide) => (
                  <GuideCard
                    key={guide.id}
                    guide={guide}
                    isOpen={openId === guide.id}
                    onToggle={() => setOpenId((current) => (current === guide.id ? null : guide.id))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Problems */}
      {showProblems && (problems.length > 0 || !searching) && (
        <div
          role={searching ? undefined : 'tabpanel'}
          id={searching ? undefined : 'help-tabpanel-fix'}
          aria-labelledby={searching ? undefined : 'help-tab-fix'}
          className="space-y-3"
        >
          <h2 className="font-heading text-lg font-semibold text-[#1d1d1f]">
            When something is not working
          </h2>
          <TroubleshootingList items={problems} />
        </div>
      )}

      {/* Glossary */}
      {showWords && (words.length > 0 || !searching) && (
        <div
          role={searching ? undefined : 'tabpanel'}
          id={searching ? undefined : 'help-tabpanel-words'}
          aria-labelledby={searching ? undefined : 'help-tab-words'}
          className="space-y-3"
        >
          <h2 className="font-heading text-lg font-semibold text-[#1d1d1f]">
            What the words mean
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            Nobody is expected to know these already. If a word on any screen confuses you, it
            should be explained here — if it is not, tell {CONTACT_PLACEHOLDER} and it will be
            added.
          </p>
          <GlossaryList items={words} />
        </div>
      )}

      <footer className="surface p-5">
        <h2 className="font-heading text-[15px] font-semibold text-[#1d1d1f]">
          Still stuck after trying the steps?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[#424245]">
          Contact {CONTACT_PLACEHOLDER}. Say which screen you were on, what you pressed, and what
          happened instead — that is usually enough to fix it in one reply.
        </p>
      </footer>
    </div>
  );
}
