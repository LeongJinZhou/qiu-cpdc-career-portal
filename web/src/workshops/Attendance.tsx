// CPDC at the door: the check-in code to put on screen, the list to tick, and the attendance CSV.
import { ArrowLeft, Download, Users } from 'lucide-react';
import { useState } from 'react';
import { apiGet, apiWrite, useLoad } from '../api';
import { Empty, LoadError, Notice, PersonName, SkeletonLines, errorText } from '../ui/parts';
import { dayLabel, timeLabel, type Attendee, type Workshop } from './types';

export function Attendance({ workshop, csrf, onBack }: { workshop: Workshop; csrf: string; onBack: () => void }) {
  const load = useLoad(`attendees-${workshop.id}`, () => apiGet<{ items: Attendee[] }>(`/api/workshops/${workshop.id}/attendees`));
  const [fresh, setFresh] = useState<Attendee[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = fresh ?? load.data?.items;

  async function tick(person: Attendee, present: boolean) {
    const before = items ?? [];
    // Show the tick at once; the server's answer replaces it, a failure takes it back.
    setFresh(before.map((p) => (p.user_id === person.user_id
      ? { ...p, checked_in_at: present ? new Date().toISOString() : null, checkin_method: present ? 'list' : null }
      : p)));
    setBusy(person.user_id);
    setError(null);
    try {
      const next = await apiWrite<{ items: Attendee[] }>('PUT', `/api/workshops/${workshop.id}/attendance`, { user_id: person.user_id, present }, csrf);
      setFresh(next.items);
    } catch (e) {
      setFresh(before);
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const here = items?.filter((p) => p.checked_in_at).length ?? 0;
  const going = items?.filter((p) => p.status === 'going').length ?? 0;
  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="btn btn-quiet btn-small" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> All workshops
        </button>
      </div>
      <div className="ws-door">
        <div>
          <h1>{workshop.title}</h1>
          <p className="muted">
            {dayLabel(workshop.starts_at)}, <span className="num">{timeLabel(workshop.starts_at)} to {timeLabel(workshop.ends_at)}</span>
          </p>
        </div>
        {workshop.checkin_code && (
          <div className="ws-code" aria-label={`Check-in code ${workshop.checkin_code.split('').join(' ')}`}>
            <span className="small">Check-in code</span>
            <strong className="num">{workshop.checkin_code}</strong>
            <span className="small muted">People with a seat type it on their phone from 30 minutes before the start.</span>
          </div>
        )}
      </div>
      <section className="panel panel-pad stack" aria-labelledby="att-h">
        <div className="ws-head">
          <h2 id="att-h">
            Check-in list {items && <span className="muted small num">{here} of {going} with a seat are here</span>}
          </h2>
          <a className="btn btn-small" href={`/api/workshops/${workshop.id}/export`} download>
            <Download size={15} aria-hidden="true" /> Attendance CSV
          </a>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {load.error && !items && <LoadError error={load.error} onRetry={load.reload} />}
        {!items && !load.error && <SkeletonLines lines={4} />}
        {items && items.length === 0 && <Empty icon={Users} title="No RSVPs yet">People who RSVP appear here.</Empty>}
        {items && items.length > 0 && (
          <ul className="ws-people">
            {items.map((p) => (
              <li key={p.user_id} className={p.checked_in_at ? 'is-here' : undefined}>
                <label className="check ws-tick">
                  <input
                    type="checkbox"
                    checked={p.checked_in_at !== null}
                    disabled={busy !== null}
                    onChange={(e) => void tick(p, e.target.checked)}
                    aria-label={`${p.display_name} is here`}
                  />
                </label>
                <div className="ws-person">
                  <PersonName name={p.display_name} linkedinUrl={p.linkedin_url} photo={p.picture_url} size={30} />
                  <span className="small muted">
                    {[p.matric_no ?? p.employee_id, p.department].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className={`badge${p.status === 'waitlist' ? ' badge-warn' : ''}`}>{p.status === 'going' ? 'Seat' : 'Waitlist'}</span>
                <span className="small muted ws-when num">
                  {p.checked_in_at ? `${timeLabel(p.checked_in_at)} ${p.checkin_method === 'code' ? 'by code' : 'by CPDC'}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
