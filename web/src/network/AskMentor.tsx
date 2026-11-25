// A student's short message to a mentor, inline under the mentor's card.
import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiFailure, apiWrite } from '../api';
import type { Me } from '../auth';
import { Notice, Spinner, errorText } from '../ui/parts';
import { MESSAGE_MAX, MESSAGE_MIN } from './types';

export function AskMentor({ me, mentorId, name, onSent, onCancel }: { me: Me; mentorId: number; name: string; onSent: () => void; onCancel: () => void }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const length = message.trim().length;

  async function send(event: FormEvent) {
    event.preventDefault();
    if (length < MESSAGE_MIN) {
      setError(`Write at least ${MESSAGE_MIN} characters: say who you are and what you would like help with.`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiWrite('POST', `/api/network/mentors/${mentorId}/requests`, { message: message.trim() }, me.csrf_token);
      onSent();
    } catch (failure) {
      setError(failure instanceof ApiFailure && failure.status === 429 ? 'You sent many requests. Please wait an hour and try again.' : errorText(failure));
      setSending(false);
    }
  }

  return (
    <form className="stack net-ask" onSubmit={send} noValidate>
      <div className="field">
        <label htmlFor={`ask-${mentorId}`}>Message to {name}</label>
        <textarea
          id={`ask-${mentorId}`}
          className="textarea"
          rows={4}
          maxLength={MESSAGE_MAX}
          value={message}
          aria-invalid={error ? true : undefined}
          aria-describedby={`ask-${mentorId}-count`}
          onChange={(e) => setMessage(e.target.value)}
        />
        <span id={`ask-${mentorId}-count`} className="hint num">{length} / {MESSAGE_MAX}</span>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="row">
        <button type="submit" className="btn btn-primary btn-small" disabled={sending}>
          {sending ? <Spinner size={14} /> : <Send size={15} aria-hidden="true" />}Send request
        </button>
        <button type="button" className="btn btn-quiet btn-small" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
