'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, CheckCircle2, Clock3, Loader2, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { decideLogbookReview, fetchLogbookReviews } from '@/lib/api';

/**
 * Staff-facing logbook queue. The student form and the internal endorsement
 * workflow are deliberately separate: staff can review scoped submissions,
 * but they never inherit the student's self-service controls.
 */
export default function LogbookReviewQueue({ currentRole }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [comments, setComments] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLogbookReviews(currentRole);
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch (loadError) {
      setError(loadError.message || 'Could not load the scoped logbook queue.');
    } finally {
      setLoading(false);
    }
  }, [currentRole]);

  useEffect(() => { load(); }, [load]);

  const decide = async (entryId, status) => {
    setBusyId(entryId);
    try {
      const data = await decideLogbookReview(entryId, status, currentRole, comments[entryId] ?? null);
      setEntries((previous) => previous.map((entry) => (
        entry.id === entryId ? data.entry : entry
      )));
    } catch (decisionError) {
      setError(decisionError.message || 'Could not save the logbook decision.');
    } finally {
      setBusyId(null);
    }
  };

  const pending = entries.filter((entry) => entry.status === 'PENDING');
  const decided = entries.filter((entry) => entry.status !== 'PENDING');

  return (
    <section className="space-y-4">
      <div className="surface border-crimson/20 bg-crimson/[0.03] p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-crimson" />
          <div>
            <h2 className="font-heading font-semibold">Fieldwork endorsement queue — live</h2>
            <p className="mt-1 text-sm text-muted">
              Review pending hours inside your assigned student, programme or faculty scope. Approved hours feed the lifecycle automation and audit trail.
            </p>
          </div>
          <span className="ml-auto badge-pill whitespace-nowrap border border-amber-200 bg-amber-50 text-amber-800">
            {pending.length} pending
          </span>
        </div>
      </div>

      {error && <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{error}</div>}

      {loading ? (
        <div className="surface flex items-center justify-center gap-2 p-10 text-sm text-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading scoped logbook entries…
        </div>
      ) : pending.length === 0 ? (
        <div className="surface p-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-3 font-semibold">No pending logbook entries</p>
          <p className="mt-1 text-sm text-muted">New student submissions will appear here when they are within your configured scope.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((entry) => (
            <article key={entry.id} className="surface space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-semibold">{entry.title}</p>
                  <p className="mt-1 text-xs text-muted">{entry.student.name} · {entry.student.matricNo} · {entry.student.programme ?? 'Programme pending'}</p>
                </div>
                <span className="badge-pill border border-amber-200 bg-amber-50 text-amber-800">{entry.hours} hours · Pending</span>
              </div>
              <p className="text-sm leading-relaxed text-[#424245]">{entry.details}</p>
              <dl className="grid gap-2 rounded-[16px] border border-black/[0.06] bg-black/[0.03] p-4 text-xs sm:grid-cols-3">
                <div><dt className="text-muted">Entry date</dt><dd className="mt-1 font-semibold">{new Date(entry.entryDate).toLocaleDateString()}</dd></div>
                <div><dt className="text-muted">Faculty</dt><dd className="mt-1 font-semibold">{entry.student.facultyId}</dd></div>
                <div><dt className="text-muted">External supervisor</dt><dd className="mt-1 font-semibold">{entry.supervisor?.name ?? 'Not supplied'}</dd></div>
              </dl>
              <textarea
                value={comments[entry.id] ?? ''}
                onChange={(event) => setComments((previous) => ({ ...previous, [entry.id]: event.target.value }))}
                rows={2}
                placeholder="Optional review note for the student…"
                className="w-full rounded-[14px] border border-black/10 bg-black/[0.03] px-3 py-2 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" disabled={busyId === entry.id} onClick={() => decide(entry.id, 'REJECTED')} className="secondary-btn px-3 py-2 text-xs disabled:opacity-60">
                  <X className="h-3.5 w-3.5" /> Return for correction
                </button>
                <button type="button" disabled={busyId === entry.id} onClick={() => decide(entry.id, 'APPROVED')} className="crimson-btn px-3 py-2 text-xs disabled:opacity-60">
                  {busyId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Endorse hours
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div className="surface space-y-3 p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-crimson" /><h3 className="font-heading font-semibold">Recent decisions</h3></div>
          {decided.slice(0, 8).map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] py-2 text-xs"><span>{entry.student.name} · {entry.title}</span><span className="font-semibold">{entry.status}</span></div>)}
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted"><Clock3 className="h-3.5 w-3.5" /> Internal endorsement is recorded separately from the external supervisor magic-link audit.</p>
    </section>
  );
}
