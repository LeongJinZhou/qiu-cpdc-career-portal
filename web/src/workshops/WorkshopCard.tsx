// One workshop in the list: when, where, seats, and the person's RSVP (seat, waitlist, check-in with the code).
import { CalendarClock, Check, MapPin, Users, Video } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiWrite } from '../api';
import { Notice, Spinner, errorText } from '../ui/parts';
import { AUDIENCE_LABEL, dateParts, dayLabel, timeLabel, type Workshop } from './types';

/** Check-in opens this long before the start (setting workshop_checkin_opens_minutes; the server decides). */
const CHECKIN_OPENS_MS = 30 * 60 * 1000;

export function WorkshopCard({
  workshop,
  csrf,
  canRsvp,
  manager,
  onChanged,
  onEdit,
  onAttendance,
}: {
  workshop: Workshop;
  csrf: string;
  canRsvp: boolean;
  manager: boolean;
  onChanged: (w: Workshop) => void;
  onEdit: () => void;
  onAttendance: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [now] = useState(() => Date.now()); // the page reloads its list; a card need not tick
  const w = workshop;
  const { day, month } = dateParts(w.starts_at);
  const mine = w.my_rsvp;
  const cancelled = w.status === 'cancelled';
  const checkinOpen = now >= Date.parse(w.starts_at) - CHECKIN_OPENS_MS && now < Date.parse(w.ends_at);

  async function act(method: 'POST' | 'DELETE', path: string, body: unknown, done: (w: Workshop) => string) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await apiWrite<Workshop>(method, path, body, csrf);
      onChanged(next);
      setMessage({ tone: 'ok', text: done(next) });
    } catch (error) {
      setMessage({ tone: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  const rsvp = () =>
    act('POST', `/api/workshops/${w.id}/rsvp`, undefined, (n) =>
      n.my_rsvp?.status === 'going' ? 'You have a seat. See you there.' : `The workshop is full. You are number ${n.my_rsvp?.waitlist_position ?? ''} on the waitlist.`,
    );
  const cancel = () => act('DELETE', `/api/workshops/${w.id}/rsvp`, undefined, () => 'Your RSVP is cancelled.');
  const checkIn = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim()) void act('POST', `/api/workshops/${w.id}/check-in`, { code: code.trim() }, () => 'You are checked in.');
  };

  const taken = Math.min(w.going_count, w.capacity);
  return (
    <article className={`ws-card${cancelled ? ' ws-cancelled' : ''}`} aria-labelledby={`ws-${w.id}`}>
      <div className="ws-date" aria-hidden="true">
        <span>{month}</span>
        <strong className="num">{day}</strong>
      </div>
      <div className="ws-body">
        <div className="ws-title-row">
          <h2 id={`ws-${w.id}`}>{w.title}</h2>
          {cancelled && <span className="badge badge-red">Cancelled</span>}
          {!cancelled && w.ended && <span className="badge">Ended</span>}
          {!cancelled && w.started && !w.ended && <span className="badge badge-warn">On now</span>}
        </div>
        <ul className="ws-facts">
          <li>
            <CalendarClock size={15} aria-hidden="true" />
            {dayLabel(w.starts_at)}, <span className="num">{timeLabel(w.starts_at)} to {timeLabel(w.ends_at)}</span>
          </li>
          <li>
            {w.mode === 'online' ? <Video size={15} aria-hidden="true" /> : <MapPin size={15} aria-hidden="true" />}
            {w.mode === 'online' ? (
              w.online_url ? (
                <a href={w.online_url} target="_blank" rel="noopener noreferrer">Online: join link</a>
              ) : (
                'Online (the link shows once you have a seat)'
              )
            ) : (
              w.venue
            )}
          </li>
          <li>
            <Users size={15} aria-hidden="true" />
            {w.audience.map((a) => AUDIENCE_LABEL[a]).join(', ')}
          </li>
        </ul>
        {w.description && <p className="ws-desc">{w.description}</p>}
        <div className="ws-seats">
          <div className="ws-meter" role="img" aria-label={`${taken} of ${w.capacity} seats taken`}>
            <span style={{ width: `${(taken / w.capacity) * 100}%` }} />
          </div>
          <span className="small num">
            {w.spots_left > 0 ? `${w.spots_left} of ${w.capacity} seats left` : `Full${w.waitlist_count ? `, ${w.waitlist_count} waiting` : ''}`}
            {manager && w.checked_in_count !== undefined && ` · ${w.checked_in_count} checked in`}
          </span>
        </div>

        {mine && !cancelled && (
          <div className="ws-mine">
            {mine.status === 'going' ? (
              <span className="badge badge-ok">
                <Check size={12} aria-hidden="true" /> {mine.checked_in ? 'Checked in' : 'You have a seat'}
              </span>
            ) : (
              <span className="badge badge-warn">Waitlist, number {mine.waitlist_position}</span>
            )}
          </div>
        )}

        {message && <Notice tone={message.tone}>{message.text}</Notice>}

        <div className="ws-actions">
          {canRsvp && !cancelled && !w.started && w.in_audience && !mine && (
            <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => void rsvp()}>
              {busy && <Spinner size={14} />}
              {w.spots_left > 0 ? 'RSVP' : 'Join the waitlist'}
            </button>
          )}
          {canRsvp && !cancelled && !w.started && mine && (
            <button type="button" className="btn btn-small" disabled={busy} onClick={() => void cancel()}>
              {mine.status === 'going' ? 'Cancel my seat' : 'Leave the waitlist'}
            </button>
          )}
          {!cancelled && w.started && !mine && !manager && <span className="small muted">RSVP closed when the workshop started.</span>}
          {canRsvp && mine?.status === 'going' && !mine.checked_in && checkinOpen && !cancelled && (
            <form className="ws-checkin" onSubmit={checkIn}>
              <label htmlFor={`code-${w.id}`} className="visually-hidden">Check-in code</label>
              <input
                id={`code-${w.id}`}
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Code on the screen"
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="btn btn-small" disabled={busy || !code.trim()}>Check in</button>
            </form>
          )}
          {manager && (
            <>
              <button type="button" className="btn btn-small" onClick={onAttendance}>Check-in list</button>
              {!cancelled && !w.ended && <button type="button" className="btn btn-quiet btn-small" onClick={onEdit}>Edit</button>}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
