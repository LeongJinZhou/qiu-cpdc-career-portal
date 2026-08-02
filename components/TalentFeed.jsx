'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Search,
  GraduationCap,
  Wrench,
  Award,
  Filter,
  Users,
  CalendarClock,
  Mail,
  Coffee,
  X,
  CheckCircle2,
  ExternalLink,
  BadgeCheck,
} from 'lucide-react';
import { FACULTIES } from '@/lib/data/facultyData';
import { fetchTalentFeed, fetchTalentOutreach, sendTalentOutreach } from '@/lib/api';

// Roles allowed to reach out to a showcased student. Students browsing their
// peers just see the gallery; recruiters and alumni get the outreach controls.
const RECRUITER_ROLES = new Set(['EMPLOYER', 'ALUMNI', 'CPDC_ADMIN', 'SUPER_ADMIN']);

const FACULTY_NAME = FACULTIES.reduce((acc, f) => {
  acc[f.id] = f.name;
  return acc;
}, {});

function initialsOf(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

// A soft, deterministic avatar tint so each student reads as distinct without
// leaning on the crimson accent (kept sparing per the design system).
const AVATAR_TINTS = [
  'bg-crimson/10 text-crimson border-crimson/20',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-rose-50 text-rose-700 border-rose-200',
];

function tintFor(id) {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

export default function TalentFeed({ currentRole = 'STUDENT' }) {
  const canReachOut = RECRUITER_ROLES.has(currentRole);

  const [facultyFilter, setFacultyFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  // Confirmation dialog: { entry, kind } where kind is 'interview' | 'coffee'.
  const [outreach, setOutreach] = useState(null);
  const [sentIds, setSentIds] = useState(() => new Set());
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [outreachError, setOutreachError] = useState('');
  const [outreachMessage, setOutreachMessage] = useState('');

  // Live, coordinator-approved projects the student opted into sharing — queried
  // from the database so a newly-approved FYP shows up here for real.
  const [liveEntries, setLiveEntries] = useState([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetchTalentFeed()
      .then((data) => {
        if (cancelled) return;
        setLiveEntries((data?.projects ?? []).map((p) => ({
          id: p.id,
          studentName: p.studentName,
          facultyId: p.facultyId,
          programme: p.programme,
          gradYear: p.reviewedAt ? new Date(p.reviewedAt).getFullYear() : new Date().getFullYear(),
          title: p.title,
          abstract: p.abstract,
          tech: p.skills ?? [],
          badges: [],
          approved: true,
          live: true,
          repositoryUrl: p.repositoryUrl,
          liveUrl: p.liveUrl,
        })));
      })
      .catch((error) => {
        if (!cancelled) setLiveError(error.message || 'Could not load the live talent feed.');
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canReachOut) return undefined;
    let cancelled = false;
    fetchTalentOutreach(currentRole)
      .then((data) => {
        if (cancelled) return;
        const recorded = new Set((data.outreach ?? []).map((item) => `${item.projectId}:${item.kind === 'INTERVIEW' ? 'interview' : 'coffee'}`));
        setSentIds(recorded);
      })
      .catch(() => {
        // The feed remains usable; the next successful send still records live.
      });
    return () => { cancelled = true; };
  }, [canReachOut, currentRole]);

  // Only ever show entries the coordinator actually cleared. The current
  // student's project joins the same feed only after an explicit public opt-in
  // and an approval decision, so previewing a draft can never leak it.
  const approvedEntries = useMemo(() => liveEntries, [liveEntries]);

  // Faculties that actually have talent, so the filter never offers empties.
  const facultyOptions = useMemo(() => {
    const present = new Set(approvedEntries.map((e) => e.facultyId));
    return FACULTIES.filter((f) => present.has(f.id));
  }, [approvedEntries]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return approvedEntries.filter((entry) => {
      if (facultyFilter !== 'all' && entry.facultyId !== facultyFilter) return false;
      if (!kw) return true;
      const haystack = [
        entry.title,
        entry.programme,
        entry.studentName,
        entry.abstract,
        ...(entry.tech ?? []),
        ...(entry.badges ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(kw);
    });
  }, [approvedEntries, facultyFilter, keyword]);

  const confirmOutreach = async () => {
    if (!outreach) return;
    setOutreachBusy(true);
    setOutreachError('');
    try {
      await sendTalentOutreach(outreach.entry.id, outreach.kind === 'interview' ? 'INTERVIEW' : 'COFFEE', outreachMessage.trim() || null, currentRole);
      setSentIds((prev) => {
        const next = new Set(prev);
        next.add(`${outreach.entry.id}:${outreach.kind}`);
        return next;
      });
      setOutreach(null);
      setOutreachMessage('');
    } catch (error) {
      setOutreachError(error.message || 'Could not record this outreach request.');
    } finally {
      setOutreachBusy(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="section-title font-heading flex items-center gap-2.5">
          <Sparkles className="w-6 h-6 text-crimson" />
          <span>QIU Talent Feed</span>
        </h1>
        <p className="section-subtitle max-w-2xl">
          Final Year Projects from graduating QIU students who chose to be discovered — each one
          coordinator-verified before it appears here. Filter by faculty or search for the skills you need.
        </p>
      </div>

      {liveError && <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{liveError}</div>}

      {/* Filter controls */}
      <div className="surface p-4 md:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted shrink-0">
            <Filter className="w-4 h-4 text-crimson" />
            <span>Filter talent</span>
          </div>

          {/* Keyword search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search by title, skill, programme or name…"
              aria-label="Search the talent feed"
              className="w-full h-11 pl-10 pr-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] placeholder:text-black/25 focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
            />
          </div>

          {/* Faculty select */}
          <div className="shrink-0">
            <label htmlFor="talent-faculty" className="sr-only">
              Filter by faculty
            </label>
            <select
              id="talent-faculty"
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
              className="w-full lg:w-64 h-11 px-4 rounded-[18px] bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-crimson focus:border-crimson transition"
            >
              <option value="all">All faculties</option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted mt-3 pt-3 border-t border-black/[0.06]">
          <Users className="w-3.5 h-3.5" />
          <span>
            Showing <span className="font-semibold text-[#1d1d1f]">{filtered.length}</span> of{' '}
            {approvedEntries.length} showcased projects
          </span>
        </div>
      </div>

      {/* Card grid */}
      {liveLoading ? (
        <div className="surface p-10 text-center text-sm text-muted" role="status">Loading approved projects from the live talent feed…</div>
      ) : filtered.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="text-sm text-muted">
            No coordinator-approved, opt-in projects are available for this view yet. Students must opt in and receive approval before a card appears.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((entry) => {
            const interviewSent = sentIds.has(`${entry.id}:interview`);
            const coffeeSent = sentIds.has(`${entry.id}:coffee`);
            return (
              <article
                key={entry.id}
                className="surface p-6 flex flex-col gap-4 h-full"
              >
                {/* Student identity */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 ${tintFor(entry.id)}`}
                    aria-hidden="true"
                  >
                    {initialsOf(entry.studentName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1d1d1f] truncate">{entry.studentName}</p>
                    <p className="text-xs text-muted flex items-center gap-1.5">
                      <CalendarClock className="w-3 h-3 shrink-0" />
                      <span>Class of {entry.gradYear}</span>
                    </p>
                  </div>
                </div>

                {/* Title + programme */}
                <div className="space-y-1.5">
                  <h2 className="font-heading font-semibold text-base text-[#1d1d1f] leading-snug">
                    {entry.title}
                  </h2>
                  <p className="text-xs text-muted flex items-start gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-crimson" />
                    <span>
                      {entry.programme} · {FACULTY_NAME[entry.facultyId] ?? 'QIU'}
                    </span>
                  </p>
                </div>

                {/* Abstract */}
                <p className="text-sm text-[#424245] leading-relaxed line-clamp-4">{entry.abstract}</p>

                {/* Tech tags */}
                {entry.tech?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-muted" />
                    {entry.tech.map((t) => (
                      <span
                        key={t}
                        className="badge-pill bg-black/[0.03] text-[#424245] border border-black/10"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Badges */}
                {entry.badges?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {entry.badges.map((b) => (
                      <span
                        key={b}
                        className="badge-pill bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1"
                      >
                        <Award className="w-3 h-3" />
                        {b}
                      </span>
                    ))}
                  </div>
                )}

                {/* Live-project quick links (repository / demo) for everyone. */}
                {entry.live && (entry.repositoryUrl || entry.liveUrl) && (
                  <div className="flex flex-wrap gap-3 text-xs">
                    {entry.repositoryUrl && (
                      <a href={entry.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-crimson hover:underline">
                        <ExternalLink className="w-3 h-3" /> Repository
                      </a>
                    )}
                    {entry.liveUrl && (
                      <a href={entry.liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-crimson hover:underline">
                        <ExternalLink className="w-3 h-3" /> Live demo
                      </a>
                    )}
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <BadgeCheck className="w-3 h-3" /> Verified · approved
                    </span>
                  </div>
                )}

                {/* Outreach controls (recruiters / alumni / admins only) */}
                {canReachOut && (
                  <div className="mt-auto pt-4 border-t border-black/[0.06] flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setOutreach({ entry, kind: 'interview' }); setOutreachMessage(''); setOutreachError(''); }}
                      disabled={interviewSent}
                      className="crimson-btn text-xs min-h-[40px] flex-1 justify-center disabled:opacity-60 disabled:cursor-default"
                    >
                      {interviewSent ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Invite sent</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          <span>Invite to interview</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOutreach({ entry, kind: 'coffee' }); setOutreachMessage(''); setOutreachError(''); }}
                      disabled={coffeeSent}
                      className="secondary-btn text-xs min-h-[40px] flex-1 justify-center disabled:opacity-60 disabled:cursor-default"
                    >
                      {coffeeSent ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Requested</span>
                        </>
                      ) : (
                        <>
                          <Coffee className="w-3.5 h-3.5" />
                          <span>Coffee chat</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Confirm dialog */}
      {outreach && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="outreach-title"
          onClick={() => setOutreach(null)}
        >
          <div
            className="glass-panel w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-crimson/10 border border-crimson/20 flex items-center justify-center text-crimson shrink-0">
                  {outreach.kind === 'interview' ? (
                    <Mail className="w-5 h-5" />
                  ) : (
                    <Coffee className="w-5 h-5" />
                  )}
                </span>
                <h2 id="outreach-title" className="font-heading font-semibold text-base text-[#1d1d1f]">
                  {outreach.kind === 'interview' ? 'Invite to interview' : 'Request a coffee chat'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOutreach(null)}
                aria-label="Close dialog"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-black/[0.03] hover:bg-black/[0.06] border border-black/10 text-muted hover:text-[#1d1d1f] transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-[#424245] leading-relaxed">
              {outreach.kind === 'interview' ? (
                <>
                  Send <span className="font-semibold text-[#1d1d1f]">{outreach.entry.studentName}</span> an
                  interview invitation for their project{' '}
                  <span className="font-semibold text-[#1d1d1f]">“{outreach.entry.title}”</span>? The request is recorded in the CPDC outreach ledger for delivery through the configured notification provider.
                </>
              ) : (
                <>
                  Request an informal coffee chat with{' '}
                  <span className="font-semibold text-[#1d1d1f]">{outreach.entry.studentName}</span> to learn
                  more about{' '}
                  <span className="font-semibold text-[#1d1d1f]">“{outreach.entry.title}”</span>?
                </>
              )}
            </p>

            <div>
              <label htmlFor="talent-outreach-message" className="mb-1.5 block text-xs font-semibold text-muted">Message to the student (optional)</label>
              <textarea id="talent-outreach-message" rows={3} value={outreachMessage} onChange={(event) => setOutreachMessage(event.target.value)} placeholder="Mention the role, topic or why you would like to connect." className="w-full rounded-[14px] border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20" />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={confirmOutreach}
                disabled={outreachBusy}
                className="crimson-btn text-sm min-h-[44px] flex-1 justify-center disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{outreachBusy ? 'Recording…' : outreach.kind === 'interview' ? 'Record invitation' : 'Record request'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOutreach(null)}
                className="secondary-btn text-sm min-h-[44px] justify-center"
              >
                Cancel
              </button>
            </div>
            {outreachError && <p className="text-xs font-semibold text-crimson" role="alert">{outreachError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
