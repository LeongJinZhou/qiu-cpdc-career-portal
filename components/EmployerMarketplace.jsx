'use client';

import { useMemo, useState } from 'react';
import { Filter, Lock, Search, Sparkles, Users, X } from 'lucide-react';
import CandidateCard from '@/components/employer/CandidateCard';
import { jobDescriptionKeywords, rankCandidateAgainstJD } from '@/lib/data/employers';
import { FACULTIES } from '@/lib/data/facultyData';

/**
 * Talent search + job-description ranking.
 *
 * PRIVACY: this component never reads the student roster or the talent feed. It
 * renders exactly the `candidates` array it is handed, which the caller must
 * obtain from getOptedInCandidates() in lib/data/employers.js. Do not add a
 * direct data import here — that would bypass the opt-in gate.
 */
export default function EmployerMarketplace({
  candidates = [],
  shortlistIds = new Set(),
  invitedByCandidate = {},
  onShortlist,
  onInvite,
}) {
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [programmeFilter, setProgrammeFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [activeSkills, setActiveSkills] = useState([]);
  const [activeBadges, setActiveBadges] = useState([]);
  const [jobDescription, setJobDescription] = useState('');

  const facultyOptions = useMemo(() => {
    const present = new Set(candidates.map((candidate) => candidate.facultyId));
    return FACULTIES.filter((faculty) => present.has(faculty.id));
  }, [candidates]);

  const programmeOptions = useMemo(() => {
    const pool = facultyFilter === 'all' ? candidates : candidates.filter((c) => c.facultyId === facultyFilter);
    return [...new Set(pool.map((candidate) => candidate.programme))].sort();
  }, [candidates, facultyFilter]);

  const skillOptions = useMemo(
    () => [...new Set(candidates.flatMap((candidate) => candidate.skills ?? []))].sort(),
    [candidates],
  );

  const badgeOptions = useMemo(
    () => [...new Set(candidates.flatMap((candidate) => candidate.badges ?? []))].sort(),
    [candidates],
  );

  const jdKeywords = useMemo(() => jobDescriptionKeywords(jobDescription), [jobDescription]);
  const rankingActive = jobDescription.trim().length > 0;

  const results = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    const filtered = candidates.filter((candidate) => {
      if (facultyFilter !== 'all' && candidate.facultyId !== facultyFilter) return false;
      if (programmeFilter !== 'all' && candidate.programme !== programmeFilter) return false;
      if (activeSkills.length && !activeSkills.every((skill) => (candidate.skills ?? []).includes(skill))) return false;
      if (activeBadges.length && !activeBadges.every((badge) => (candidate.badges ?? []).includes(badge))) return false;
      if (!kw) return true;
      // Keyword covers the FYP topic as well as skills, badges and programme.
      return [
        candidate.name,
        candidate.programme,
        candidate.faculty,
        candidate.fypTitle,
        candidate.fypAbstract,
        ...(candidate.skills ?? []),
        ...(candidate.badges ?? []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(kw);
    });

    const scored = filtered.map((candidate) => ({
      candidate,
      match: rankingActive ? rankCandidateAgainstJD(candidate, jobDescription) : null,
    }));

    if (!rankingActive) return scored;
    return scored.sort((a, b) => b.match.score - a.match.score || b.match.coverage - a.match.coverage);
  }, [candidates, facultyFilter, programmeFilter, activeSkills, activeBadges, keyword, jobDescription, rankingActive]);

  const toggle = (setter) => (value) =>
    setter((previous) => (previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]));

  const resetFilters = () => {
    setFacultyFilter('all');
    setProgrammeFilter('all');
    setKeyword('');
    setActiveSkills([]);
    setActiveBadges([]);
  };

  const filtersDirty =
    facultyFilter !== 'all' || programmeFilter !== 'all' || keyword !== '' || activeSkills.length > 0 || activeBadges.length > 0;

  return (
    <div className="space-y-6">
      {/* Opt-in notice — states the rule in the interface, not just in code. */}
      <div className="surface flex items-start gap-3 border-emerald-200 bg-emerald-50/60 p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-emerald-900">
          <span className="font-semibold">Opt-in search only.</span> You are searching the{' '}
          {candidates.length} student{candidates.length === 1 ? '' : 's'} who chose to publish a showcase and were cleared
          by a QIU coordinator. There is no way to browse the wider student roster, and contact happens only through an
          invitation the student can decline.
        </p>
      </div>

      {/* JD ranking */}
      <section className="surface border-crimson/20 bg-crimson/[0.03] p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-crimson" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-semibold text-[#1d1d1f]">Paste a job description to rank candidates</h2>
            <p className="mt-1 text-sm text-muted">
              Candidates are scored on how their skills (45), project write-up (25), verified badges (20) and programme
              (10) overlap with your text. The same description always produces the same ranking, and every card shows
              which words it matched on.
            </p>
            <label htmlFor="employer-jd" className="sr-only">
              Job description
            </label>
            <textarea
              id="employer-jd"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              rows={4}
              placeholder="e.g. We are hiring a junior data analyst with Python, SQL and Power BI who can present findings to non-technical stakeholders."
              className="mt-3 w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none transition focus:border-crimson focus:ring-2 focus:ring-crimson/20"
            />
            {rankingActive && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-muted">Keywords read from your description</p>
                <div className="flex flex-wrap gap-1.5">
                  {jdKeywords.length ? (
                    jdKeywords.map((word) => (
                      <span key={word} className="badge-pill border border-black/10 bg-white text-[#424245]">
                        {word}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted">No usable keywords yet — add the skills and tools you need.</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setJobDescription('')}
                  className="secondary-btn min-h-[44px] justify-center text-xs"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Clear ranking</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="surface space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted">
            <Filter className="h-4 w-4 text-crimson" aria-hidden="true" />
            Filter talent
          </span>

          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search FYP topic, skill or programme…"
              aria-label="Search opted-in candidates"
              className="h-11 w-full rounded-[18px] border border-black/10 bg-black/[0.04] pl-10 pr-4 text-sm text-[#1d1d1f] outline-none transition placeholder:text-black/25 focus:border-crimson focus:ring-2 focus:ring-crimson/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[28rem]">
            <div>
              <label htmlFor="employer-faculty" className="sr-only">
                Filter by faculty
              </label>
              <select
                id="employer-faculty"
                value={facultyFilter}
                onChange={(event) => {
                  setFacultyFilter(event.target.value);
                  setProgrammeFilter('all');
                }}
                className="h-11 w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 text-sm text-[#1d1d1f] outline-none transition focus:border-crimson focus:ring-2 focus:ring-crimson/20"
              >
                <option value="all">All faculties</option>
                {facultyOptions.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="employer-programme" className="sr-only">
                Filter by programme
              </label>
              <select
                id="employer-programme"
                value={programmeFilter}
                onChange={(event) => setProgrammeFilter(event.target.value)}
                className="h-11 w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 text-sm text-[#1d1d1f] outline-none transition focus:border-crimson focus:ring-2 focus:ring-crimson/20"
              >
                <option value="all">All programmes</option>
                {programmeOptions.map((programme) => (
                  <option key={programme} value={programme}>
                    {programme}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <ChipRow
          label="Skills"
          options={skillOptions}
          active={activeSkills}
          onToggle={toggle(setActiveSkills)}
        />
        <ChipRow
          label="Verified badges"
          options={badgeOptions}
          active={activeBadges}
          onToggle={toggle(setActiveBadges)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-3">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Showing <span className="font-semibold text-[#1d1d1f]">{results.length}</span> of {candidates.length} opted-in
            candidates
            {rankingActive ? ' · ranked by job-description fit' : ''}
          </span>
          {filtersDirty && (
            <button type="button" onClick={resetFilters} className="secondary-btn min-h-[44px] justify-center text-xs">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </section>

      {/* Results */}
      {results.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="text-sm text-muted">
            {candidates.length === 0
              ? 'No students have opted into the public talent feed yet. Employers only ever see students who publish a showcase and are cleared by a coordinator.'
              : 'No opted-in candidates match those filters. Try a broader keyword or clear the skill filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {results.map(({ candidate, match }) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              match={match}
              shortlisted={shortlistIds.has(candidate.id)}
              invited={invitedByCandidate[candidate.id] ?? null}
              onShortlist={onShortlist}
              onInvite={onInvite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChipRow({ label, options, active, onToggle }) {
  if (!options.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted">
        {label}
        {active.length ? ` · ${active.length} selected` : ''}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = active.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option)}
              className={`badge-pill min-h-[32px] border transition ${
                on
                  ? 'border-crimson/30 bg-crimson/10 text-crimson'
                  : 'border-black/10 bg-black/[0.03] text-[#424245] hover:bg-black/[0.06]'
              }`}
            >
              {on ? '✓ ' : ''}
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
