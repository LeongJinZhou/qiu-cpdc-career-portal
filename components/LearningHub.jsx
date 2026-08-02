'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  GraduationCap,
  Hourglass,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSettings } from '@/lib/settings';
import { XP_VALUES } from '@/lib/xp';
import {
  COURSE_CATALOGUE,
  LEARNING_PATHS,
  PROVIDERS,
  courseById,
  courseMatch,
  pathProgress,
  servesFaculty,
  whyRecommended,
} from '@/lib/data/courses';
import {
  decideCourseEnrolment,
  fetchCourseEnrolments,
  submitCourseEnrolment,
} from '@/lib/api';
import CourseCard from '@/components/learning/CourseCard';
import PathCard from '@/components/learning/PathCard';
import CertificateSubmitModal from '@/components/learning/CertificateSubmitModal';
import CourseDetail from '@/components/learning/CourseDetail';
import VerificationQueue from '@/components/learning/VerificationQueue';

const STAFF_ROLES = [
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'PLACEMENT_OFFICER',
  'CAREER_COUNSELOR',
  'CPDC_ADMIN',
  'SUPER_ADMIN',
];
const RECOMMENDED_THRESHOLD = 70;

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'coursera', 'edx', 'linkedin', 'course', 'certificate', 'spec', 'specialization', 'specialisation', 'professional', 'introduction']);

function significantWords(value) {
  return String(value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));
}

/**
 * Bridge from an already-earned badge to a catalogue course.
 *
 * A student who arrives with a certification badge has already done the course;
 * showing it as "not started" here would contradict their own CV. Requiring two
 * shared significant words keeps this conservative — a single common word like
 * "learning" is not enough to claim a match.
 */
function badgeMatchesCourse(badge, course) {
  if (!badge?.title) return false;
  const badgeWords = new Set(significantWords(`${badge.title} ${badge.category ?? ''}`));
  const courseWords = significantWords(`${course.title} ${course.skillBadge}`);
  const shared = new Set(courseWords.filter((word) => badgeWords.has(word)));
  return shared.size >= 2;
}

/**
 * Module 6 — Coursera / External Learning Integration.
 *
 * Three jobs in one surface:
 *   1. Discovery — every catalogue course, with programme-matched ones sorted
 *      first and tagged, and nothing hidden from anyone (Blueprint §12.4).
 *   2. Completion sync — two taps from "I finished this" to a submission that
 *      is Pending verification. Students never self-verify.
 *   3. Curation & verification — the CPDC side: what is listed for whom, and
 *      the queue where certificates actually become XP, badges and CV lines.
 *
 * Cards intentionally reuse the workshop hub's card system (same h-28 plate,
 * same footer button placement) so the two modules read as one product.
 */
export default function LearningHub({ student, activeFaculty, currentRole = 'STUDENT' }) {
  const [settings] = useSettings();
  const isStudent = currentRole === 'STUDENT';
  const isStaff = STAFF_ROLES.includes(currentRole);

  const [activeTab, setActiveTab] = useState(isStaff ? 'catalogue' : 'discover');
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [submitTarget, setSubmitTarget] = useState(null);
  // Opening a course is a separate concern from logging a completion: a student
  // browses detail long before they have a certificate to submit.
  const [detailTarget, setDetailTarget] = useState(null);
  const [notice, setNotice] = useState('');
  const [records, setRecords] = useState([]);
  const [queue, setQueue] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    if (!isStudent && !isStaff) {
      setRecords([]);
      setQueue([]);
      setRecordsLoading(false);
      return;
    }
    setRecordsLoading(true);
    try {
      const data = await fetchCourseEnrolments(currentRole);
      const next = Array.isArray(data?.records) ? data.records : [];
      setRecords(next);
      setQueue(Array.isArray(data?.submissions) ? data.submissions : next);
    } catch (error) {
      setNotice(error.message || 'Could not load course records.');
      setRecords([]);
      setQueue([]);
    } finally {
      setRecordsLoading(false);
    }
  }, [currentRole, isStaff, isStudent]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords, activeFaculty?.id]);

  /**
   * Per-course XP.
   *
   * Each course carries its own value, but Settings exposes a single COURSE
   * number that admins expect to matter. Scaling the course value by how far
   * that dial has moved from the blueprint default honours the setting while
   * keeping a 450 XP specialization worth more than a 2-hour module.
   */
  const xpFor = useCallback((course) => {
    const configured = Number(settings.gamification?.xpValues?.COURSE) || XP_VALUES.COURSE_COMPLETION;
    return Math.round(course.xp * (configured / XP_VALUES.COURSE_COMPLETION));
  }, [settings.gamification?.xpValues?.COURSE]);

  /**
   * Status per course id for the signed-in learner: VERIFIED, PENDING or absent.
   * Derived from the student record so any other view of the same record (CV,
   * dashboard, career path) stays in step.
   */
  const statusById = useMemo(() => {
    const map = {};
    for (const course of COURSE_CATALOGUE) {
      if ((student?.badges ?? []).some((badge) => badgeMatchesCourse(badge, course))) {
        map[course.id] = 'VERIFIED';
      }
    }
    for (const record of records) {
      if (!record?.courseId) continue;
      if (record.status === 'RETURNED') {
        delete map[record.courseId];
        continue;
      }
      map[record.courseId] = record.verified ? 'VERIFIED' : 'PENDING';
    }
    return map;
  }, [records, student?.badges]);

  const evidenceById = useMemo(() => {
    const map = {};
    for (const record of records) {
      if (record?.courseId && record.evidence) map[record.courseId] = record.evidence;
    }
    return map;
  }, [records]);

  const matchContext = useMemo(() => ({
    facultyId: activeFaculty?.id,
    programme: student?.programme,
    year: student?.year,
    interests: `${student?.careerTargets ?? ''} ${student?.industries ?? ''} ${(student?.skills ?? []).join(' ')}`,
    gapTags: student?.diagnosticResult?.gapTags,
    weights: settings.matchWeights,
  }), [activeFaculty?.id, student, settings.matchWeights]);

  /**
   * Scored catalogue. Matched courses sort to the top and carry a visible
   * "Recommended for you" tag plus a one-line reason — but every course stays
   * in the list, because a business student is allowed to learn Python.
   */
  const scoredCourses = useMemo(() => COURSE_CATALOGUE
    .map((course) => {
      const { score, reasons } = courseMatch(course, matchContext);
      const facultyServed = servesFaculty(course, activeFaculty?.id);
      return {
        course,
        score,
        reasons,
        recommended: facultyServed && score >= RECOMMENDED_THRESHOLD,
        why: whyRecommended(course, {
          programme: student?.programme,
          year: student?.year,
          gapTags: student?.diagnosticResult?.gapTags,
          facultyId: activeFaculty?.id,
        }),
      };
    })
    .sort((a, b) => b.score - a.score), [matchContext, activeFaculty?.id, student?.programme, student?.year, student?.diagnosticResult?.gapTags]);

  const visibleCourses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoredCourses.filter(({ course }) => {
      if (providerFilter !== 'all' && course.provider !== providerFilter) return false;
      if (!needle) return true;
      return `${course.title} ${course.taughtBy} ${course.skillBadge} ${course.tags.join(' ')}`
        .toLowerCase()
        .includes(needle);
    });
  }, [scoredCourses, query, providerFilter]);

  const myRecords = useMemo(() => records
    .map((record) => ({ record, course: courseById(record.courseId) }))
    .filter((entry) => entry.course), [records]);

  const pendingCount = myRecords.filter((entry) => entry.record.status === 'PENDING').length;
  const verifiedCount = Object.values(statusById).filter((value) => value === 'VERIFIED').length;

  const sortedPaths = useMemo(() => [...LEARNING_PATHS].sort((a, b) => {
    const aServes = servesFaculty(a, activeFaculty?.id) ? 1 : 0;
    const bServes = servesFaculty(b, activeFaculty?.id) ? 1 : 0;
    return bServes - aServes;
  }), [activeFaculty?.id]);

  // --- Student actions -----------------------------------------------------

  const handleSubmitCertificate = async (evidence) => {
    const course = submitTarget;
    if (!course) return;
    try {
      const record = await submitCourseEnrolment({
        courseId: course.id,
        title: course.title,
        provider: PROVIDERS[course.provider]?.label ?? course.provider,
        skillTag: course.skillBadge,
        evidenceUrl: evidence.type === 'link' ? evidence.value : null,
        evidenceName: evidence.type === 'file' ? evidence.value : null,
        evidenceData: evidence.type === 'file' ? evidence.data : null,
      });
      setRecords((previous) => [
        record,
        ...previous.filter((item) => item.courseId !== course.id),
      ]);
      setSubmitTarget(null);
      setNotice(`${course.title} submitted. It is now Pending verification; CPDC must approve the evidence before XP, the badge, and the CV line are granted.`);
    } catch (error) {
      setNotice(error.message || 'Could not submit this certificate.');
    }
  };

  // --- Staff actions -------------------------------------------------------

  const handleDecision = async (submissionId, decision) => {
    const item = queue.find((entry) => entry.id === submissionId);
    try {
      const data = await decideCourseEnrolment(submissionId, decision, currentRole);
      const saved = data?.record ?? { ...item, status: decision };
      setQueue((previous) => previous.map((entry) => (
        entry.id === submissionId ? saved : entry
      )));
      if (decision === 'VERIFIED') confetti({ particleCount: 50, spread: 55 });
      const course = item ? courseById(item.courseId) : null;
      setNotice(decision === 'VERIFIED'
        ? `Verified: ${course?.title ?? 'certificate'} for ${item?.studentName ?? 'the student'}. The database awarded XP, a badge, and the CV skill line.`
        : `Returned to ${item?.studentName ?? 'the student'} with a request for clearer evidence.`);
    } catch (error) {
      setNotice(error.message || 'Could not save the verification decision.');
    }
  };

  const scopedQueue = useMemo(() => (
    currentRole === 'FACULTY_COORDINATOR'
      ? queue.filter((item) => item.facultyId === activeFaculty?.id)
      : queue
  ), [queue, currentRole, activeFaculty?.id]);

  const tabs = isStaff
    ? [
      { id: 'catalogue', label: 'Curated catalogue' },
      { id: 'paths', label: 'Learning paths' },
      { id: 'verify', label: `Verification (${scopedQueue.filter((item) => item.status === 'PENDING').length})` },
    ]
    : isStudent
      ? [
        { id: 'discover', label: 'Discover courses' },
        { id: 'paths', label: 'Learning paths' },
        { id: 'my-learning', label: `My learning (${myRecords.length})` },
      ]
      : [
        { id: 'discover', label: 'Discover courses' },
        { id: 'paths', label: 'Learning paths' },
      ];

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Header + sub-nav */}
      <div className="flex flex-col justify-between gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-end">
        <div>
          <h2 className="section-title flex items-center gap-2.5">
            <GraduationCap className="h-6 w-6 text-crimson" aria-hidden="true" />
            <span>Courses &amp; Learning Paths</span>
          </h2>
          <p className="section-subtitle mt-1.5 max-w-lg">
            {isStaff
              ? 'Curate what each programme sees on Coursera, edX and LinkedIn Learning, and verify the certificates students submit.'
            : isStudent
              ? 'External courses matched to your programme, plus CPDC learning paths. Finish one, submit the certificate, and it becomes a badge, a CV line and XP after verification.'
              : 'Browse the university course catalogue and learning paths. Certificate submissions are available only from the student account.'}
          </p>
        </div>

        <div
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-black/10 bg-black/[0.03] p-1"
          role="tablist"
          aria-label="Learning hub views"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition ${
                activeTab === tab.id ? 'bg-crimson text-white' : 'text-muted hover:text-[#1d1d1f]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700" role="status">
          {notice}
        </div>
      )}

      {/* DISCOVERY / CATALOGUE */}
      {(activeTab === 'discover' || activeTab === 'catalogue') && (
        <div className="space-y-6">
          {isStudent && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { icon: BookOpen, label: 'Courses listed for you', value: scoredCourses.filter((entry) => entry.recommended).length },
                { icon: Hourglass, label: 'Awaiting verification', value: pendingCount },
                { icon: Award, label: 'Verified certificates', value: verifiedCount },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="surface flex items-center gap-3 p-5">
                    <Icon className="h-5 w-5 shrink-0 text-crimson" aria-hidden="true" />
                    <div>
                      <p className="font-heading text-xl font-bold text-[#1d1d1f]">{stat.value}</p>
                      <p className="text-xs text-muted">{stat.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
              <span>
                Courses matched to {activeFaculty?.name ?? 'your faculty'} are sorted first and tagged
                &ldquo;Recommended for you&rdquo;. Nothing is hidden — scroll on and take anything in the catalogue.
              </span>
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <label htmlFor="course-search" className="sr-only">Search courses</label>
              <input
                id="course-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, partner or skill"
                className="h-11 w-full rounded-[18px] border border-black/10 bg-black/[0.04] pl-11 pr-4 text-sm text-[#1d1d1f] transition placeholder:text-black/20 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-black/10 bg-black/[0.03] p-1">
              {[{ id: 'all', label: 'All providers' }, ...Object.values(PROVIDERS)].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={providerFilter === option.id}
                  onClick={() => setProviderFilter(option.id)}
                  className={`min-h-[44px] whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition ${
                    providerFilter === option.id ? 'bg-crimson text-white' : 'text-muted hover:text-[#1d1d1f]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {visibleCourses.length === 0 ? (
            <div className="surface p-10 text-center">
              <p className="font-heading text-base font-semibold text-[#1d1d1f]">No courses match that search</p>
              <p className="mt-1 text-sm text-muted">Try a skill name like &ldquo;analytics&rdquo;, or clear the provider filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visibleCourses.map(({ course, score, recommended, why }) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  score={score}
                  recommended={recommended}
                  why={why}
                  xpValue={xpFor(course)}
                  status={isStaff ? 'AVAILABLE' : statusById[course.id] ?? 'AVAILABLE'}
                  evidence={evidenceById[course.id]}
                  onSubmit={isStudent ? setSubmitTarget : undefined}
                  onOpen={() => setDetailTarget({ course, score, why, recommended })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* LEARNING PATHS */}
      {activeTab === 'paths' && (
        <div className="space-y-6">
          <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-heading text-base font-semibold text-[#1d1d1f]">CPDC learning paths</h3>
              <p className="mt-0.5 text-sm text-muted">
                Three to five courses grouped into a themed route, with a bonus once the whole path is verified.
              </p>
            </div>
            <span className="badge-pill flex items-center gap-1 whitespace-nowrap border border-black/10 bg-black/[0.03] text-muted">
              <Layers className="h-3 w-3" aria-hidden="true" />
              {LEARNING_PATHS.length} paths
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sortedPaths.map((path) => (
              <PathCard
                key={path.id}
                path={path}
                statusById={isStaff ? {} : statusById}
                recommended={servesFaculty(path, activeFaculty?.id)}
                onSelectCourse={isStudent ? (course) => {
                  if (!statusById[course.id]) setSubmitTarget(course);
                } : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* MY LEARNING (learner) */}
      {activeTab === 'my-learning' && isStudent && (
        <div className="space-y-6">
          {recordsLoading ? (
            <div className="surface flex items-center justify-center gap-2 p-10 text-sm text-muted">
              <Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" /> Loading your persisted course records…
            </div>
          ) : myRecords.length === 0 && verifiedCount === 0 ? (
            <div className="surface flex flex-col items-center gap-2 p-10 text-center">
              <BookOpen className="h-8 w-8 text-muted" aria-hidden="true" />
              <p className="font-heading text-base font-semibold text-[#1d1d1f]">Nothing submitted yet</p>
              <p className="max-w-sm text-sm text-muted">
                Finished a course on Coursera, edX or LinkedIn Learning? Open Discover, tap the course, attach your
                certificate — two taps and it is with CPDC.
              </p>
              <button type="button" onClick={() => setActiveTab('discover')} className="crimson-btn mt-2 min-h-[44px] text-xs">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>Browse the catalogue</span>
              </button>
            </div>
          ) : (
            <>
              <div className="surface space-y-1 p-5">
                <h3 className="font-heading text-base font-semibold text-[#1d1d1f]">Your certificates</h3>
                <p className="text-sm text-muted">
                  Verification is a CPDC action. A pending certificate earns nothing until an officer or your faculty
                  coordinator approves it.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {COURSE_CATALOGUE.filter((course) => statusById[course.id]).map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    status={statusById[course.id]}
                    xpValue={xpFor(course)}
                    evidence={evidenceById[course.id]}
                  />
                ))}
              </div>

              <div className="surface space-y-3 p-5">
                <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-[#1d1d1f]">
                  <Trophy className="h-4 w-4 text-crimson" aria-hidden="true" />
                  <span>Path progress</span>
                </h3>
                <ul className="space-y-2">
                  {LEARNING_PATHS.map((path) => {
                    const progress = pathProgress(path, statusById);
                    return (
                      <li key={path.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#1d1d1f]">{path.title}</span>
                        <span className="text-muted">{progress.verified}/{progress.total} verified · {progress.percent}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {/* VERIFICATION (staff) */}
      {activeTab === 'verify' && isStaff && (
        <VerificationQueue
          submissions={scopedQueue}
          scopeLabel={currentRole === 'FACULTY_COORDINATOR' ? (activeFaculty?.name ?? 'your faculty') : 'all faculties'}
          actorRole={currentRole === 'FACULTY_COORDINATOR' ? 'Faculty Coordinator' : currentRole === 'SUPER_ADMIN' ? 'Super-Admin' : 'CPDC Officer'}
          onDecide={handleDecision}
        />
      )}

      {isStaff && activeTab === 'catalogue' && (
        <div className="surface flex items-start gap-2 p-5 text-xs leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
          <span>
            Staff see the catalogue read-only here — this is what a student in {activeFaculty?.name ?? 'this faculty'} sees,
            in their order. Certificates are cleared in the Verification tab, never from a course card.
          </span>
        </div>
      )}

      {detailTarget && (
        <CourseDetail
          course={detailTarget.course}
          score={detailTarget.score}
          why={detailTarget.why}
          recommended={detailTarget.recommended}
          xpValue={xpFor(detailTarget.course)}
          status={statusById[detailTarget.course.id] ?? 'AVAILABLE'}
          onClose={() => setDetailTarget(null)}
          // Staff browse the catalogue to curate it; only a student logs a
          // completion, so the CTA is theirs alone.
          onSubmit={isStudent ? (course) => {
            setDetailTarget(null);
            setSubmitTarget(course);
          } : undefined}
        />
      )}

      {submitTarget && (
        <CertificateSubmitModal
          course={submitTarget}
          onClose={() => setSubmitTarget(null)}
          onSubmit={handleSubmitCertificate}
        />
      )}
    </div>
  );
}
