'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X, Clock3, CheckCircle2, GraduationCap, ExternalLink, Loader2 } from 'lucide-react';
import { fetchFypApprovals, decideFypProject } from '@/lib/api';

const STATUS_META = {
  PENDING_REVIEW: { label: 'Pending review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NEEDS_CHANGES: { label: 'Needs changes', className: 'bg-crimson/10 text-crimson border-crimson/25' },
};

/**
 * Live FYP review queue backed by /api/fyp/approvals (Module 2). Unlike the
 * demo-fixture queue beside it, every decision here persists to Postgres and
 * flips the student's own FYP status — so an approval survives a refresh or a
 * different computer, and the student sees the outcome (and any feedback).
 */
export default function FypApprovalQueue({ currentRole }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { projects: list } = await fetchFypApprovals(currentRole);
      setProjects(Array.isArray(list) ? list : []);
      setError('');
    } catch (e) {
      setError(e.message || 'Could not load the review queue.');
    } finally {
      setLoading(false);
    }
  }, [currentRole]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id, status) => {
    setBusyId(id);
    try {
      await decideFypProject(id, status, notes[id] ?? null, currentRole);
      await load();
    } catch (e) {
      setError(e.message || 'Could not save that decision.');
    } finally {
      setBusyId(null);
    }
  };

  const pending = projects.filter((p) => p.status === 'PENDING_REVIEW');

  return (
    <section className="space-y-4">
      <div className="surface border-crimson/20 bg-crimson/[0.03] p-5">
        <div className="flex items-start gap-3">
          <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-crimson" />
          <div>
            <h2 className="font-heading font-semibold">Final Year Project review queue — live</h2>
            <p className="mt-1 text-sm text-muted">
              {pending.length} awaiting review. Decisions are saved to the database and update each student&apos;s
              FYP status immediately.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-[14px] border border-crimson/25 bg-crimson/[0.05] px-4 py-3 text-sm font-semibold text-crimson" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="surface flex items-center justify-center gap-2 p-10 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading submissions…
        </div>
      ) : projects.length === 0 ? (
        <div className="surface p-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-3 font-semibold">No submissions yet</p>
          <p className="mt-1 text-sm text-muted">When students submit their FYP, it appears here for review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const meta = STATUS_META[p.status] ?? STATUS_META.PENDING_REVIEW;
            const isPending = p.status === 'PENDING_REVIEW';
            return (
              <div key={p.id} className="surface space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge-pill border ${meta.className}`}>{meta.label}</span>
                  <span className="text-xs text-muted">
                    {p.studentName} · {p.studentMatric}
                    {p.programme ? ` · ${p.programme}` : ''}
                  </span>
                  {p.publicOptIn && (
                    <span className="badge-pill bg-black/[0.04] text-muted border border-black/10">Wants talent feed</span>
                  )}
                </div>
                <h3 className="font-heading font-semibold leading-snug">{p.title}</h3>
                <p className="text-sm text-muted line-clamp-3">{p.abstract}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {p.repositoryUrl && (
                    <a href={p.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-crimson hover:underline">
                      <ExternalLink className="h-3 w-3" /> Repository
                    </a>
                  )}
                  {p.liveUrl && (
                    <a href={p.liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-crimson hover:underline">
                      <ExternalLink className="h-3 w-3" /> Live demo
                    </a>
                  )}
                </div>

                {!isPending && p.reviewNote && (
                  <p className="rounded-[12px] bg-black/[0.03] p-3 text-xs text-muted">
                    <span className="font-semibold text-[#1d1d1f]">Your note:</span> {p.reviewNote}
                  </p>
                )}

                {isPending && (
                  <div className="space-y-2 border-t border-black/[0.06] pt-3">
                    <textarea
                      value={notes[p.id] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                      placeholder="Optional feedback (shown to the student if you request changes)…"
                      rows={2}
                      className="w-full rounded-[12px] border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-[#1d1d1f] placeholder:text-black/25 focus:outline-none focus:ring-2 focus:ring-crimson/40"
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => decide(p.id, 'NEEDS_CHANGES')}
                        className="secondary-btn px-3 py-2 text-xs disabled:opacity-60"
                      >
                        <X className="h-3.5 w-3.5" /> Request changes
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => decide(p.id, 'APPROVED')}
                        className="crimson-btn px-3 py-2 text-xs disabled:opacity-60"
                      >
                        {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
