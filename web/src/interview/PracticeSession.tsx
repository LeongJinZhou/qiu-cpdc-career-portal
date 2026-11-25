// One practice session: each question with its answer box, then the coach's feedback.
import { ArrowLeft, Lightbulb, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiFailure, apiGet, apiWrite, useLoad } from '../api';
import type { Me } from '../auth';
import { dateLabel } from '../profile/types';
import { LoadError, Notice, SkeletonLines, Spinner, errorText } from '../ui/parts';
import type { Item, Session, Status } from './types';

export function PracticeSession({ me, id, status, onBack, onUsed }: { me: Me; id: number; status: Status; onBack: () => void; onUsed: () => void }) {
  const load = useLoad(`interview-session:${id}`, () => apiGet<Session>(`/api/interview/sessions/${id}`));
  const [items, setItems] = useState<Record<number, Item>>({});

  if (load.error && !load.data) return <LoadError error={load.error} onRetry={load.reload} />;
  if (!load.data) return <SkeletonLines lines={6} />;
  const session = load.data;
  const done = session.items.filter((i) => (items[i.id] ?? i).feedback).length;

  return (
    <div className="iv-session">
      <button type="button" className="btn btn-quiet btn-small" onClick={onBack} style={{ justifySelf: 'start' }}>
        <ArrowLeft size={15} aria-hidden="true" /> All sessions
      </button>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{session.field} practice</h2>
        <span className="small muted num">{dateLabel(session.started_at)} · {done} of {session.items.length} answered</span>
      </div>
      <ol className="iv-items">
        {session.items.map((original) => {
          const item = items[original.id] ?? original;
          return (
            <li key={item.id} className="panel panel-pad iv-item">
              <p className="iv-number num">Question {item.position}</p>
              <h3 className="iv-question">{item.question}</h3>
              {item.tip && (
                <p className="small muted iv-tip"><Lightbulb size={14} aria-hidden="true" /> {item.tip}</p>
              )}
              {item.feedback ? (
                <Answered item={item} />
              ) : (
                <AnswerForm
                  me={me}
                  sessionId={session.id}
                  item={item}
                  status={status}
                  onAnswered={(answered) => { setItems((all) => ({ ...all, [answered.id]: answered })); onUsed(); }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AnswerForm({ me, sessionId, item, status, onAnswered }: { me: Me; sessionId: number; item: Item; status: Status; onAnswered: (i: Item) => void }) {
  const [answer, setAnswer] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const length = answer.trim().length;
  const over = length > status.max_chars;
  const left = status.daily_limit - status.used_today;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (length < status.min_chars) {
      setError(`Write at least ${status.min_chars} characters.`);
      return;
    }
    if (over) {
      setError(`Keep your answer under ${status.max_chars} characters.`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      onAnswered(await apiWrite<Item>('POST', `/api/interview/sessions/${sessionId}/items/${item.id}/answer`, { answer: answer.trim() }, me.csrf_token));
    } catch (failure) {
      setError(failure instanceof ApiFailure && failure.code === 'RATE_LIMITED' ? 'Slow down a little: wait a minute, then send again.' : errorText(failure));
      setSending(false);
    }
  }

  if (!status.ready) return <Notice tone="info">Feedback is not set up yet. You can read the questions and prepare.</Notice>;
  return (
    <form className="stack" onSubmit={submit} style={{ gap: 10 }} noValidate>
      <div className="field">
        <label htmlFor={`answer-${item.id}`}>Your answer</label>
        <textarea
          id={`answer-${item.id}`}
          className="textarea"
          rows={6}
          value={answer}
          aria-invalid={error || over ? true : undefined}
          aria-describedby={`answer-${item.id}-count`}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <span id={`answer-${item.id}-count`} className={`hint num${over ? ' iv-over' : ''}`}>
          {length} / {status.max_chars} characters
        </span>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={sending || left <= 0}>
          {sending ? <Spinner /> : <Sparkles size={16} aria-hidden="true" />}
          {sending ? 'Reading your answer' : 'Get feedback'}
        </button>
        <span className="small muted num">{Math.max(0, left)} feedback {left === 1 ? 'answer' : 'answers'} left today</span>
      </div>
    </form>
  );
}

function Answered({ item }: { item: Item }) {
  const f = item.feedback;
  if (!f) return null;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <details className="iv-answer">
        <summary className="small">Your answer</summary>
        <p>{item.answer}</p>
      </details>
      <div className="iv-feedback" role="status">
        <div className="iv-score" aria-label={`Score ${f.score} out of 5`}>
          <span className="num">{f.score}</span>
          <span className="small muted">/ 5</span>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <p>{f.summary}</p>
          {f.strengths.length > 0 && (
            <div>
              <p className="small iv-label">Strong</p>
              <ul className="iv-points">{f.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          {f.improve.length > 0 && (
            <div>
              <p className="small iv-label">To improve</p>
              <ul className="iv-points">{f.improve.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
