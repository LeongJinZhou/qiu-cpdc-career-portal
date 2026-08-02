import React from 'react';
import {
  Settings,
  TrendingUp,
  ShieldCheck,
  GraduationCap,
  Building2
} from 'lucide-react';
import { FACULTIES } from '@/lib/data/facultyData';

export default function AdminSuperDashboard({ overview }) {
  const deploymentPhases = [
    { month: "Foundation", title: "Standalone data model", desc: "Local faculty, programme, student, role and audit records are available.", status: "AVAILABLE" },
    { month: "Authentication", title: "Google SSO readiness", desc: "Firebase Google sign-in is implemented; provider and deployment settings are still environment configuration.", status: "CONFIGURE" },
    { month: "Integration", title: "ACMS/SIS adapter", desc: "Future integration boundary is prepared but remains intentionally disconnected until QIU supplies data contracts.", status: "PLANNED" },
    { month: "Operations", title: "Production rollout", desc: "Complete Firebase, database, storage, email and privacy checks before real student records are used.", status: "PLANNED" },
  ];

  const metrics = overview?.metrics ?? {};
  const liveFacultyRows = overview?.faculties ?? [];
  const facultyRows = FACULTIES.map((faculty) => ({
    ...faculty,
    live: liveFacultyRows.find((row) => row.id === faculty.id) ?? null,
  }));

  // Every operational number comes from the live overview endpoint. A dash is
  // deliberate when a source is not available; it is never a made-up total.
  const statTiles = [
    { label: "Faculties Configured", value: String(overview ? liveFacultyRows.length : '—'), context: overview ? "Database faculty registry" : "Loading database registry", icon: Building2 },
    { label: "Students in Scope", value: typeof metrics.studentsInScope === 'number' ? metrics.studentsInScope.toLocaleString() : "—", context: overview?.scope === 'DEMO_STUDENT' ? "Standalone demo scope" : "Live operational scope", icon: GraduationCap },
    { label: "Average Readiness", value: typeof metrics.readinessAverage === 'number' ? `${metrics.readinessAverage}%` : "—", context: "Derived from verified records", icon: ShieldCheck },
    { label: "Upcoming Workshops", value: typeof metrics.upcomingWorkshops === 'number' ? metrics.upcomingWorkshops.toLocaleString() : "—", context: "Published database events", icon: TrendingUp }
  ];

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-black/10 pb-6">
        <div className="space-y-1.5">
          <h2 className="section-title font-heading text-[#1d1d1f] flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-crimson" />
            <span>Rollout & Cross-Faculty Onboarding</span>
          </h2>
          <p className="section-subtitle max-w-2xl">
            Database-backed operational overview. The rollout notes below are planning guidance, not live deployment telemetry.
          </p>
        </div>

        <span className="px-3.5 py-2 rounded-xl bg-crimson/10 border border-crimson/30 text-xs text-red-600 font-semibold flex items-center gap-1.5 shrink-0">
          <ShieldCheck className="w-4 h-4" />
          <span>Admin Access</span>
        </span>
      </div>

      {/* Control-centre stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {statTiles.map((tile, idx) => {
          const Icon = tile.icon;
          return (
            <div key={idx} className="surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">{tile.label}</span>
                <Icon className="w-4 h-4 text-crimson" />
              </div>
              <div className="font-heading font-bold text-3xl text-[#1d1d1f] tabular-nums leading-none">{tile.value}</div>
              <p className="text-xs text-muted">{tile.context}</p>
            </div>
          );
        })}
      </div>

      {/* Phase 3 Timeline Tracker */}
      <div className="glass-panel p-6 space-y-6">
        <h3 className="font-heading font-bold text-lg text-[#1d1d1f] flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-crimson" />
          <span>Launch & Onboarding Strategy Roadmap</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {deploymentPhases.map((phase, idx) => {
            const isDone = phase.status === 'AVAILABLE';
            const isProgress = phase.status === 'CONFIGURE';

            return (
              <div
                key={idx}
                className={`p-5 rounded-[14px] border space-y-3.5 transition ${
                  isProgress
                    ? 'bg-crimson/[0.06] border-crimson/30 shadow-sm'
                    : isDone
                    ? 'bg-black/[0.02] border-black/10'
                    : 'bg-black/[0.02] border-black/10 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/[0.06] text-[#424245]">
                    {phase.month}
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    isDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    isProgress ? 'bg-crimson/20 text-red-600 border border-crimson/40 animate-pulse' :
                    'bg-black/[0.06] text-[#6e6e73]'
                  }`}>
                    {phase.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-heading font-semibold text-sm text-[#1d1d1f]">{phase.title}</h4>
                  <p className="text-xs text-muted leading-relaxed">{phase.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cross-Faculty Deployment Status Matrix */}
      <div className="glass-panel p-6 space-y-5">
        <div className="border-b border-black/10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-heading font-bold text-lg text-[#1d1d1f]">Full Cross-Faculty Deployment Matrix</h3>
            <p className="text-sm text-muted mt-0.5">Real-time status across all 8 faculty and programme domains.</p>
          </div>
          <span className="text-xs font-semibold text-muted">Counts are database-backed; ACMS/SIS sync remains a future adapter</span>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-left text-xs border-collapse min-w-[720px]">
            <caption className="sr-only">Cross-faculty deployment status matrix</caption>
            <thead>
              <tr className="border-b border-black/10 text-muted uppercase text-[10px] tracking-wider">
                <th scope="col" className="py-3 px-3">Faculty / Programme Domain</th>
                <th scope="col" className="py-3 px-3">Code</th>
                <th scope="col" className="py-3 px-3 text-right">Enrolled Students</th>
                <th scope="col" className="py-3 px-3">System Assignment Type</th>
                <th scope="col" className="py-3 px-3 text-right">Preceptor approval rate</th>
                <th scope="col" className="py-3 px-3">Deployment Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 text-[#1d1d1f]">
              {facultyRows.map(fac => (
                <tr key={fac.id} className="hover:bg-black/[0.03] transition">
                  <td className="py-3.5 px-3 font-semibold">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fac.color }}></span>
                      <span className="text-[#1d1d1f]">{fac.name}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-3 font-mono font-semibold text-muted">{fac.code}</td>
                  <td className="py-3.5 px-3 font-semibold text-right tabular-nums">{typeof fac.live?.studentCount === 'number' ? fac.live.studentCount.toLocaleString() : '—'}</td>
                  <td className="py-3.5 px-3 text-[#424245] font-medium">{fac.systemAssignment.type}</td>
                  <td className="py-3.5 px-3 text-muted font-bold text-right tabular-nums">Not connected</td>
                  <td className="py-3.5 px-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${fac.live ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-black/[0.04] text-muted border-black/10'}`}>
                      {fac.live ? 'DATABASE READY' : 'SCHEMA READY'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
