// The industry supervisor's page, opened from the emailed link: read one week, approve it or send it back.
// No sign-in: the link's secret is the permission, and it works once.
import { CheckCircle2, Clock, Undo2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiFailure, useLoad } from '../api';
import { errorText, Notice, SkeletonLines, Spinner } from '../ui/parts';
import { dayLabel, weekLabel, type ReviewView } from './types';
import '../auth/auth.css';
import './logbook.css';

async function call<T>(token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/logbook/review/${encodeURIComponent(token)}`, {
    credentials: 'omit',
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    ...init,
  });
  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (!res.ok) throw new ApiFailure(res.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? '');
  return body as T;
}

export function SupervisorReview({ token }: { token: string }) {
  const load = useLoad(`review:${token}`, () => call<ReviewView>(token));
  const [done, setDone] = useState<ReviewView | null>(null);
  const [mode, setMode] = useState<'read' | 'return'>('read');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<'approve' | 'return' | null>(null);
  const [error, setError] = useState<unknown>(null);

  const decide = (decision: 'approve' | 'return') => (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(decision);
    setError(null);
    call<ReviewView>(token, { method: 'POST', body: JSON.stringify({ decision, comment }) })
      .then(setDone, setError)
      .finally(() => setBusy(null));
  };

  const week = done ?? load.data;
  return (
    <main className="auth">
      <article className="auth-card wide stack">
        <img className="auth-logo" src="/brand/qiu-logo-horizontal-dark.png" alt="Quest International University" />
        {load.loading && !week && <SkeletonLines lines={5} />}
        {load.error !== null && !week && <LinkProblem error={load.error} />}
        {week && done && (
          <div className={`lb-done ${done.status === 'approved' ? 'lb-done-ok' : ''}`} role="status">
            {done.status === 'approved' ? <CheckCircle2 size={36} aria-hidden="true" /> : <Undo2 size={36} aria-hidden="true" />}
            <h1>{done.status === 'approved' ? 'Week approved' : 'Sent back to the student'}</h1>
            <p className="muted">
              {done.student_name} gets an email now. You can close this page; the link no longer works.
            </p>
          </div>
        )}
        {week && !done && (
          <>
            <div>
              <h1>{weekLabel(week.week_start)}</h1>
              <p className="muted">
                Logbook of {week.student_name}, intern at {week.company}. Sent to you, {week.supervisor_name}.
              </p>
            </div>
            <section className="panel panel-pad stack" aria-label="The week">
              <div className="row small muted num">
                <Clock size={15} aria-hidden="true" /> {week.hours} hours
              </div>
              <div>
                <h2 className="lb-side-title">What they did</h2>
                <p className="lb-text">{week.activities}</p>
              </div>
              {week.learnings && (
                <div>
                  <h2 className="lb-side-title">What they learned</h2>
                  <p className="lb-text">{week.learnings}</p>
                </div>
              )}
            </section>
            {error !== null && <Notice tone="error">{errorText(error)}</Notice>}
            {mode === 'read' ? (
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => decide('approve')()} disabled={busy !== null}>
                  {busy === 'approve' ? <Spinner /> : <CheckCircle2 size={16} aria-hidden="true" />} Approve this week
                </button>
                <button type="button" className="btn" onClick={() => setMode('return')} disabled={busy !== null}>
                  <Undo2 size={16} aria-hidden="true" /> Send back with a comment
                </button>
              </div>
            ) : (
              <form className="stack" onSubmit={decide('return')}>
                <div className="field">
                  <label htmlFor="rv-comment">What should the student change?</label>
                  <textarea
                    id="rv-comment"
                    className="textarea"
                    rows={4}
                    maxLength={2000}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
                <div className="row">
                  <button type="submit" className="btn btn-primary" disabled={busy !== null || comment.trim().length < 5}>
                    {busy === 'return' && <Spinner />} Send back
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => setMode('read')}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            <p className="small muted">This link works once and until {dayLabel(week.expires_at.slice(0, 10))}.</p>
          </>
        )}
      </article>
    </main>
  );
}

function LinkProblem({ error }: { error: unknown }) {
  const code = error instanceof ApiFailure ? error.code : '';
  const title =
    code === 'LINK_USED' ? 'This week is already reviewed' : code === 'LINK_EXPIRED' ? 'This link has expired' : 'This link does not work';
  return (
    <div className="stack">
      <h1>{title}</h1>
      <Notice tone={code === 'LINK_USED' ? 'info' : 'warn'}>{errorText(error)}</Notice>
    </div>
  );
}
