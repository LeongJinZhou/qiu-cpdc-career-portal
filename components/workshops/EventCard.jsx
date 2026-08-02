'use client';

import { Award, CalendarDays, CheckCircle2, MapPin, Sparkles, Users } from 'lucide-react';
import { CATEGORIES, eventStatus, formatEventDate, initialsOf } from './eventCatalogue';

/**
 * The card system for Module 3 — and the pattern the other modules copy.
 *
 * Fixed anatomy, identical for every card so a grid never misaligns:
 *   1. banner, always 16:9 (no images yet, so a category-toned panel with the
 *      speaker's initials — never a broken <img>)
 *   2. title (clamped to two lines) + speaker
 *   3. date / time / venue block
 *   4. footer: match tag bottom-left, RSVP bottom-right
 *
 * The card never hides anything: an unmatched event renders the same card with
 * a neutral relevance tag rather than being dropped from the grid.
 */

const STATUS_STYLE = {
  live: 'bg-white text-rose-700',
  upcoming: 'bg-white/90 text-[#1d1d1f]',
  past: 'bg-white/85 text-[#6e6e73]',
};

const STATUS_LABEL = { live: 'Happening now', upcoming: 'Upcoming', past: 'Past event' };

export default function EventCard({ event, onRegister, onCheckIn, onOpen }) {
  const category = CATEGORIES[event.category] ?? CATEGORIES.technical;
  const status = eventStatus(event);
  const match = event.match ?? { score: 0, recommended: false, why: '' };
  const seatsLeft = Math.max(0, (event.capacity ?? 0) - (event.seatsTaken ?? 0));
  const full = event.capacity != null && seatsLeft === 0 && !event.registered;

  return (
    <article className="surface flex h-full flex-col overflow-hidden p-0">
      {/* 1 — banner, fixed 16:9 for every card. A staff-uploaded cover image
             fills it when present (with a scrim so the overlays stay legible);
             otherwise the category-toned panel keeps the grid aligned. */}
      <div className={`relative aspect-[16/9] w-full bg-gradient-to-br ${category.tone}`}>
        {event.coverImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/10" />
          </>
        )}
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="badge-pill bg-white/90 text-[#1d1d1f]">{category.label}</span>
            <span className={`badge-pill ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/95 font-heading text-sm font-bold text-[#1d1d1f]"
            >
              {initialsOf(event.speaker?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{event.speaker?.name}</p>
              {event.speaker?.role && (
                <p className="truncate text-[11px] text-white/80">{event.speaker.role}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2 — title + speaker bio */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 font-heading text-base font-semibold leading-snug text-[#1d1d1f]">
            {event.title}
          </h3>
          {event.speaker?.bio && (
            <p className="line-clamp-2 text-xs text-muted">{event.speaker.bio}</p>
          )}
        </div>

        {/* 3 — when / where */}
        <div className="space-y-1.5 rounded-[14px] border border-black/[0.06] bg-black/[0.02] p-3 text-xs text-muted">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{formatEventDate(event)}</span>
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{event.location}</span>
          </p>
          {event.capacity != null && (
            <p className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {status === 'past'
                  ? `${event.seatsTaken ?? 0} attended`
                  : full ? 'Fully booked — join the waitlist at CPDC' : `${seatsLeft} of ${event.capacity} places left`}
              </span>
            </p>
          )}
        </div>

        {/* "why this matches you" — generated from the real match inputs */}
        {match.why && (
          <p className={`text-xs leading-relaxed ${match.recommended ? 'text-[#1d1d1f]' : 'text-muted'}`}>
            {match.why}
          </p>
        )}

        {event.tags?.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {event.tags.slice(0, 4).map((tag) => (
              <li key={tag} className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-medium text-muted">
                {tag}
              </li>
            ))}
          </ul>
        )}

        {/* 4 — footer: match tag left, action right */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
          <span
            className={`badge-pill inline-flex items-center gap-1.5 ${
              match.recommended
                ? 'bg-crimson/10 text-crimson'
                : 'bg-black/[0.04] text-muted'
            }`}
          >
            {match.recommended && <Sparkles className="h-3 w-3" aria-hidden="true" />}
            <span>{match.recommended ? `Recommended · ${match.score}%` : `${match.score}% relevance`}</span>
          </span>

          {event.attended ? (
            <span className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Attended · +{event.xpReward} XP
            </span>
          ) : status === 'past' ? (
            <button
              type="button"
              onClick={() => onOpen?.(event)}
              className="secondary-btn min-h-[44px] text-xs"
            >
              View materials
            </button>
          ) : status === 'live' ? (
            <button
              type="button"
              onClick={() => onCheckIn?.(event)}
              className="crimson-btn min-h-[44px] text-xs"
            >
              Check in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRegister?.(event)}
              disabled={full}
              aria-pressed={Boolean(event.registered)}
              className={`min-h-[44px] text-xs ${event.registered ? 'secondary-btn' : 'crimson-btn'} ${full ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {event.registered ? (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Registered</span>
                </>
              ) : (
                <>
                  <Award className="h-4 w-4" aria-hidden="true" />
                  <span>RSVP · +{event.xpReward} XP</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
