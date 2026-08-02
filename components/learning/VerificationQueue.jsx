'use client';

import { CheckCircle2, ExternalLink, FileText, Hourglass, Inbox, RotateCcw, ShieldCheck } from 'lucide-react';
import { PROVIDERS, courseById } from '@/lib/data/courses';

const DECISION = {
  VERIFIED: { label: 'Verified', icon: CheckCircle2, className: 'border-emerald-500/30 bg-emerald-50/60 text-emerald-700' },
  RETURNED: { label: 'Returned to student', icon: RotateCcw, className: 'border-amber-500/30 bg-amber-50/70 text-amber-800' },
};

/**
 * The coordinator side of completion sync (Blueprint Module 6).
 *
 * Verification is a staff-only action, so this panel is the only place a
 * certificate can move from Pending to Verified. Each decision is attributed to
 * the acting role — the record has to say who cleared it, not just that it was
 * cleared.
 */
export default function VerificationQueue({ submissions, scopeLabel, onDecide, actorRole }) {
  const pending = submissions.filter((item) => item.status === 'PENDING');
  const decided = submissions.filter((item) => item.status !== 'PENDING');

  return (
    <div className="space-y-6">
      <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-[#1d1d1f]">Certificate verification queue</h3>
          <p className="mt-0.5 text-sm text-muted">
            Students submit evidence; XP, badges and CV lines are granted only when you approve. Scope: {scopeLabel}.
          </p>
        </div>
        <span className="badge-pill whitespace-nowrap border border-amber-500/30 bg-amber-500/15 text-amber-800">
          {pending.length} awaiting review
        </span>
      </div>

      {pending.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 p-10 text-center">
          <Inbox className="h-8 w-8 text-muted" aria-hidden="true" />
          <p className="font-heading text-base font-semibold text-[#1d1d1f]">Queue clear</p>
          <p className="max-w-sm text-sm text-muted">
            No certificates are waiting on {scopeLabel}. New submissions land here the moment a student attaches evidence.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {pending.map((item) => {
            const course = courseById(item.courseId);
            const providerLabel = course ? PROVIDERS[course.provider]?.label ?? course.provider : 'External provider';
            return (
              <li key={item.id} className="surface space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading text-base font-semibold leading-snug text-[#1d1d1f]">
                      {course?.title ?? item.courseId}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {providerLabel} · {course?.taughtBy ?? 'Unknown partner'}
                    </p>
                  </div>
                  <span className="badge-pill flex items-center gap-1 whitespace-nowrap border border-amber-500/30 bg-amber-500/15 text-amber-800">
                    <Hourglass className="h-3 w-3" aria-hidden="true" />
                    Pending
                  </span>
                </div>

                <dl className="grid grid-cols-1 gap-2 rounded-[18px] border border-black/[0.06] bg-black/[0.03] p-4 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Student</dt>
                    <dd className="font-semibold text-[#1d1d1f]">{item.studentName} · {item.studentId}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Programme</dt>
                    <dd className="font-semibold text-[#1d1d1f]">{item.programme}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Submitted</dt>
                    <dd className="font-semibold text-[#1d1d1f]">{item.submittedAt}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">Evidence</dt>
                    <dd className="truncate font-semibold text-[#1d1d1f]">
                      {item.evidenceType === 'link' ? (
                        <a
                          href={item.evidenceValue}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-crimson underline-offset-2 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">Open verification link</span>
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {item.evidenceData ? (
                            <a
                              href={item.evidenceData}
                              download={item.evidenceName || 'certificate-evidence'}
                              className="text-crimson underline-offset-2 hover:underline"
                            >
                              Download {item.evidenceName || 'certificate file'}
                            </a>
                          ) : <span className="truncate">{item.evidenceValue}</span>}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onDecide(item.id, 'VERIFIED')}
                    className="crimson-btn min-h-[44px] flex-1 justify-center text-xs"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Verify &amp; grant {course ? `+${course.xp} XP` : 'XP'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecide(item.id, 'RETURNED')}
                    className="secondary-btn min-h-[44px] flex-1 justify-center text-xs"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>Return for more evidence</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {decided.length > 0 && (
        <div className="surface space-y-3 p-5">
          <h4 className="font-heading text-sm font-semibold text-[#1d1d1f]">Decided this session</h4>
          <ul className="space-y-2">
            {decided.map((item) => {
              const course = courseById(item.courseId);
              const decision = DECISION[item.status] ?? DECISION.RETURNED;
              const Icon = decision.icon;
              return (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${decision.className}`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.studentName} — {course?.title ?? item.courseId}</span>
                  </span>
                  <span className="whitespace-nowrap">{decision.label} by {actorRole}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
