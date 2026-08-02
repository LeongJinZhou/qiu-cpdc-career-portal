'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BookOpenCheck,
  Compass,
  EyeOff,
  FileText,
  GraduationCap,
  Lock,
  MapPin,
  Stethoscope,
  UserRound,
} from 'lucide-react';

/**
 * One student's record, exactly as the acting role is entitled to see it.
 *
 * This component renders whatever /api/students/[id]/profile returns and
 * nothing else. It does not know the visibility matrix and must not: the server
 * has already removed the layers this role may not read, and sent a sentence
 * explaining each omission. If a section is missing from `profile`, it is
 * missing because the server withheld it.
 */

const LAYER_ICONS = {
  identity: UserRound,
  gamification: Award,
  logbook: MapPin,
  cv: FileText,
  diagnostics: Stethoscope,
  fyp: GraduationCap,
  careerTargets: Compass,
};

function Card({ layer, title, description, children }) {
  const Icon = LAYER_ICONS[layer] ?? BookOpenCheck;
  return (
    <section className="surface space-y-4 p-5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-crimson" aria-hidden="true" />
        <div>
          <h3 className="font-heading text-base font-bold text-[#1d1d1f]">{title}</h3>
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** A value the platform does not hold prints as "—", never as an invented number. */
function Row({ label, value }) {
  const display = value === null || value === undefined || value === '' ? '—' : value;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] py-2.5 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="max-w-[62%] text-right text-sm font-medium text-[#1d1d1f]">{display}</span>
    </div>
  );
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function TagList({ items, empty }) {
  if (!items?.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="badge-pill border border-black/10 bg-black/[0.03] text-[#1d1d1f]">{item}</li>
      ))}
    </ul>
  );
}

export default function StudentRecord({ studentId, currentRole }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/profile`, {
        cache: 'no-store',
        headers: currentRole ? { 'x-demo-role': currentRole } : {},
      });
      const payload = await response.json();
      if (!response.ok) {
        setError({ status: response.status, message: payload?.error || 'This record could not be opened.' });
        setRecord(null);
        return;
      }
      setRecord(payload);
    } catch {
      setError({ status: 0, message: 'The record service could not be reached. Check your connection and try again.' });
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [studentId, currentRole]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="surface p-10 text-center text-sm text-muted" role="status">Opening the student record…</div>;
  }

  if (error) {
    const isScope = error.status === 403;
    const isMissing = error.status === 404;
    return (
      <div className="surface space-y-3 p-8 text-center" role="alert">
        <Lock className="mx-auto h-7 w-7 text-crimson" aria-hidden="true" />
        <h3 className="font-heading text-lg font-bold text-[#1d1d1f]">
          {isScope ? 'This student is outside your area' : isMissing ? 'No such student' : 'The record could not be opened'}
        </h3>
        <p className="mx-auto max-w-lg text-sm text-muted">
          {isScope
            ? 'Your role covers a specific faculty, programme or set of assigned students, and this student is not one of them. If you need access, ask a CPDC administrator to update your assignment.'
            : isMissing
              ? 'No student matches this id or matric number. Check the number and search again.'
              : error.message}
        </p>
        {!isScope && !isMissing ? (
          <button type="button" onClick={load} className="secondary-btn mx-auto min-h-[44px] px-3.5 text-xs">Try again</button>
        ) : null}
      </div>
    );
  }

  const profile = record?.profile ?? {};
  const header = record?.header ?? {};

  return (
    <div className="space-y-5">
      <div className="surface space-y-2 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">Student record</p>
        <h2 className="font-heading text-2xl font-bold text-[#1d1d1f]">{header.name}</h2>
        <p className="text-sm text-muted">
          {header.matricNo}
          {header.programme ? ` · ${header.programme}` : ''}
          {header.year ? ` · Year ${header.year}` : ''}
        </p>
        <p className="text-xs text-muted">
          You are reading this record as <strong className="font-semibold text-[#1d1d1f]">{String(record.role).replaceAll('_', ' ').toLowerCase()}</strong>.
          {' '}Sections below are the ones your role is responsible for.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {profile.identity ? (
          <Card layer="identity" title="Who they are" description="Enrolment details held by the university.">
            <div>
              <Row label="Matric number" value={profile.identity.matricNo} />
              <Row label="Full name" value={profile.identity.name} />
              <Row label="Programme" value={profile.identity.programme ?? header.programme} />
              <Row label="Faculty" value={header.faculty} />
              <Row label="Year of study" value={profile.identity.year} />
              <Row label="Intake" value={profile.identity.intake} />
              <Row label="University email" value={profile.identity.email} />
              <Row label="Phone" value={profile.identity.phone} />
            </div>
          </Card>
        ) : null}

        {profile.logbook ? (
          <Card layer="logbook" title="Fieldwork and placement hours" description="Logbook entries and the hours a supervisor has approved.">
            <div>
              <Row label="Approved hours" value={profile.logbook.hoursCompleted} />
              <Row label="Hours required" value={profile.logbook.hoursRequired ?? '— (not recorded)'} />
              <Row label="Entries submitted" value={profile.logbook.entries.length} />
            </div>
            <p className="flex items-start gap-2 rounded-[14px] border border-black/10 bg-black/[0.02] p-3 text-xs leading-relaxed text-muted">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{record.gpsNote}</span>
            </p>
            {profile.logbook.entries.length ? (
              <ul className="divide-y divide-black/[0.06]">
                {profile.logbook.entries.map((entry) => (
                  <li key={entry.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-medium text-[#1d1d1f]">{entry.title}</p>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">{entry.hours} h</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(entry.entryDate) ?? 'No date'} · {String(entry.status).toLowerCase()}
                      {entry.supervisorName ? ` · signed off by ${entry.supervisorName}` : ''}
                    </p>
                    {record.gpsVisible && entry.latitude !== undefined && entry.latitude !== null ? (
                      <p className="mt-1 text-xs text-muted">Check-in location: {entry.latitude.toFixed(4)}, {entry.longitude?.toFixed(4)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No logbook entries have been submitted yet. Ask the student to record their first placement day.</p>
            )}
          </Card>
        ) : null}

        {profile.cv ? (
          <Card layer="cv" title="CV, skills and certificates" description="What the student can evidence to an employer.">
            <div>
              <Row label="ATS score" value={profile.cv.atsScore ?? '— (not stored by the platform)'} />
              <Row label="Verified certificates" value={profile.cv.certifications.length} />
              <Row label="Job applications" value={profile.cv.experience.length} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Verified skills</p>
              <TagList items={profile.cv.verifiedSkills} empty="No skills have been verified yet." />
            </div>
            {profile.cv.manualSections && Object.values(profile.cv.manualSections).some((entries) => entries?.length) ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Student-authored resume sections</p>
                <ul className="space-y-2">
                  {Object.entries(profile.cv.manualSections).flatMap(([section, entries]) => (entries ?? []).map((entry) => (
                    <li key={`${section}-${entry.id}`} className="rounded-[12px] border border-black/10 bg-black/[0.02] p-3 text-sm">
                      <p className="font-medium text-[#1d1d1f]">{entry.title}{entry.organisation ? ` · ${entry.organisation}` : ''}</p>
                      {entry.description ? <p className="mt-1 text-xs leading-relaxed text-muted">{entry.description}</p> : null}
                    </li>
                  )))}
                </ul>
              </div>
            ) : null}
            {profile.cv.certifications.length ? (
              <ul className="divide-y divide-black/[0.06]">
                {profile.cv.certifications.map((certification) => (
                  <li key={certification.id} className="py-2.5">
                    <p className="font-medium text-[#1d1d1f]">{certification.title}</p>
                    <p className="text-xs text-muted">
                      {certification.provider ?? 'Provider not recorded'}
                      {formatDate(certification.verifiedAt) ? ` · verified ${formatDate(certification.verifiedAt)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : null}

        {profile.diagnostics ? (
          <Card layer="diagnostics" title="Skills diagnostic results" description="The student's most recent self-assessment and the gaps it found.">
            {profile.diagnostics.scores ? (
              <div>
                <Row label="Latest score" value={`${profile.diagnostics.scores.score}%`} />
                <Row label="Result" value={profile.diagnostics.scores.passed ? 'Passed' : 'Not yet passed'} />
                <Row label="Taken on" value={formatDate(profile.diagnostics.scores.takenAt)} />
                <Row label="Attempts recorded" value={profile.diagnostics.scores.attempts} />
              </div>
            ) : (
              <p className="text-sm text-muted">This student has not taken a skills diagnostic yet. Suggest one at their next appointment.</p>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Skill gaps to work on</p>
              <TagList items={profile.diagnostics.gaps} empty="No gaps recorded." />
            </div>
            {profile.diagnostics.assessmentAttempts?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Uploaded assessment attempts</p>
                <ul className="divide-y divide-black/[0.06]">
                  {profile.diagnostics.assessmentAttempts.map((attempt) => (
                    <li key={attempt.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0"><span className="block font-medium text-[#1d1d1f]">{attempt.title}</span><span className="text-xs text-muted">{formatDate(attempt.submittedAt)}</span></span>
                      <span className={attempt.passed ? 'text-emerald-700' : 'text-amber-700'}>{attempt.score}% · {attempt.passed ? 'passed' : 'not passed'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ) : null}

        {'fyp' in profile ? (
          <Card layer="fyp" title="Final Year Project" description="The project record and its review decision.">
            {profile.fyp ? (
              <>
                <div>
                  <Row label="Title" value={profile.fyp.title} />
                  <Row label="Supervisor" value={profile.fyp.supervisorName ?? 'Not recorded'} />
                  <Row label="Status" value={String(profile.fyp.status).replaceAll('_', ' ').toLowerCase()} />
                  <Row label="Reviewed by" value={profile.fyp.reviewerName} />
                  <Row label="Reviewed on" value={formatDate(profile.fyp.reviewedAt)} />
                  <Row label="Shown in public showcase" value={profile.fyp.publicOptIn ? 'Yes, the student opted in' : 'No'} />
                </div>
                {profile.fyp.abstract ? <p className="rounded-[12px] border border-black/10 bg-black/[0.02] p-3 text-sm leading-relaxed text-muted"><span className="font-semibold text-[#1d1d1f]">Abstract: </span>{profile.fyp.abstract}</p> : null}
                <div className="flex flex-wrap gap-3 text-xs font-semibold">{profile.fyp.repositoryUrl ? <a href={profile.fyp.repositoryUrl} target="_blank" rel="noreferrer" className="text-crimson hover:underline">Open repository ↗</a> : null}{profile.fyp.liveUrl ? <a href={profile.fyp.liveUrl} target="_blank" rel="noreferrer" className="text-crimson hover:underline">Open live demo ↗</a> : null}</div>
              </>
            ) : (
              <p className="text-sm text-muted">No Final Year Project has been submitted yet.</p>
            )}
          </Card>
        ) : null}

        {profile.gamification ? (
          <Card layer="gamification" title="Engagement and rewards" description="Points earned for completed career activities.">
            <div>
              <Row label="Total points" value={profile.gamification.xp} />
              <Row label="Tier" value={profile.gamification.tier} />
              <Row label="Badges earned" value={profile.gamification.badges.length} />
            </div>
            <TagList items={profile.gamification.badges.map((badge) => badge.title)} empty="No badges earned yet." />
          </Card>
        ) : null}

        {profile.careerTargets ? (
          <Card layer="careerTargets" title="Career goals and visibility" description="What the student is aiming for, and whether employers can find them.">
            <div>
              <Row label="Target roles" value={profile.careerTargets.targetRoles} />
              <Row label="Industries" value={profile.careerTargets.industries} />
              <Row label="Portfolio link" value={profile.careerTargets.portfolioUrl} />
              <Row label="LinkedIn link" value={profile.careerTargets.linkedinUrl} />
              <Row label="About the student" value={profile.careerTargets.bio} />
              <Row
                label="Visible to employers"
                value={profile.careerTargets.publicTalent ? 'Yes — the student opted in' : 'No — the student has not opted in'}
              />
            </div>
          </Card>
        ) : null}
      </div>

      {record.hiddenLayers?.length ? (
        <section className="surface space-y-3 p-5">
          <div className="flex items-start gap-3">
            <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <h3 className="font-heading text-base font-bold text-[#1d1d1f]">What is not shown to you, and why</h3>
              <p className="mt-0.5 text-sm text-muted">
                A student record has seven parts. Your role receives {record.layers.length} of them. The rest are listed here so
                nothing is missing without an explanation — if you need one of them, ask a CPDC administrator.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {record.hiddenLayers.map((hidden) => (
              <li key={hidden.layer} className="rounded-[14px] border border-black/10 bg-black/[0.02] p-3">
                <p className="text-sm font-semibold text-[#1d1d1f]">{hidden.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{hidden.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
