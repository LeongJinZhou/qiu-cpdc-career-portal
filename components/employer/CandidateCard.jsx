'use client';

import {
  Award,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  CheckCircle2,
  Coffee,
  GraduationCap,
  Mail,
  Wrench,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Link from 'next/link';

// Card language is deliberately shared with components/TalentFeed.jsx: initials
// avatar with a soft deterministic tint, name + class-of line, project title,
// programme/faculty line, skill pills, badge pills, then the action row. The
// blueprint's biggest complaint is modules inventing their own layout, so if
// TalentFeed's card changes, change this one with it.
const AVATAR_TINTS = [
  'bg-crimson/10 text-crimson border-crimson/20',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-rose-50 text-rose-700 border-rose-200',
];

export function tintFor(id) {
  let sum = 0;
  const key = String(id ?? '');
  for (let i = 0; i < key.length; i += 1) sum += key.charCodeAt(i);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

export function initialsOf(name) {
  return String(name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/**
 * One opted-in candidate.
 *
 * `match` is optional — when a job description has been pasted it carries the
 * deterministic score and the reasons behind it (see rankCandidateAgainstJD).
 */
export default function CandidateCard({
  candidate,
  match = null,
  shortlisted = false,
  invited = null,
  onShortlist,
  onInvite,
}) {
  const topSkills = (candidate.skills ?? []).slice(0, 3);
  const extraSkills = Math.max(0, (candidate.skills ?? []).length - topSkills.length);
  const matchedSkills = new Set(match?.matchedSkills ?? []);

  return (
    <article className="surface flex h-full flex-col gap-4 p-5 sm:p-6">
      {/* Identity */}
      <div className="flex items-start gap-3">
        <Avatar name={candidate.name} src={candidate.avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#1d1d1f]">{candidate.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{candidate.gradYear ? `Class of ${candidate.gradYear}` : 'QIU student'}</span>
          </p>
        </div>
        {match && (
          <span
            className="badge-pill shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-700 tabular-nums"
            title="Deterministic match score against the pasted job description"
          >
            {match.score}% match
          </span>
        )}
      </div>

      {/* FYP thumbnail — a monogram tile standing in for the poster image, same
          role the project image plays on the student's public showcase card. */}
      <div className="flex items-start gap-3 rounded-[14px] border border-black/[0.06] bg-black/[0.02] p-3">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] border font-heading text-base font-bold ${tintFor(candidate.fypTitle ?? candidate.id)}`}
          aria-hidden="true"
        >
          {initialsOf(candidate.fypTitle)}
        </div>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">Final Year Project</p>
          <h3 className="mt-0.5 font-heading text-sm font-semibold leading-snug text-[#1d1d1f] line-clamp-2">
            {candidate.fypTitle}
          </h3>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted">
        <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson" aria-hidden="true" />
        <span>
          {candidate.courseCode ? <span className="font-semibold text-[#1d1d1f]">{candidate.courseCode}</span> : null}
          {candidate.courseCode ? ' · ' : ''}{candidate.programme} · {candidate.faculty}
        </span>
      </p>

      {/* Top 3 skills */}
      {topSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          {topSkills.map((skill) => {
            const hit = matchedSkills.has(skill);
            return (
              <span
                key={skill}
                className={`badge-pill border ${hit ? 'border-crimson/25 bg-crimson/10 text-crimson' : 'border-black/10 bg-black/[0.03] text-[#424245]'}`}
              >
                {/* Never colour-only: matched skills are also marked in text. */}
                {skill}
                {hit ? ' · in JD' : ''}
              </span>
            );
          })}
          {extraSkills > 0 && <span className="text-xs text-muted">+{extraSkills} more</span>}
        </div>
      )}

      {/* Badges */}
      {candidate.badges?.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {candidate.badges.slice(0, 3).map((badge) => (
            <span
              key={badge}
              className="badge-pill inline-flex items-center gap-1 border border-amber-200 bg-amber-50 text-amber-700"
            >
              <Award className="h-3 w-3" aria-hidden="true" />
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Why this candidate matched */}
      {match && match.reasons.length > 0 && (
        <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-800">Why this matched</p>
          <ul className="mt-1.5 space-y-1">
            {match.reasons.map((reason) => (
              <li key={reason.facet} className="flex gap-1.5 text-xs leading-relaxed text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{reason.facet} (+{reason.points}):</span> {reason.detail}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.7rem] text-emerald-800">
            Covers {match.coverage} of {match.jdTermCount} keywords in your description.
          </p>
        </div>
      )}

      {match && match.reasons.length === 0 && (
        <p className="rounded-[14px] border border-black/[0.06] bg-black/[0.02] p-3 text-xs text-muted">
          No overlap found between this profile and your job description.
        </p>
      )}

      {/* Actions — invites are the only channel to a student. */}
      <div className="mt-auto flex flex-wrap gap-2 border-t border-black/[0.06] pt-4">
        <Link href={`/talent/${candidate.id}`} className="secondary-btn min-h-[44px] w-full justify-center text-xs">
          View full profile
        </Link>
        <button
          type="button"
          onClick={() => onInvite?.(candidate, 'interview')}
          disabled={invited === 'interview'}
          className="crimson-btn min-h-[44px] flex-1 justify-center text-xs disabled:cursor-default disabled:opacity-60"
        >
          {invited === 'interview' ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Invite sent</span>
            </>
          ) : (
            <>
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Invite to interview</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => onInvite?.(candidate, 'coffee')}
          disabled={invited === 'coffee'}
          className="secondary-btn min-h-[44px] flex-1 justify-center text-xs disabled:cursor-default disabled:opacity-60"
        >
          {invited === 'coffee' ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Requested</span>
            </>
          ) : (
            <>
              <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Coffee chat</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => onShortlist?.(candidate)}
          aria-pressed={shortlisted}
          className="secondary-btn min-h-[44px] justify-center text-xs"
        >
          {shortlisted ? (
            <>
              <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Save</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}
