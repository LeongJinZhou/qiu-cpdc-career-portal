'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Target,
  Sparkles,
  RotateCcw,
  Calendar,
  Award,
  TrendingUp,
  History,
} from 'lucide-react';
import { diagnosticFor, scoreDiagnostic } from '@/lib/data/diagnostics';
import { WORKSHOPS } from '@/lib/data/facultyData';
import { XP_VALUES } from '@/lib/xp';
import { fetchDiagnostics, saveDiagnostic } from '@/lib/api';
import { emitXpUpdated } from '@/lib/xp-events';
import { workshopMatch } from '@/lib/matching';

/**
 * Skills Diagnostic Tests (Blueprint Module 8).
 *
 * Three phases in one route: intro -> question flow -> results. The results
 * turn weak categories into rules-based workshop recommendations (matching
 * diagnostic gap tags to workshop/profile signals) and, on a pass, award a
 * badge + Diagnostic XP through the server-scored diagnostic workflow.
 */
export default function DiagnosticTests({ student, setStudent, activeFaculty }) {
  const test = useMemo(() => diagnosticFor(activeFaculty?.id), [activeFaculty?.id]);

  const [phase, setPhase] = useState('intro'); // intro | quiz | results
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [awarded, setAwarded] = useState(false);

  // Persisted history from the database: the radar and gap analysis survive a
  // refresh, and the first-ever attempt anchors the longitudinal overlay.
  const [savedResult, setSavedResult] = useState(null); // the attempt being shown
  const [baseline, setBaseline] = useState(null); // first-ever attempt
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPhase('intro');
    setIndex(0);
    setAnswers({});
    setAwarded(false);
    setSavedResult(null);
    setBaseline(null);
    setHistory([]);
    fetchDiagnostics()
      .then((data) => {
        if (cancelled) return;
        const results = (data?.results ?? []).filter((entry) => entry.testId === test.id);
        const latest = results[0] ?? null;
        const baselineForTest = results[results.length - 1] ?? null;
        setHistory(results);
        setBaseline(baselineForTest);
        if (latest) {
          setSavedResult(latest);
          setPhase('results');
        }
      })
      .catch(() => {
        // No saved history (or not signed in) — the intro flow shows.
      });
    return () => {
      cancelled = true;
    };
  }, [test.id]);

  const question = test.questions[index];
  // A freshly-taken attempt is scored from answers; a reloaded one comes from
  // the database record (which has score/breakdown/gapTags but not raw answers).
  const result = useMemo(() => {
    const liveResult = phase === 'results' && Object.keys(answers).length
      ? scoreDiagnostic(test, answers)
      : null;
    return liveResult ?? (phase === 'results' && savedResult
      ? {
        ratio: savedResult.score,
        passed: savedResult.passed,
        gapTags: savedResult.gapTags ?? [],
        breakdown: savedResult.breakdown ?? [],
        correct: null,
        total: null,
      }
      : null);
  }, [answers, phase, savedResult, test]);

  const start = () => {
    setAnswers({});
    setIndex(0);
    setAwarded(false);
    setPhase('quiz');
  };

  const choose = async (optionIndex) => {
    const next = { ...answers, [question.id]: optionIndex };
    setAnswers(next);

    if (index + 1 < test.questions.length) {
      setIndex(index + 1);
      return;
    }

    // Last question answered — score, show results, and persist the attempt.
    const scored = scoreDiagnostic(test, next);
    setPhase('results');
    setSaving(true);
    try {
      const res = await saveDiagnostic({
        testId: test.id,
        answers: next,
      });
      if (typeof res?.xp === 'number') emitXpUpdated(res.xp);
      if (res?.awarded) setAwarded(true);
      // Keep this session's projection in sync so the dashboard's next-best-action
      // reflects the latest server-scored diagnostic.
      if (setStudent) {
        setStudent((prev) => ({
          ...prev,
          diagnosticResult: {
            testId: test.id,
            score: scored.ratio,
            gapTags: scored.gapTags,
            completedAt: new Date().toISOString(),
          },
        }));
      }
      // Refresh history/baseline so the overlay reflects this attempt.
      const data = await fetchDiagnostics();
      const results = (data?.results ?? []).filter((entry) => entry.testId === test.id);
      setHistory(results);
      setBaseline(results[results.length - 1] ?? null);
      setSavedResult(results[0] ?? null);
    } catch {
      // Persistence failed; the in-memory result is still shown this session.
    } finally {
      setSaving(false);
    }
  };

  // Workshops that address the student's weak categories, matched to the same
  // faculty and highlighted first — the blueprint's "gap -> workshops" loop.
  const recommended = useMemo(() => {
    if (!result) return [];
    return WORKSHOPS
      .map((workshop) => ({
        ...workshop,
        match: workshopMatch(workshop, {
          facultyId: activeFaculty?.id,
          programme: student?.programme,
          year: student?.year,
          interests: `${student?.careerTargets ?? ''} ${student?.industries ?? ''}`,
          gapTags: result.gapTags,
        }),
      }))
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 3);
  }, [result, activeFaculty?.id, student]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="space-y-1.5">
        <h2 className="section-title font-heading flex items-center gap-2.5">
          <Brain className="w-5 h-5 text-crimson" />
          <span>Skills Diagnostic Tests</span>
        </h2>
        <p className="section-subtitle max-w-2xl">
          A short assessment that maps your strengths and gaps, then points you at the
          workshops that close them.
        </p>
      </div>

      {/* ---------------- Intro ---------------- */}
      {phase === 'intro' && (
        <div className="surface p-8 max-w-2xl">
          <div className="flex items-start gap-4">
            <span className="p-3 rounded-2xl bg-crimson/10 text-crimson shrink-0">
              <Target className="w-6 h-6" />
            </span>
            <div className="space-y-2">
              <h3 className="font-heading font-bold text-xl text-[#1d1d1f]">{test.title}</h3>
              <p className="text-sm text-muted leading-relaxed">
                {test.questions.length} questions · about {test.minutes} minutes · pass mark{' '}
                {Math.round(test.passMark * 100)}%. The score is based on correct answers; a first passing attempt earns the{' '}
                <span className="font-semibold text-[#1d1d1f]">Skills Diagnostic</span> badge and{' '}
                <span className="font-semibold text-crimson">+{XP_VALUES.DIAGNOSTIC_PASSED} XP</span>.
              </p>
              <button onClick={start} className="crimson-btn mt-3">
                Start diagnostic <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Quiz ---------------- */}
      {phase === 'quiz' && question && (
        <div className="surface p-6 md:p-8 max-w-2xl space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted">
              <span className="uppercase tracking-wide">{question.category}</span>
              <span className="tabular-nums">
                {index + 1} / {test.questions.length}
              </span>
            </div>
            <div
              className="h-1.5 rounded-full bg-black/[0.06]"
              role="progressbar"
              aria-label="Diagnostic test progress"
              aria-valuemin={0}
              aria-valuemax={test.questions.length}
              aria-valuenow={index}
            >
              <div
                className="h-full rounded-full bg-crimson transition-all duration-300"
                style={{ width: `${((index) / test.questions.length) * 100}%` }}
              />
            </div>
          </div>

          <h3 className="font-heading font-semibold text-lg text-[#1d1d1f] leading-snug">
            {question.prompt}
          </h3>

          <div className="space-y-2.5">
            {question.options.map((option, i) => (
              <button
                key={i}
                onClick={() => choose(i)}
                className="w-full text-left p-4 rounded-[14px] border border-black/10 bg-white text-sm text-[#1d1d1f] transition hover:border-crimson/40 hover:bg-crimson/[0.03] flex items-center justify-between gap-3 group"
              >
                <span>{option}</span>
                <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- Results ---------------- */}
      {phase === 'results' && result && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Score + breakdown */}
          <div className="lg:col-span-3 surface p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">Your result</p>
                <p className="font-heading font-bold text-3xl text-[#1d1d1f] mt-1 tabular-nums">
                  {result.correct != null ? `${result.correct}/${result.total} ` : ''}
                  <span className={result.correct != null ? 'text-lg text-muted font-semibold ml-2' : ''}>
                    {Math.round(result.ratio * 100)}%
                  </span>
                </p>
              </div>
              <span
                className={`badge-pill border ${
                  result.passed
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {result.passed ? 'Passed' : 'Keep practising'}
              </span>
            </div>

            {awarded && (
              <div className="flex items-center gap-2.5 rounded-[14px] bg-crimson/[0.06] border border-crimson/20 p-3.5 text-sm">
                <Award className="w-4 h-4 text-crimson shrink-0" />
                <span className="text-[#1d1d1f]">
                  Badge earned — <span className="font-semibold">Skills Diagnostic Cleared</span>,{' '}
                  <span className="font-semibold text-crimson">+{XP_VALUES.DIAGNOSTIC_PASSED} XP</span>.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 items-center gap-5 rounded-[18px] border border-black/10 bg-black/[0.02] p-4 sm:grid-cols-[220px_1fr]">
              <SkillRadar breakdown={result.breakdown} baseline={history.length > 1 ? baseline?.breakdown : null} />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rules-based gap summary</p>
                <p className="text-sm leading-relaxed text-[#424245]">
                  {result.gapTags.length
                    ? `The score flags ${result.gapTags.slice(0, 2).join(' and ')} as focus areas because those categories are below the diagnostic's strong threshold. Suggestions are ranked from your faculty, programme, year, interests, and these tags.`
                    : 'No category fell below the diagnostic\'s strong threshold. Suggestions are still ranked from your faculty, programme, year, and interests.'}
                </p>
                <p className="text-[11px] leading-relaxed text-muted">
                  This is a rules-based score and catalogue match, not an AI assessment or professional judgement.
                </p>
                {history.length > 1 && (
                  <p className="text-[11px] text-muted flex items-center gap-1.5 pt-1">
                    <History className="w-3.5 h-3.5 text-crimson" />
                    Overlay: your first attempt (dotted) vs latest ({history.length} on record).
                  </p>
                )}
                {saving && <p className="text-[11px] text-muted">Saving your result…</p>}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                Strengths &amp; gaps by skill
              </p>
              {result.breakdown.map((cat) => (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#1d1d1f]">{cat.name}</span>
                    <span
                      className={`font-semibold ${
                        cat.strong ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {cat.strong ? 'Strong' : 'Focus area'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-black/[0.06]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        cat.strong ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.max(6, Math.round(cat.ratio * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button onClick={start} className="secondary-btn">
              <RotateCcw className="w-4 h-4" /> Retake diagnostic
            </button>
          </div>

          {/* Recommendations */}
          <div className="lg:col-span-2 surface p-6 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-crimson" />
              <h3 className="font-heading font-bold text-base text-[#1d1d1f]">Recommended next</h3>
            </div>
            <p className="text-xs text-muted">
              {result.gapTags.length
                ? 'Current rules-based matches to your focus areas.'
                : 'Current rules-based matches for your programme and profile.'}
            </p>

            <div className="space-y-3">
              {recommended.map((w) => (
                <div key={w.id} className="rounded-[14px] border border-black/10 p-3.5 space-y-1.5">
                  <p className="text-sm font-semibold text-[#1d1d1f] leading-snug">{w.title}</p>
                  <p className="text-[11px] leading-relaxed text-muted">{w.match.why}</p>
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" /> {w.date}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {(w.tags ?? []).slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="badge-pill bg-black/[0.04] text-[#424245] border border-black/10"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="pt-1 text-[11px] font-semibold text-crimson">
                    {w.match.recommended ? `Recommended match · ${w.match.score}%` : `${w.match.score}% catalogue relevance`}
                  </p>
                </div>
              ))}
              {recommended.length === 0 && (
                <p className="text-sm text-muted">No matching workshops right now.</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1 text-xs text-muted">
              <Sparkles className="w-3.5 h-3.5 text-crimson" />
              <span>Results also refine your dashboard&apos;s next best action.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillRadar({ breakdown, baseline = null }) {
  const center = 100;
  const radius = 76;
  const pointsFor = (scale) => breakdown.map((category, index) => {
    const angle = (index / Math.max(1, breakdown.length)) * Math.PI * 2 - Math.PI / 2;
    const value = typeof scale === 'number' ? scale : category.ratio;
    return `${center + Math.cos(angle) * radius * value},${center + Math.sin(angle) * radius * value}`;
  }).join(' ');

  // Longitudinal overlay: the first-ever attempt, aligned to the same axes.
  const baselinePoints = Array.isArray(baseline) && baseline.length === breakdown.length
    ? baseline.map((category, index) => {
      const angle = (index / Math.max(1, breakdown.length)) * Math.PI * 2 - Math.PI / 2;
      const value = category.ratio;
      return `${center + Math.cos(angle) * radius * value},${center + Math.sin(angle) * radius * value}`;
    }).join(' ')
    : null;
  const axes = breakdown.map((category, index) => {
    const angle = (index / Math.max(1, breakdown.length)) * Math.PI * 2 - Math.PI / 2;
    return {
      name: category.name,
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      labelX: center + Math.cos(angle) * (radius + 16),
      labelY: center + Math.sin(angle) * (radius + 16),
    };
  });

  return (
    <div className="mx-auto w-full max-w-[220px]" aria-label="Diagnostic skills radar chart">
      <svg viewBox="0 0 200 200" role="img" className="h-auto w-full overflow-visible">
        <title>Skills diagnostic radar chart</title>
        {[0.33, 0.66, 1].map((scale) => <polygon key={scale} points={pointsFor(scale)} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />)}
        {axes.map((axis) => <line key={axis.name} x1={center} y1={center} x2={axis.x} y2={axis.y} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />)}
        {baselinePoints && (
          <polygon points={baselinePoints} fill="none" stroke="#6e6e73" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="3 3" />
        )}
        <polygon points={pointsFor()} fill="var(--crimson)" fillOpacity="0.18" stroke="var(--crimson)" strokeWidth="2" />
        {axes.map((axis) => <text key={`${axis.name}-label`} x={axis.labelX} y={axis.labelY} textAnchor="middle" dominantBaseline="middle" className="fill-[#6e6e73] text-[7px]">{axis.name.length > 14 ? `${axis.name.slice(0, 13)}…` : axis.name}</text>)}
      </svg>
    </div>
  );
}
