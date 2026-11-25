// Interview practice: pick a field, answer questions in writing, get feedback. Past sessions below.
import { MessagesSquare, Play } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiGet, apiWrite, useLoad } from '../api';
import type { Me } from '../auth';
import { dateLabel } from '../profile/types';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, Notice, SkeletonLines, Spinner, errorText } from '../ui/parts';
import { PracticeSession } from './PracticeSession';
import type { Session, SessionSummary, Status } from './types';
import './interview.css';

export function InterviewPage({ me }: { me: Me }) {
  const status = useLoad('interview-status', () => apiGet<Status>('/api/interview/status'));
  const sessions = useLoad('interview-sessions', () => apiGet<{ items: SessionSummary[] }>('/api/interview/sessions'));
  const [open, setOpen] = useState<number | null>(null);

  if (status.error && !status.data) return <LoadError error={status.error} onRetry={status.reload} />;
  if (!status.data) return <SkeletonLines lines={5} />;

  const back = () => { setOpen(null); sessions.reload(); };
  return (
    <>
      <PageHead title="Interview practice">
        Answer common interview questions in writing and get feedback on each answer. Only you see your answers.
      </PageHead>
      {!status.data.ready && (
        <div style={{ marginBottom: 20 }}>
          <Notice tone="info">Feedback is not set up yet. CPDC is switching it on; you can still start a session and prepare.</Notice>
        </div>
      )}
      {open !== null ? (
        <PracticeSession me={me} id={open} status={status.data} onBack={back} onUsed={status.reload} />
      ) : (
        <div className="iv-home">
          <StartForm me={me} status={status.data} onStarted={(s) => setOpen(s.id)} />
          <section className="panel panel-pad" aria-labelledby="past-h">
            <h2 id="past-h" style={{ marginBottom: 12 }}>Your sessions</h2>
            {sessions.error && <LoadError error={sessions.error} onRetry={sessions.reload} />}
            {sessions.loading && !sessions.data && <SkeletonLines lines={3} />}
            {sessions.data && sessions.data.items.length === 0 && (
              <Empty icon={MessagesSquare} title="No practice yet">Start your first session. Each question takes a few minutes.</Empty>
            )}
            {sessions.data && sessions.data.items.length > 0 && (
              <ul className="iv-past">
                {sessions.data.items.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="iv-past-row" onClick={() => setOpen(s.id)}>
                      <span>
                        <strong>{s.field}</strong>
                        <span className="small muted"> · {dateLabel(s.started_at)}</span>
                      </span>
                      <span className="small muted num">
                        {s.answered} of {s.questions} answered{s.average !== null ? ` · average ${s.average.toFixed(1)}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function StartForm({ me, status, onStarted }: { me: Me; status: Status; onStarted: (s: Session) => void }) {
  const [field, setField] = useState(status.fields[0]?.field ?? '');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(event: FormEvent) {
    event.preventDefault();
    setStarting(true);
    setError(null);
    try {
      onStarted(await apiWrite<Session>('POST', '/api/interview/sessions', { field }, me.csrf_token));
    } catch (failure) {
      setError(errorText(failure));
      setStarting(false);
    }
  }

  return (
    <form className="panel panel-pad stack" onSubmit={start} aria-labelledby="start-h">
      <h2 id="start-h">Start a session</h2>
      {status.fields.length === 0 ? (
        <Empty icon={MessagesSquare} title="No questions yet">CPDC is preparing the question bank.</Empty>
      ) : (
        <>
          <div className="field">
            <label htmlFor="iv-field">Field</label>
            <select id="iv-field" className="select" value={field} onChange={(e) => setField(e.target.value)}>
              {status.fields.map((f) => (
                <option key={f.field} value={f.field}>{f.field} ({f.questions} questions)</option>
              ))}
            </select>
          </div>
          <p className="small muted num">
            {status.ready
              ? `${Math.max(0, status.daily_limit - status.used_today)} of ${status.daily_limit} feedback answers left today. Answers up to ${status.max_chars} characters.`
              : 'Feedback is not available yet.'}
          </p>
          {error && <Notice tone="error">{error}</Notice>}
          <button type="submit" className="btn btn-primary" disabled={starting} style={{ justifySelf: 'start' }}>
            {starting ? <Spinner /> : <Play size={16} aria-hidden="true" />}Start practice
          </button>
        </>
      )}
    </form>
  );
}
