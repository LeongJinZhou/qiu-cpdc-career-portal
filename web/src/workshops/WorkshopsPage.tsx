// Workshops and events: upcoming and past. Everyone RSVPs; CPDC also creates, edits and runs the check-in.
import { CalendarDays, Plus } from 'lucide-react';
import { useState } from 'react';
import { apiGet, useLoad, type Paged } from '../api';
import { can, type Me } from '../auth';
import { Pager } from '../admin/Pager';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, Notice, SkeletonLines } from '../ui/parts';
import { Attendance } from './Attendance';
import { WorkshopCard } from './WorkshopCard';
import { WorkshopForm } from './WorkshopForm';
import type { Workshop } from './types';
import './workshops.css';

type View = { kind: 'list' } | { kind: 'form'; workshop: Workshop | null } | { kind: 'door'; workshop: Workshop };

export function WorkshopsPage({ me }: { me: Me }) {
  const manager = can(me, 'workshops.manage');
  const canRsvp = can(me, 'workshops.rsvp');
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [saved, setSaved] = useState<string | null>(null);
  // RSVP answers replace the card in place until the next load.
  const [changed, setChanged] = useState<Record<number, Workshop>>({});
  const list = useLoad(`workshops-${when}-${page}`, () => apiGet<Paged<Workshop>>('/api/workshops', { when, page }), `workshops-${when}`);

  const reload = () => {
    setChanged({});
    list.reload();
  };

  if (view.kind === 'form') {
    return (
      <WorkshopForm
        workshop={view.workshop}
        csrf={me.csrf_token}
        onClose={() => setView({ kind: 'list' })}
        onSaved={(w) => {
          setSaved(w.status === 'cancelled' ? `"${w.title}" is cancelled.` : view.workshop ? `"${w.title}" is saved.` : `"${w.title}" is published.`);
          setView({ kind: 'list' });
          reload();
        }}
      />
    );
  }
  if (view.kind === 'door') {
    return <Attendance workshop={view.workshop} csrf={me.csrf_token} onBack={() => { setView({ kind: 'list' }); reload(); }} />;
  }

  const items = list.data?.items.map((w) => changed[w.id] ?? w);
  return (
    <>
      <PageHead
        title="Workshops and events"
        actions={manager && (
          <button type="button" className="btn btn-primary" onClick={() => { setSaved(null); setView({ kind: 'form', workshop: null }); }}>
            <Plus size={17} aria-hidden="true" /> New workshop
          </button>
        )}
      >
        CPDC talks, clinics and career fairs. RSVP to keep a seat; times are Malaysia time.
      </PageHead>
      {saved && <div className="ws-saved"><Notice tone="ok">{saved}</Notice></div>}
      <div className="ws-tabs" role="group" aria-label="Show">
        {(['upcoming', 'past'] as const).map((w) => (
          <button key={w} type="button" className="btn btn-small" aria-pressed={when === w} onClick={() => { setWhen(w); setPage(1); }}>
            {w === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>
      {list.error && <LoadError error={list.error} onRetry={list.reload} />}
      {!items && !list.error && <div className="panel panel-pad"><SkeletonLines lines={5} /></div>}
      {items && items.length === 0 && (
        <div className="panel panel-pad">
          <Empty icon={CalendarDays} title={when === 'upcoming' ? 'No workshops coming up' : 'No past workshops'}>
            {when === 'upcoming' ? (manager ? 'Publish one with New workshop.' : 'New workshops appear here when CPDC publishes them.') : 'Workshops move here once they end.'}
          </Empty>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="ws-list" aria-busy={list.loading}>
          {items.map((w) => (
            <WorkshopCard
              key={w.id}
              workshop={w}
              csrf={me.csrf_token}
              canRsvp={canRsvp}
              manager={manager}
              onChanged={(next) => setChanged((c) => ({ ...c, [next.id]: next }))}
              onEdit={() => { setSaved(null); setView({ kind: 'form', workshop: w }); }}
              onAttendance={() => setView({ kind: 'door', workshop: w })}
            />
          ))}
        </div>
      )}
      {list.data && list.data.total > list.data.per_page && (
        <Pager page={list.data.page} perPage={list.data.per_page} total={list.data.total} onPage={setPage} />
      )}
    </>
  );
}
