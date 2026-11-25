// Mentoring requests: those a student sent and those a mentor received. Contact details appear once matched.
import { Check, Mail, X } from 'lucide-react';
import { useState } from 'react';
import { apiWrite } from '../api';
import type { Me } from '../auth';
import { dateLabel } from '../profile/types';
import { Notice, PersonName, Spinner, errorText } from '../ui/parts';
import { MESSAGE_MAX, STATUS_TEXT, type MentorRequest } from './types';

const BADGE: Record<MentorRequest['status'], string> = {
  waiting: 'badge badge-warn',
  accepted: 'badge badge-ok',
  declined: 'badge',
  withdrawn: 'badge',
};

export function MentorRequests({
  me,
  title,
  side,
  items,
  onChanged,
}: {
  me: Me;
  title: string;
  side: 'sent' | 'received';
  items: MentorRequest[];
  onChanged: () => void;
}) {
  return (
    <section className="panel panel-pad stack" aria-labelledby={`req-${side}`}>
      <h2 id={`req-${side}`}>{title}</h2>
      <ul className="net-requests">
        {items.map((r) => (
          <RequestRow key={r.id} me={me} side={side} request={r} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

function RequestRow({ me, side, request: r, onChanged }: { me: Me; side: 'sent' | 'received'; request: MentorRequest; onChanged: () => void }) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'accept' | 'decline' | 'withdraw') {
    setBusy(action);
    setError(null);
    try {
      const body = action === 'withdraw' ? {} : reply.trim() ? { reply: reply.trim() } : {};
      await apiWrite('POST', `/api/network/requests/${r.id}/${action}`, body, me.csrf_token);
      onChanged();
    } catch (failure) {
      setError(errorText(failure));
      setBusy(null);
    }
  }

  return (
    <li className={`net-request${r.status === 'accepted' ? ' is-matched' : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <PersonName name={r.person.display_name} linkedinUrl={r.person.linkedin_url} size={30} />
        <span className={BADGE[r.status]}>{STATUS_TEXT[r.status]}</span>
      </div>
      <p className="small muted">
        {side === 'received' && r.person.faculty ? `${r.person.faculty} · ` : ''}
        Asked {dateLabel(r.created_at)}
      </p>
      <blockquote className="net-message">{r.message}</blockquote>
      {r.reply && (
        <p className="small"><strong>{side === 'sent' ? 'Reply:' : 'Your reply:'}</strong> {r.reply}</p>
      )}
      {r.status === 'accepted' && (
        <p className="small net-contact">
          <Mail size={14} aria-hidden="true" />
          {r.person.email ? (
            <a href={`mailto:${r.person.email}`}>{r.person.email}</a>
          ) : (
            <span>No email shared. Message them on LinkedIn.</span>
          )}
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {side === 'received' && r.status === 'waiting' && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="field">
            <label htmlFor={`reply-${r.id}`}>Reply (optional)</label>
            <textarea id={`reply-${r.id}`} className="textarea" rows={2} maxLength={MESSAGE_MAX} value={reply} onChange={(e) => setReply(e.target.value)} />
          </div>
          <div className="row">
            <button type="button" className="btn btn-primary btn-small" disabled={busy !== null} onClick={() => void act('accept')}>
              {busy === 'accept' ? <Spinner size={14} /> : <Check size={15} aria-hidden="true" />}Accept
            </button>
            <button type="button" className="btn btn-small" disabled={busy !== null} onClick={() => void act('decline')}>
              {busy === 'decline' ? <Spinner size={14} /> : <X size={15} aria-hidden="true" />}Decline
            </button>
          </div>
        </div>
      )}
      {side === 'sent' && r.status === 'waiting' && (
        <button type="button" className="btn btn-quiet btn-small" disabled={busy !== null} onClick={() => void act('withdraw')} style={{ justifySelf: 'start' }}>
          {busy === 'withdraw' && <Spinner size={14} />}Withdraw request
        </button>
      )}
    </li>
  );
}
