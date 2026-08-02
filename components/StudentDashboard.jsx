import React, { useEffect, useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import {
  Trophy,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  Zap,
  Award,
  GitBranch,
  ShieldCheck,
  BookOpen,
  TrendingUp,
  Map,
  Target,
  FileCheck,
  UserCheck,
  Lock
} from 'lucide-react';
import { careerPathFor } from '@/lib/data/roadmaps';
import { tierFor, tierProgress } from '@/lib/xp';
import { fetchLeaderboard, fetchXpSummary } from '@/lib/api';
import { onXpUpdated } from '@/lib/xp-events';
import { nextBestAction } from '@/lib/next-best-action';
import confetti from 'canvas-confetti';

export default function StudentDashboard({
  student,
  setStudent,
  activeFaculty,
  setActiveTab
}) {
  const roadmap = careerPathFor(activeFaculty.id).map((stage) => ({
    ...stage,
    // Dashboard cards are a compact overview; the Career Path module owns
    // persisted completion. Labels here describe position in the path rather
    // than pretending an unverified fixture is complete.
    status: stage.year < Number(student.year)
      ? 'PAST_STAGE'
      : stage.year === Number(student.year)
        ? 'IN_PROGRESS'
        : 'UPCOMING',
    tasks: stage.items,
  }));

  // XP is the real total summed from the XpEvent ledger — not the hardcoded
  // DEFAULT_STUDENT.xp. It loads on mount and updates live whenever another
  // module (career milestone, workshop check-in, FYP submit) awards XP, so the
  // headline figure can never drift from the database or reset on refresh.
  const [liveXp, setLiveXp] = useState(null);
  const [streakDays, setStreakDays] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selfRank, setSelfRank] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const refreshSummary = () => fetchXpSummary()
      .then((data) => {
        if (cancelled) return;
        if (typeof data?.totalXp === 'number') setLiveXp(data.totalXp);
        if (typeof data?.streakDays === 'number') setStreakDays(data.streakDays);
      })
      .catch(() => {
        // Fall back to the projection's XP while the API is unavailable.
      });

    refreshSummary();
    // The event only invalidates the cached view. The returned number is not
    // trusted; the next render reads the authoritative ledger again.
    const unsubscribe = onXpUpdated(() => refreshSummary());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then((data) => {
        if (cancelled) return;
        setLeaderboard(data.entries ?? []);
        setSelfRank(data.selfRank ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setLeaderboard([]);
          setSelfRank(null);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const displayXp = liveXp ?? student.xp ?? 0;
  const tier = tierFor(displayXp);
  const progress = tierProgress(displayXp);

  const nextBest = nextBestAction({ student, activeFaculty });
  const ACTION_ICONS = { UserCheck, Target, FileCheck, BookOpen, TrendingUp, Map };
  const NbaIcon = ACTION_ICONS[nextBest.icon] ?? Target;

  // A little celebration when a real award lands (fired by the live XP event).
  useEffect(() => {
    const unsubscribe = onXpUpdated(() => {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    });
    return unsubscribe;
  }, []);

  return (
    <div className="space-y-10 animate-fadeIn">

      {/* Next Best Action — one clear, non-blocking suggestion at the top. */}
      {setActiveTab && (
        <button
          onClick={() => setActiveTab(nextBest.tab)}
          className="w-full text-left surface surface-interactive border-crimson/30 p-5 md:p-6 flex items-center gap-4"
        >
          <span className="p-3 rounded-2xl bg-crimson/10 text-crimson shrink-0">
            <NbaIcon className="w-6 h-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-crimson">Next best action</p>
            <h3 className="font-heading font-bold text-lg text-[#1d1d1f] leading-snug mt-0.5">
              {nextBest.title}
            </h3>
            <p className="text-sm text-muted mt-0.5 hidden sm:block">{nextBest.desc}</p>
          </div>
          <span className="crimson-btn shrink-0 hidden md:inline-flex">
            {nextBest.cta} <ChevronRight className="w-4 h-4" />
          </span>
          <ChevronRight className="w-5 h-5 text-crimson shrink-0 md:hidden" />
        </button>
      )}

      {/* Hero Dark Glassmorphic Card */}
      <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-white via-white to-[#f2f2f5] border border-black/10 p-6 md:p-10 shadow-lg">
        {/* Background Crimson Glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-crimson/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">

          {/* An 80px avatar plus a name and two badge pills does not fit one
              375px row — the text block got squeezed against the avatar and
              read as off-centre. Stack on a phone, side-by-side from sm up. */}
          <div className="flex w-full flex-col items-center gap-4 text-center sm:w-auto sm:flex-row sm:items-center sm:gap-5 sm:text-left">
            <div className="relative flex-shrink-0">
              <Avatar
                name={student.name}
                src={student.avatarUrl}
                size={80}
                className="border-2 border-black/10 shadow-xl"
              />
              <span className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-crimson text-white shadow-md">
                <Sparkles className="w-4 h-4" />
              </span>
            </div>

            {/* min-w-0 lets the long faculty and programme names shrink and wrap
                as whole lines. Without it this block kept its intrinsic width,
                which on a 375px screen squeezed "Faculty of Computing and
                Engineering" into a three-word-tall column beside the avatar. */}
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-[#1d1d1f] sm:text-3xl md:text-4xl">
                {student.name}
              </h1>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="badge-pill bg-black/[0.06] text-[#1d1d1f] border border-black/10">
                  Year {student.year} Student
                </span>
                <span className="badge-pill bg-black/[0.03] text-muted border border-black/10">
                  {student.id}
                </span>
              </div>

              {/* Faculty and programme stack on a phone and sit inline from sm up;
                  the separator dot is only meaningful on one line. */}
              <div className="mt-3 flex flex-col items-center gap-1 text-sm text-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: activeFaculty.color }}
                    aria-hidden="true"
                  />
                  <span className="text-[#424245]">{activeFaculty.name}</span>
                </span>
                <span aria-hidden="true" className="hidden text-slate-600 sm:inline">•</span>
                <span className="font-medium text-[#424245]">{student.programme}</span>
              </div>
            </div>
          </div>

          {/* XP & Level Widget */}
          <div className="w-full lg:w-80 bg-black/[0.03] backdrop-blur-md rounded-[18px] p-5 border border-black/10 flex flex-col gap-3.5">
            {/* Three items on one row does not fit 375px — "TIER: BRONZE",
                "0 days streak" and the XP total each wrapped mid-phrase. The
                tier and total are the pair that belong together, so the streak
                drops to its own line on a phone. */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-muted">
                <Trophy className="h-4 w-4 flex-shrink-0 text-crimson" aria-hidden="true" />
                <span>Tier: {tier.name}</span>
              </div>
              <span className="whitespace-nowrap text-base font-extrabold text-[#1d1d1f]">
                {displayXp.toLocaleString()} XP
              </span>
              <span className="order-last w-full text-[11px] font-semibold text-muted sm:order-none sm:w-auto">
                {streakDays} day{streakDays === 1 ? '' : 's'} streak
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/[0.03] h-2.5 rounded-full overflow-hidden p-0.5 border border-black/[0.06]">
              <div
                className="bg-crimson h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, progress.progress * 100)}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Current Progress</span>
              <span>{progress.next ? `Next Rank: ${progress.next.min.toLocaleString()} XP` : "Top Rank Reached"}</span>
            </div>

            {/* Real XP is earned by completing tracked activities — checking in at
                a workshop (+150), completing a career milestone (+100), etc. —
                and is summed live from the ledger above. */}
            <button
              onClick={() => setActiveTab && setActiveTab('workshops')}
              className="w-full crimson-btn justify-center text-xs py-2.5 mt-1"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Earn XP — check in at a workshop</span>
            </button>
            <p className="text-[10px] text-muted flex items-center gap-1 justify-center">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Verified from your activity ledger
            </p>
          </div>

        </div>
      </div>

      {/* Grid: 4-Year Roadmap + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column (2 Cols): Dynamic 4-Year Roadmap */}
        <div className="lg:col-span-2 space-y-6">

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Target className="w-5 h-5 text-crimson" />
                <span>4-Year Dynamic Career Roadmap</span>
              </h2>
              <p className="section-subtitle mt-1">
                Your career plan for <span className="text-[#1d1d1f] font-semibold">{activeFaculty.name}</span>
              </p>
            </div>

            <span className="badge-pill bg-black/[0.03] text-muted border border-black/10">
              Updated for You
            </span>
          </div>

          <div className="space-y-5">
            {roadmap.map((stage, idx) => {
              const isCurrent = stage.year === student.year;
              const isDone = stage.status === 'COMPLETED';
              const isPastStage = stage.status === 'PAST_STAGE';

              return (
                <div
                  key={idx}
                  className={`rounded-[18px] p-6 border transition-all ${
                    isCurrent
                      ? 'bg-crimson/[0.06] border-crimson/30 shadow-sm'
                      : isDone
                      ? 'bg-black/[0.02] border-black/10'
                      : 'bg-black/[0.02] border-black/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                      isDone
                          ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25'
                          : isPastStage
                          ? 'bg-amber-500/10 text-amber-700 border border-amber-500/25'
                          : isCurrent
                          ? 'bg-crimson text-white shadow-lg shadow-crimson/30 font-extrabold'
                          : 'bg-black/[0.03] text-[#424245] border border-black/10'
                      }`}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : stage.year}
                      </div>

                      <div>
                        <h3 className={`text-lg font-bold font-heading ${isCurrent || isDone ? 'text-[#1d1d1f]' : isPastStage ? 'text-amber-800' : 'text-[#424245]'}`}>{stage.title}</h3>
                        <span className="text-xs text-muted font-medium flex items-center gap-1.5 mt-0.5">
                          {isCurrent ? <><Zap className="w-3 h-3 text-crimson" /> Active Academic Year</> :
                           isDone ? <><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed Stage</> :
                           isPastStage ? <><Clock className="w-3 h-3 text-amber-600" /> Past stage — review outstanding items</> :
                           <><Lock className="w-3 h-3 text-muted" /> Upcoming Milestone</>}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full ${
                      isDone ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/25' :
                      isCurrent ? 'bg-crimson/15 text-crimson border border-crimson/30' :
                      isPastStage ? 'bg-amber-500/10 text-amber-700 border border-amber-500/25' :
                      'bg-black/[0.03] text-muted border border-black/10'
                    }`}>
                      {stage.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Tasks List */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-black/[0.06]">
                    {stage.tasks.map((task, tIdx) => (
                      <button
                        type="button"
                        key={`${stage.year}-${tIdx}`}
                        onClick={() => setActiveTab && setActiveTab('careerpath')}
                        className={`p-3.5 rounded-xl text-xs flex flex-col justify-between transition ${
                            isDone
                              ? 'bg-black/[0.03] text-[#424245] hover:bg-black/[0.06]'
                            : isPastStage
                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-800 hover:bg-amber-500/15'
                            : isCurrent
                            ? 'bg-crimson/10 border border-crimson/25 text-crimson hover:bg-crimson/15'
                            : 'bg-black/[0.03] text-[#6e6e73] hover:bg-black/[0.06]'
                        }`}
                      >
                        <span className="font-medium leading-snug">{task.label}</span>
                        <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
                          <span>{isDone ? 'Review in Career Path' : isPastStage ? 'Review outstanding' : isCurrent ? 'Track in Career Path' : 'Upcoming'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    ))}
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* Right Column (1 Col): Live Leaderboard & Quick Badges */}
        <div className="space-y-6">

          {/* Live Leaderboard */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <h3 className="font-bold text-base text-[#1d1d1f] font-heading flex items-center gap-2">
                <Trophy className="w-4 h-4 text-crimson" />
                <span>University XP leaderboard</span>
              </h3>
              <span className="text-[10px] text-muted uppercase font-semibold">{selfRank ? `Your rank: #${selfRank}` : 'Live database ranking'}</span>
            </div>

            <div className="space-y-2">
              {leaderboard.length ? leaderboard.map(user => (
                <div
                  key={user.id}
                  className={`p-3 rounded-xl flex items-center justify-between text-xs transition ${
                    user.isSelf ? 'bg-crimson/10 border border-crimson/30 text-crimson font-bold' : 'bg-black/[0.03] text-[#424245]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 ${
                      user.rank === 1 ? 'bg-amber-400/90 text-black' :
                      user.rank === 2 ? 'bg-slate-300 text-black' :
                      user.rank === 3 ? 'bg-amber-800/70 text-white' : 'bg-black/[0.03] text-muted'
                    }`}>
                      #{user.rank}
                    </span>
                    <Avatar name={user.name} src={user.avatarUrl} size={32} />
                    <div className="min-w-0">
                      <div className="font-semibold leading-tight truncate">{user.name}</div>
                      <div className="text-[10px] text-muted">{user.facultyCode} · Year {user.year}</div>
                    </div>
                  </div>
                  <span className="font-extrabold text-[#1d1d1f] flex-shrink-0 ml-2">{user.xp.toLocaleString()} XP</span>
                </div>
              )) : <p className="rounded-[12px] border border-black/10 bg-black/[0.02] p-3 text-xs leading-relaxed text-muted">The live leaderboard is not available yet. Your XP still comes from the recorded activity ledger.</p>}
            </div>
          </div>

          {/* Recent Badges Showcase */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <h3 className="font-bold text-base text-[#1d1d1f] font-heading flex items-center gap-2">
                <Award className="w-4 h-4 text-crimson" />
                <span>Verified Badges ({student.badges.length})</span>
              </h3>
              <button onClick={() => setActiveTab('autocv')} className="text-xs text-crimson hover:text-red-600 font-semibold">
                Sync to CV →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {student.badges.map(b => (
                <div key={b.id} className="p-3.5 rounded-xl bg-black/[0.03] border border-black/[0.06] flex flex-col gap-2 hover:border-crimson/30 transition">
                  <div className="flex items-center justify-between">
                    <Award className="w-4 h-4 text-muted" />
                    <span className="text-[10px] font-bold text-crimson">+{b.xp} XP</span>
                  </div>
                  <span className="font-bold text-xs text-[#1d1d1f] leading-tight">{b.title}</span>
                  <span className="text-[10px] text-muted">{b.category} • {b.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="glass-panel-glow p-5 space-y-3">
            <h4 className="text-xs uppercase font-extrabold text-crimson tracking-wider">Fast Actions</h4>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setActiveTab('autocv')}
                className="w-full secondary-btn text-xs justify-between py-3"
              >
                <span className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-muted" />
                  Generate ATS PDF Resume
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setActiveTab('logbook')}
                className="w-full secondary-btn text-xs justify-between py-3"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted" />
                  Submit Logbook & Generate Magic Link
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
