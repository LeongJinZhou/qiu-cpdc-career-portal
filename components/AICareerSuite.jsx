import React, { useState, useEffect } from 'react';
import {
  Bot,
  Video,
  VideoOff,
  Mic,
  Play,
  Square,
  Sparkles,
  Target,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  TrendingUp,
  Award,
  ShieldCheck,
  Zap,
  Activity,
  BarChart3,
  Eye,
  MessageSquare
} from 'lucide-react';
import { MOCK_INTERVIEW_QUESTIONS, SKILL_GAP_TARGETS } from '@/lib/data/facultyData';

export default function AICareerSuite({ student, activeFaculty }) {
  const [activeTab, setActiveTab] = useState('interview'); // 'interview' | 'skillgap'

  // AI Mock Interviewer State
  const questions = MOCK_INTERVIEW_QUESTIONS[activeFaculty.id] || MOCK_INTERVIEW_QUESTIONS.default;
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [feedback, setFeedback] = useState(null);

  // Skill Gap Radar State
  const [selectedTarget, setSelectedTarget] = useState(SKILL_GAP_TARGETS[0]);
  const qualificationMatch = Math.round(
    (selectedTarget.requiredBadges.filter((badge) => (student?.badges ?? []).some((item) => item.title.toLowerCase().includes(badge.toLowerCase()))).length
      / Math.max(1, selectedTarget.requiredBadges.length)) * 100,
  );

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    setFeedback(null);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    // This standalone build has no configured media/AI provider. Keep the
    // interaction useful, but never invent a score, transcript, camera signal,
    // or XP reward and present it as analysis.
    setFeedback({
      overallScore: null,
      metrics: [
        { name: 'Speech Pace & Vocal Tone', score: null, status: 'Connect an approved speech-analysis provider to score this dimension.' },
        { name: 'Eye Contact & Posture', score: null, status: 'Camera analysis is not enabled in standalone mode.' },
        { name: 'STAR Method Answer Structure', score: null, status: 'Use the checklist below to self-review your answer.' },
      ],
      strengths: [
        `Timed practice completed for ${recordingTime || 0} seconds.`,
        'You can replay the question and write a concrete Situation, Task, Action and Result before the next attempt.',
      ],
      suggestions: [
        'Add a measurable result and name the action you personally owned.',
        'When an AI provider is configured, this report can be replaced with verified transcript and delivery signals.',
      ],
    });
  };

  // What the AI analysis will measure -- shown as a preview while no feedback exists yet.
  const analysisPreview = [
    { icon: Mic, label: "Speech Pace & Vocal Tone" },
    { icon: Eye, label: "Eye Contact & Posture" },
    { icon: MessageSquare, label: "STAR Method Answer Structure" }
  ];

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-black/10 pb-6">
        <div className="space-y-1.5">
          <h2 className="section-title font-heading text-[#1d1d1f] flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-crimson" />
          <span>Interview Practice &amp; Skill Gap Review</span>
          </h2>
          <p className="section-subtitle max-w-2xl">
            A transparent practice studio and rules-based skill-gap plan. Automated scoring remains unavailable until an approved provider is configured.
          </p>
        </div>

        <div className="flex max-w-full items-center gap-1 overflow-x-auto bg-black/[0.03] p-1 rounded-xl border border-black/10 shrink-0" role="tablist" aria-label="AI career tools">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'interview'}
            onClick={() => setActiveTab('interview')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'interview' ? 'bg-crimson text-white' : 'text-muted hover:text-[#1d1d1f]'
            }`}
          >
            Interview Practice
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'skillgap'}
            onClick={() => setActiveTab('skillgap')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'skillgap' ? 'bg-crimson text-white' : 'text-muted hover:text-[#1d1d1f]'
            }`}
          >
            Skill Gap Radar
          </button>
        </div>
      </div>

      {/* MODULE 1: TIMED INTERVIEW PRACTICE */}
      {activeTab === 'interview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Side (7 Cols): Webcam & Controls */}
          <div className="lg:col-span-7 space-y-6">

            {/* Question Card */}
            <div className="glass-panel p-6 space-y-2.5 border-l-4 border-l-crimson">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Faculty Question #{currentQIndex + 1} of {questions.length}</span>
                <span className="text-crimson font-semibold">{activeFaculty.code} Standard</span>
              </div>
              <h3 className="text-xl font-heading font-bold text-[#1d1d1f] leading-snug">
                &ldquo;{questions[currentQIndex]}&rdquo;
              </h3>
            </div>

            {/* Simulated Webcam Viewfinder */}
            <div className="relative rounded-[18px] overflow-hidden bg-[#0d0d0f] aspect-video border border-black/10 flex flex-col items-center justify-center shadow-lg">

              {/*
                Deliberately an empty viewfinder, not a stock portrait.
                A photograph of a stranger dressed up as "your camera feed"
                implies a camera is running when none is — and this practice
                mode never requests camera access. An honest placeholder is
                clearer than a convincing fake.
              */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40"
                aria-hidden="true"
              >
                <VideoOff className="h-8 w-8" />
                <span className="text-xs font-medium">Camera preview off</span>
              </div>

              {/* Recording Laser Overlay */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-crimson/90 text-white px-3 py-1.5 rounded-full text-xs font-bold animate-pulse shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span>REC {recordingTime}s</span>
                </div>
              )}

              {/* Simulated Audio Waveform Bar Overlay */}
              {isRecording && (
                <div className="absolute bottom-6 flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-black/[0.04] backdrop-blur-md border border-black/10">
                  <Mic className="w-4 h-4 text-crimson animate-pulse" />
                  <div className="flex items-end gap-1 h-6">
                    {[40, 70, 30, 90, 60, 100, 45, 80, 50, 75].map((h, idx) => (
                      <div key={idx} className="w-1 bg-crimson rounded-full animate-bounce" style={{ height: `${h}%`, animationDelay: `${idx * 0.1}s` }}></div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt overlay when idle: real composition instead of a floating caption */}
              {!isRecording && !feedback && (
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black/85 flex flex-col items-center justify-center text-center p-8 space-y-5">
                  <div className="w-16 h-16 rounded-full bg-crimson/10 border border-crimson/30 flex items-center justify-center">
                    <Video className="w-7 h-7 text-crimson" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h4 className="text-lg font-heading font-bold text-white">Timed practice ready</h4>
                    <p className="text-sm text-white/85 leading-relaxed">
                      Press start, answer out loud, and stop when you finish. Standalone mode records the timer only; it does not claim to capture or analyze camera or microphone data.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-white/75 uppercase tracking-wide font-semibold">
                    <span className="flex items-center gap-1.5"><Mic className="w-3.5 h-3.5" /> Self-review</span>
                  <span className="w-1 h-1 rounded-full bg-white/40" />
                    <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Posture</span>
                  <span className="w-1 h-1 rounded-full bg-white/40" />
                    <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Structure</span>
                  </div>
                </div>
              )}

              {/* Post-analysis idle state: keep the frame purposeful rather than reverting to a blank rectangle */}
              {!isRecording && feedback && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  <h4 className="text-base font-heading font-bold text-white">Practice captured</h4>
                  <p className="text-sm text-white/85 max-w-sm">Review the honest self-review checklist on the right, or move to the next question.</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setCurrentQIndex((currentQIndex + 1) % questions.length)}
                className="secondary-btn text-xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Next Question</span>
              </button>

              {!isRecording ? (
                <button onClick={handleStartRecording} className="crimson-btn text-sm py-3 px-6">
                  <Play className="w-4 h-4" />
                  <span>Start timed practice</span>
                </button>
              ) : (
                <button onClick={handleStopRecording} className="py-3 px-6 rounded-xl bg-white text-black font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-slate-200 transition">
                  <Square className="w-4 h-4" />
                  <span>Stop & Review Answer</span>
                </button>
              )}
            </div>

          </div>

          {/* Right Side (5 Cols): AI Feedback Dashboard */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 space-y-5 h-full">
              <div className="border-b border-black/10 pb-4 flex items-center justify-between">
                <h3 className="font-heading font-bold text-lg text-[#1d1d1f] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-crimson" />
                  <span>Practice review report</span>
                </h3>
                {feedback && <span className="text-xs font-semibold text-muted">No automated score</span>}
              </div>

              {feedback ? (
                <div className="space-y-4 text-xs">

                  {/* Metric Bars */}
                  {feedback.metrics.map((m, idx) => (
                    <div key={idx} className="space-y-1.5 bg-black/[0.03] p-4 rounded-[14px] border border-black/[0.06]">
                      <div className="flex justify-between font-semibold text-[#1d1d1f]">
                        <span>{m.name}</span>
                        <span className="text-muted">{m.score == null ? 'Manual review' : `${m.score}/100`}</span>
                      </div>
                      {m.score != null && <div className="w-full bg-black/[0.06] h-1.5 rounded-full overflow-hidden"><div className="bg-crimson h-full rounded-full" style={{ width: `${m.score}%` }}></div></div>}
                      <p className="text-[11px] text-muted">{m.status}</p>
                    </div>
                  ))}

                  {/* Strengths */}
                  <div className="space-y-1.5 pt-2">
                    <span className="font-semibold text-emerald-600 uppercase text-[10px] tracking-wide">Key Strengths</span>
                    <ul className="list-disc list-inside text-[#424245] space-y-1.5 pl-1">
                      {feedback.strengths.map((s, idx) => <li key={idx}>{s}</li>)}
                    </ul>
                  </div>

                  {/* Improvements */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-crimson uppercase text-[10px] tracking-wide">Self-review suggestions</span>
                    <ul className="list-disc list-inside text-[#424245] space-y-1.5 pl-1">
                      {feedback.suggestions.map((s, idx) => <li key={idx}>{s}</li>)}
                    </ul>
                  </div>

                </div>
              ) : (
                <div className="py-4 space-y-5">
                  <div className="flex flex-col items-center text-center space-y-3 pb-2">
                    <div className="w-14 h-14 rounded-full bg-black/[0.03] border border-black/10 flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-muted" />
                    </div>
                    <p className="text-xs text-muted max-w-[220px] leading-relaxed">
                      Complete a timed practice to receive a self-review checklist. Automated scoring is unavailable until an AI provider is configured:
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {analysisPreview.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div key={idx} className="flex items-center gap-3 bg-black/[0.03] border border-black/[0.06] rounded-[14px] p-3.5">
                          <div className="w-8 h-8 rounded-lg bg-black/[0.03] flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-muted" />
                          </div>
                          <span className="text-xs font-semibold text-[#424245]">{item.label}</span>
                          <div className="ml-auto w-16 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                            <div className="h-full w-1/4 bg-black/[0.06] rounded-full" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* MODULE 2: SKILL GAP RADAR */}
      {activeTab === 'skillgap' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Target Selector (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="glass-panel p-6 space-y-3.5">
              <h3 className="font-heading font-bold text-sm text-[#1d1d1f] flex items-center gap-2">
                <Target className="w-4 h-4 text-crimson" />
                <span>Select Target Career Role</span>
              </h3>

              <div className="space-y-2">
                {SKILL_GAP_TARGETS.map((t, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedTarget(t)}
                    className={`w-full text-left p-3.5 rounded-xl text-xs font-semibold transition flex items-center justify-between ${
                      selectedTarget.role === t.role ? 'bg-crimson text-white shadow-lg shadow-red-950/40' : 'bg-black/[0.03] text-[#424245] hover:bg-black/[0.06]'
                    }`}
                  >
                    <span>{t.role}</span>
                    <span className="text-[10px] opacity-75">{t.faculty}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Radar Metrics & 90-Day Plan (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">

            {/* Gap Analysis */}
            <div className="glass-panel p-6 space-y-5">
              <div className="border-b border-black/10 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-xl text-[#1d1d1f]">{selectedTarget.role}</h3>
                  <p className="text-sm text-muted mt-0.5">Comparing current student badges against employer baseline.</p>
                </div>
                  <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-500/30">
                  {qualificationMatch}% Evidence Match
                </span>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-semibold text-[#424245]">Required Skill Badges:</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {selectedTarget.requiredBadges.map((badge, idx) => {
                    const hasBadge = student.badges.some(b => b.title.toLowerCase().includes(badge.toLowerCase()));
                    return (
                      <div key={idx} className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                        hasBadge ? 'bg-emerald-50/40 border-emerald-500/30 text-emerald-700' : 'bg-black/[0.03] border-black/10 text-muted'
                      }`}>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] leading-tight">{badge}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* 90-Day Automated Learning Plan */}
            <div className="glass-panel-glow p-6 space-y-4">
              <h3 className="font-heading font-bold text-lg text-[#1d1d1f] flex items-center gap-2">
                <Zap className="w-4 h-4 text-crimson" />
                <span>Deterministic 90-Day Learning Roadmap</span>
              </h3>

              <div className="space-y-3">
                {selectedTarget.learningPlan90Days.map((plan, idx) => (
                  <div key={idx} className="p-4 rounded-[14px] bg-black/[0.04] border border-black/10 flex items-start gap-4 text-xs">
                    <span className="px-3 py-1 rounded-lg bg-crimson text-white font-bold text-[11px] min-w-max">
                      {plan.day}
                    </span>
                    <p className="text-[#1d1d1f] leading-relaxed font-medium pt-0.5">{plan.task}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
