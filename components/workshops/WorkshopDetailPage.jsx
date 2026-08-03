'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Award, Calendar, CheckCircle2, Clock, ExternalLink, MapPin, UserCheck } from 'lucide-react';
import { usePortal } from '@/components/portal/PortalProvider';
import { rsvpWorkshop } from '@/lib/api';

function dateLabel(value, withTime = true) {
  if (!value) return 'To be confirmed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'To be confirmed';
  return date.toLocaleString('en-GB', withTime ? { dateStyle: 'full', timeStyle: 'short' } : { dateStyle: 'medium' });
}

export default function WorkshopDetailPage() {
  const { currentRole } = usePortal();
  const params = useParams();
  const [workshop, setWorkshop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/workshops/${encodeURIComponent(params.id)}`, {
      cache: 'no-store',
      headers: currentRole ? { 'x-demo-role': currentRole } : {},
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'This workshop could not be loaded.');
        return data;
      })
      .then((data) => { if (!cancelled) setWorkshop(data.workshop); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentRole, params.id]);

  const register = async () => {
    if (!workshop) return;
    setSaving(true);
    setError('');
    try {
      const result = await rsvpWorkshop(workshop.id, !workshop.rsvped);
      setWorkshop((previous) => ({ ...previous, ...result }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="surface p-6 text-sm text-muted">Loading event details…</div>;
  if (error && !workshop) return <div className="surface space-y-3 p-6" role="alert"><p className="text-sm text-red-700">{error}</p><Link href="/workshops" className="secondary-btn inline-flex">Back to workshops</Link></div>;
  if (!workshop) return null;

  const isStudent = currentRole === 'STUDENT';
  return (
    <article className="space-y-6 animate-fadeIn">
      <Link href="/workshops" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-[#1d1d1f]"><ArrowLeft className="h-4 w-4" /> Back to workshops</Link>
      <header className="surface overflow-hidden p-6 sm:p-8">
        {workshop.coverImage ? <>
          {/* External cover URLs are user-managed event content; keep the
              resilient browser fallback used by the catalogue cards. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={workshop.coverImage} alt="" className="mb-6 h-48 w-full rounded-[20px] object-cover" />
        </> : null}
        <div className="flex flex-wrap gap-2">
          {(workshop.tags ?? []).map((tag) => <span key={tag} className="badge-pill bg-crimson/10 text-crimson">{tag}</span>)}
          {workshop.category ? <span className="badge-pill bg-black/[0.04] text-muted">{workshop.category}</span> : null}
        </div>
        <h1 className="mt-4 max-w-4xl font-heading text-3xl font-bold leading-tight sm:text-4xl">{workshop.title}</h1>
        <p className="mt-3 text-sm text-muted">Hosted by <strong className="text-[#1d1d1f]">{workshop.speaker}</strong>{workshop.hostOrganization ? ` · ${workshop.hostOrganization}` : ''}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={Calendar} label="When" value={dateLabel(workshop.startsAt)} />
          <Fact icon={MapPin} label="Where" value={workshop.location} hint={workshop.roomDetails} />
          <Fact icon={UserCheck} label="Places" value={workshop.capacity == null ? 'Open registration' : `${workshop.seatsLeft} seats left`} hint={`${workshop.rsvpCount} registered`} />
          <Fact icon={Award} label="Career XP" value={`+${workshop.xpValue}`} hint={`${workshop.attendanceCount} attended`} />
        </div>
      </header>

      {error ? <p className="rounded-[16px] border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <section className="surface space-y-3 p-6"><h2 className="font-heading text-xl font-bold">What this session covers</h2><p className="text-sm leading-relaxed text-[#424245]">{workshop.description || 'The organiser has not added a session brief yet.'}</p></section>
          <section className="surface space-y-3 p-6"><h2 className="font-heading text-xl font-bold">Speaker and host</h2><p className="text-sm leading-relaxed text-[#424245]">{workshop.speakerBio || 'Speaker biography will be added by the organiser.'}</p>{workshop.hostOrganization ? <p className="text-xs text-muted">Organised by {workshop.hostOrganization}.</p> : null}</section>
          <section className="surface space-y-4 p-6"><h2 className="font-heading text-xl font-bold">Learning outcomes</h2>{workshop.learningOutcomes?.length ? <ul className="space-y-2">{workshop.learningOutcomes.map((outcome) => <li key={outcome} className="flex items-start gap-2 text-sm leading-relaxed"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{outcome}</li>)}</ul> : <p className="text-sm text-muted">Learning outcomes will be confirmed by the organiser.</p>}</section>
          <section className="surface space-y-4 p-6"><h2 className="flex items-center gap-2 font-heading text-xl font-bold"><Clock className="h-5 w-5 text-crimson" />Run of session</h2>{workshop.agenda?.length ? <div className="space-y-4 border-l-2 border-crimson/25 pl-4">{workshop.agenda.map((slot) => <div key={`${slot.time}-${slot.title}`}><p className="text-xs font-bold uppercase tracking-wide text-crimson">{slot.time}</p><p className="mt-1 text-sm font-semibold">{slot.title}</p><p className="mt-1 text-xs leading-relaxed text-muted">{slot.description}</p></div>)}</div> : <p className="text-sm text-muted">The detailed agenda will be published by the host.</p>}</section>
        </div>
        <aside className="space-y-6">
          <section className="surface space-y-4 p-6 lg:sticky lg:top-24"><h2 className="font-heading text-lg font-bold">Your next step</h2>{isStudent ? <><p className="text-sm leading-relaxed text-muted">Reserve a place now. On the day, check in so your attendance can be added to your QIU record and Auto-CV.</p><button type="button" onClick={register} disabled={saving || (!workshop.rsvped && workshop.seatsLeft === 0)} className={`min-h-[48px] w-full justify-center ${workshop.rsvped ? 'secondary-btn' : 'crimson-btn'}`}>{saving ? 'Saving…' : workshop.rsvped ? 'Cancel registration' : 'Register for this workshop'}</button>{workshop.rsvped ? <p className="text-center text-xs font-semibold text-emerald-700">You are registered. A confirmation has been added to Notifications.</p> : null}</> : <p className="text-sm leading-relaxed text-muted">This is a read-only event brief for your role. Student registrations, attendance and the full attendee list remain protected.</p>}{workshop.prerequisites ? <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><strong>Prepare first:</strong> {workshop.prerequisites}</div> : null}{workshop.registrationDeadline ? <p className="text-xs text-muted">Registration closes {dateLabel(workshop.registrationDeadline, true)}.</p> : null}{workshop.virtualLink ? <a href={workshop.virtualLink} target="_blank" rel="noreferrer" className="secondary-btn min-h-[44px] justify-center text-xs"><ExternalLink className="h-4 w-4" /> Join online session</a> : null}</section>
        </aside>
      </div>
    </article>
  );
}

function Fact({ icon: Icon, label, value, hint }) {
  return <div className="rounded-[16px] border border-black/[0.07] bg-black/[0.025] p-3"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted"><Icon className="h-3.5 w-3.5" />{label}</p><p className="mt-1 text-sm font-semibold leading-snug">{value || 'To be confirmed'}</p>{hint ? <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p> : null}</div>;
}
