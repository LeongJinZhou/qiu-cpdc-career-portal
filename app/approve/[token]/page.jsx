'use client';

import { useEffect, useState, use } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  User,
  GraduationCap,
  CalendarDays,
  Loader2,
  AlertTriangle,
  Link2Off,
  WifiOff,
} from 'lucide-react';
import QiuLogo from '@/components/portal/QiuLogo';

const STATUS = {
  LOADING: 'loading',
  READY: 'ready',
  NOT_FOUND: 'not_found',
  GONE: 'gone',
  NETWORK_ERROR: 'network_error',
  DECIDED: 'decided',
};

export default function ApprovePage({ params }) {
  const { token } = use(params);

  const [status, setStatus] = useState(STATUS.LOADING);
  const [goneReason, setGoneReason] = useState('');
  const [data, setData] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [decision, setDecision] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus(STATUS.LOADING);
      try {
        const res = await fetch(`/api/approvals/${token}`);
        if (cancelled) return;

        if (res.status === 404) {
          setStatus(STATUS.NOT_FOUND);
          return;
        }
        if (res.status === 410) {
          const body = await res.json().catch(() => ({}));
          setGoneReason(
            body.error && body.error.toLowerCase().includes('expired')
              ? 'expired'
              : 'used',
          );
          setStatus(STATUS.GONE);
          return;
        }
        if (!res.ok) {
          setStatus(STATUS.NETWORK_ERROR);
          return;
        }

        const body = await res.json();
        if (cancelled) return;
        setData(body);
        setStatus(STATUS.READY);
      } catch {
        if (!cancelled) setStatus(STATUS.NETWORK_ERROR);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDecision = async (choice) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/approvals/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: choice, comment: comment.trim() || null }),
      });

      if (res.status === 404) {
        setStatus(STATUS.NOT_FOUND);
        return;
      }
      if (res.status === 410) {
        const body = await res.json().catch(() => ({}));
        setGoneReason(
          body.error && body.error.toLowerCase().includes('expired') ? 'expired' : 'used',
        );
        setStatus(STATUS.GONE);
        return;
      }
      if (!res.ok) {
        setSubmitError('Something went wrong submitting your decision. Please try again.');
        return;
      }

      const body = await res.json();
      setDecision(body.status);
      setStatus(STATUS.DECIDED);
    } catch {
      setSubmitError('We could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <QiuLogo priority className="h-9 w-auto" />
          <div className="flex items-center gap-1.5 text-xs font-semibold text-crimson">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Supervisor approval</span>
          </div>
        </div>

        <div className="surface p-5 sm:p-7">
          {status === STATUS.LOADING && <LoadingState />}
          {status === STATUS.NOT_FOUND && <NotFoundState />}
          {status === STATUS.GONE && <GoneState reason={goneReason} />}
          {status === STATUS.NETWORK_ERROR && (
            <NetworkErrorState onRetry={() => window.location.reload()} />
          )}
          {status === STATUS.READY && data && (
            <ReadyState
              data={data}
              comment={comment}
              setComment={setComment}
              submitting={submitting}
              submitError={submitError}
              onDecision={handleDecision}
            />
          )}
          {status === STATUS.DECIDED && <DecidedState decision={decision} />}
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          No account or password is needed — this link is your verification.
        </p>
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-crimson" aria-hidden="true" />
      <p className="text-sm text-muted">Loading the logbook entry…</p>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Link2Off className="h-10 w-10 text-muted" aria-hidden="true" />
      <h1 className="font-heading text-lg font-semibold text-[#1d1d1f]">This link is not valid</h1>
      <p className="text-sm text-muted">
        We could not find an approval request for this link. Double check the URL your student
        sent you, or ask them to resend it.
      </p>
    </div>
  );
}

function GoneState({ reason }) {
  const expired = reason === 'expired';
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Clock className="h-10 w-10 text-muted" aria-hidden="true" />
      <h1 className="font-heading text-lg font-semibold text-[#1d1d1f]">
        {expired ? 'This link has expired' : 'This link was already used'}
      </h1>
      <p className="text-sm text-muted">
        {expired
          ? 'For security, approval links only stay active for a limited time. Please ask the student to send a new one.'
          : 'A decision has already been recorded for this logbook entry. If this seems wrong, please contact the student directly.'}
      </p>
    </div>
  );
}

function NetworkErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <WifiOff className="h-10 w-10 text-muted" aria-hidden="true" />
      <h1 className="font-heading text-lg font-semibold text-[#1d1d1f]">Connection problem</h1>
      <p className="text-sm text-muted">
        We could not load this approval request. Please check your connection and try again.
      </p>
      <button type="button" onClick={onRetry} className="secondary-btn mt-2 min-h-[44px] px-5">
        Try again
      </button>
    </div>
  );
}

function DecidedState({ decision }) {
  const approved = decision === 'APPROVED';
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      {approved ? (
        <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden="true" />
      ) : (
        <XCircle className="h-12 w-12 text-muted" aria-hidden="true" />
      )}
      <h1 className="font-heading text-lg font-semibold text-[#1d1d1f]">
        {approved ? 'Entry approved' : 'Entry rejected'}
      </h1>
      <p className="text-sm text-muted">
        {approved
          ? 'Thank you — your approval has been recorded in the QIU logbook. The student can see the updated status when they next open the platform.'
          : 'Your decision has been recorded in the QIU logbook. The student can see the updated status when they next open the platform.'}
      </p>
      <p className="pt-2 text-xs text-muted">You can safely close this page.</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  try {
    return new Date(value).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function ReadyState({ data, comment, setComment, submitting, submitError, onDecision }) {
  const { supervisorName, entry } = data;
  const student = entry.student || {};
  const fieldValues = entry.fieldValues && typeof entry.fieldValues === 'object' ? entry.fieldValues : {};
  const fieldEntries = Object.entries(fieldValues);

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <p className="text-xs text-muted">
          {supervisorName ? `Hi ${supervisorName},` : 'Hello,'} please review this logged activity.
        </p>
        <h1 className="font-heading text-lg font-semibold text-[#1d1d1f]">{entry.title}</h1>
      </div>

      <dl className="grid grid-cols-1 gap-3 rounded-[18px] border border-black/10 bg-black/[0.03] p-4 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <User className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">Student</dt>
            <dd className="text-[#1d1d1f]">
              {student.name || 'Unknown student'}
              {student.matricNo ? ` · ${student.matricNo}` : ''}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <GraduationCap className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">Faculty</dt>
            <dd className="text-[#1d1d1f]">{student.faculty || 'Not specified'}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">Date</dt>
            <dd className="text-[#1d1d1f]">{formatDate(entry.entryDate)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">Hours logged</dt>
            <dd className="text-[#1d1d1f]">{entry.hours != null ? entry.hours : 'Not specified'}</dd>
          </div>
        </div>
      </dl>

      {entry.details && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Activity details
          </span>
          <p className="rounded-[18px] border border-black/[0.06] bg-black/[0.03] p-4 text-sm leading-relaxed text-[#424245]">
            {entry.details}
          </p>
        </div>
      )}

      {fieldEntries.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Additional fields
          </span>
          <div className="space-y-2 rounded-[18px] border border-black/[0.06] bg-black/[0.03] p-4 text-sm">
            {fieldEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 border-b border-black/[0.06] pb-2 last:border-0 last:pb-0">
                <span className="text-muted">{key}</span>
                <span className="text-right text-[#1d1d1f]">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {entry.location && (
        <div className="flex items-center justify-between gap-2 rounded-[18px] border border-emerald-500/25 bg-emerald-50/30 px-3.5 py-3 text-xs text-emerald-700">
          <span className="flex items-center gap-1.5 font-semibold">
            <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            GPS location recorded
          </span>
          <span className="font-mono text-[10px] text-emerald-700/80">
            {entry.location.latitude.toFixed(4)}, {entry.location.longitude.toFixed(4)}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="supervisor-comment" className="block text-xs font-semibold text-muted">
          Comment (optional)
        </label>
        <textarea
          id="supervisor-comment"
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Add any notes for the student or CPDC office…"
          className="w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 py-3 text-sm text-[#1d1d1f] placeholder:text-muted/60 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
        />
      </div>

      {submitError && (
        <div className="flex items-start gap-2 rounded-[18px] border border-amber-500/30 bg-amber-50/20 p-3.5 text-xs text-amber-700" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={() => onDecision('REJECTED')}
          disabled={submitting}
          className="flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-[18px] border border-black/10 bg-black/[0.03] text-sm font-bold text-[#6e6e73] transition hover:bg-black/[0.06] disabled:opacity-50"
        >
          <XCircle className="h-5 w-5" aria-hidden="true" />
          <span>Reject</span>
        </button>
        <button
          type="button"
          onClick={() => onDecision('APPROVED')}
          disabled={submitting}
          className="crimson-btn flex min-h-[52px] w-full items-center justify-center gap-1.5 disabled:opacity-70"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          )}
          <span>Approve</span>
        </button>
      </div>
    </div>
  );
}
