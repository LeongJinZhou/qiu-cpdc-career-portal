'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, CheckCircle2, LoaderCircle, RotateCcw, XCircle } from 'lucide-react';
import { decideWorkshopRequest, fetchWorkshopRequests } from '@/lib/api';

export default function WorkshopRequestQueue({ currentRole }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchWorkshopRequests(currentRole);
      setRequests(data?.requests ?? []);
    } catch (loadError) {
      setError(loadError.message || 'Could not load host requests.');
    } finally {
      setLoading(false);
    }
  }, [currentRole]);

  useEffect(() => { load(); }, [load]);

  const decide = async (request, status) => {
    setBusyId(request.id);
    setError('');
    try {
      const data = await decideWorkshopRequest(request.id, status, notes[request.id] ?? null, currentRole);
      setRequests((previous) => previous.map((item) => item.id === request.id ? data.request : item));
    } catch (decisionError) {
      setError(decisionError.message || 'Could not save the host-request decision.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="surface space-y-4 p-5">
      <div className="flex items-start justify-between gap-3 border-b border-black/10 pb-4">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><CalendarPlus className="h-5 w-5 text-crimson" /> Employer host requests</h2>
          <p className="mt-1 text-sm text-muted">Review the proposal before an event is published. Approval records the decision; CPDC still enters the speaker, timing, venue, agenda and capacity in the complete workshop brief.</p>
        </div>
        <button type="button" onClick={load} className="secondary-btn shrink-0 px-3 py-2 text-xs">Refresh</button>
      </div>
      {error ? <p className="rounded-[14px] border border-crimson/25 bg-crimson/[0.05] px-3 py-2 text-sm font-semibold text-crimson" role="alert">{error}</p> : null}
      {loading ? <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted" role="status"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading host requests…</p> : requests.length === 0 ? <p className="py-8 text-center text-sm text-muted">No employer host requests have been recorded.</p> : <div className="space-y-3">{requests.map((request) => <article key={request.id} className="rounded-[16px] border border-black/10 bg-black/[0.02] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[#1d1d1f]">{request.title}</h3><p className="mt-1 text-xs text-muted">{request.requester?.name ?? 'Employer'} · {request.requester?.email ?? 'No email'} · {request.preferredDate || 'No preferred timing'}</p></div><span className="badge-pill border border-black/10 bg-white text-muted">{request.status}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#424245]">{request.description}</p>{request.reviewNote ? <p className="mt-3 rounded-[12px] border border-black/10 bg-white p-3 text-xs text-muted">Previous note: {request.reviewNote}</p> : null}{request.status === 'PENDING' ? <div className="mt-4 space-y-3 border-t border-black/10 pt-3"><label htmlFor={`workshop-request-note-${request.id}`} className="text-xs font-semibold text-muted">Decision note (optional)</label><textarea id={`workshop-request-note-${request.id}`} rows={2} value={notes[request.id] ?? ''} onChange={(event) => setNotes((previous) => ({ ...previous, [request.id]: event.target.value }))} placeholder="What should the employer or CPDC team know?" className="w-full rounded-[12px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20" /><div className="flex flex-wrap gap-2"><button type="button" disabled={busyId === request.id} onClick={() => decide(request, 'APPROVED')} className="crimson-btn min-h-[42px] text-xs disabled:opacity-60"><CheckCircle2 className="h-3.5 w-3.5" /> Approve for event setup</button><button type="button" disabled={busyId === request.id} onClick={() => decide(request, 'RETURNED')} className="secondary-btn min-h-[42px] text-xs disabled:opacity-60"><RotateCcw className="h-3.5 w-3.5" /> Return for detail</button><button type="button" disabled={busyId === request.id} onClick={() => decide(request, 'DECLINED')} className="secondary-btn min-h-[42px] text-xs text-crimson disabled:opacity-60"><XCircle className="h-3.5 w-3.5" /> Decline</button></div></div> : null}</article>)}</div>}
    </section>
  );
}

