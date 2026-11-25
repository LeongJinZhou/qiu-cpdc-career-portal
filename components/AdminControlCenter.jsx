'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  Filter,
  FolderSearch,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import AdminSuperDashboard from '@/components/AdminSuperDashboard';
import AuditLogPanel from '@/components/admin/AuditLogPanel';
import IdentityManagement from '@/components/admin/IdentityManagement';
import FypApprovalQueue from '@/components/admin/FypApprovalQueue';
import LogbookReviewQueue from '@/components/admin/LogbookReviewQueue';
import StudentDirectory from '@/components/admin/StudentDirectory';
import WorkshopRequestQueue from '@/components/admin/WorkshopRequestQueue';
import DataExplorer from '@/components/admin/DataExplorer';
import AlumniTracker from '@/components/admin/AlumniTracker';
import { DIRECTORY_ROLES, consoleForRole, orderTabsForRole } from '@/components/admin/roleConsole';
import { FACULTIES } from '@/lib/data/facultyData';
import { fetchAdminOverview } from '@/lib/api';
import { useAccessibleTabs } from '@/components/ui/useAccessibleTabs';
import DismissibleDialog from '@/components/ui/DismissibleDialog';

const TABS = [
  { id: 'records', label: 'Student records', icon: FolderSearch },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'students', label: 'Cohort health', icon: Users },
  { id: 'approvals', label: 'Approvals', icon: FileCheck2 },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'alumni', label: 'Alumni tracker', icon: GraduationCap },
  { id: 'people', label: 'People & access', icon: BadgeCheck },
  { id: 'audit', label: 'Audit', icon: LockKeyhole },
  { id: 'data', label: 'Data explorer', icon: Database },
];

const FYP_REVIEW_ROLES = new Set(['HEAD_OF_PROGRAMME', 'CPDC_ADMIN', 'SUPER_ADMIN']);
const LOGBOOK_REVIEW_ROLES = new Set([
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'ACADEMIC_SUPERVISOR',
  'PLACEMENT_OFFICER',
  'CPDC_ADMIN',
  'SUPER_ADMIN',
]);
const WORKSHOP_REQUEST_ROLES = new Set(['CPDC_ADMIN', 'SUPER_ADMIN']);
const PEOPLE_ROLES = new Set(['CPDC_ADMIN', 'SUPER_ADMIN']);
// Platform administrators that may browse raw cross-student records. Mirrors
// EXPLORER_ROLES in app/api/admin/data/[entity]/route.js (server is authority).
const DATA_ROLES = new Set(['CPDC_ADMIN', 'SUPER_ADMIN']);

export default function AdminControlCenter({ activeFaculty, currentRole, student }) {
  const roleConsole = consoleForRole(currentRole);
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState(requestedTab ?? roleConsole.defaultTab);
  const [facultyFilter, setFacultyFilter] = useState(currentRole === 'FACULTY_COORDINATOR' ? activeFaculty.id : 'all');
  const [query, setQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const fypStatus = student?.fypSubmission?.status;
  // Two gates, in order: does the role hold the capability the tab needs, and
  // is the tab part of this role's job at all? The second is what stops a
  // Registrar being handed a Faculty Coordinator's screen.
  const visibleTabs = useMemo(() => orderTabsForRole(currentRole, TABS.filter((item) => (
    (item.id !== 'people' || PEOPLE_ROLES.has(currentRole))
      && (item.id !== 'alumni' || PEOPLE_ROLES.has(currentRole))
      && (item.id !== 'audit' || PEOPLE_ROLES.has(currentRole))
      && (item.id !== 'data' || DATA_ROLES.has(currentRole))
      && (item.id !== 'records' || DIRECTORY_ROLES.has(currentRole))
      && (item.id !== 'approvals' || FYP_REVIEW_ROLES.has(currentRole) || LOGBOOK_REVIEW_ROLES.has(currentRole))
      && consoleForRole(currentRole).tabOrder.includes(item.id)
  ))), [currentRole]);
  const { getTabProps } = useAccessibleTabs(visibleTabs.map((item) => item.id), tab, setTab);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      setOverview(await fetchAdminOverview(currentRole));
    } catch (error) {
      setOverviewError(error.message || 'Could not load live operational metrics.');
    } finally {
      setOverviewLoading(false);
    }
  }, [currentRole]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    setTab(requestedTab ?? roleConsole.defaultTab);
  }, [currentRole, requestedTab, roleConsole.defaultTab]);

  // Land on the tab this role's job starts at, and never strand them on a tab
  // their role does not have.
  useEffect(() => {
    if (!visibleTabs.some((item) => item.id === tab)) {
      const preferred = visibleTabs.find((item) => item.id === roleConsole.defaultTab);
      setTab(preferred?.id ?? visibleTabs[0]?.id ?? 'overview');
    }
  }, [tab, visibleTabs, roleConsole.defaultTab]);

  const scopedStudents = useMemo(() => (overview?.students ?? []).filter((student) => {
    const facultyMatch = facultyFilter === 'all' || student.facultyId === facultyFilter;
    const queryMatch = !query.trim() || `${student.name} ${student.id} ${student.programme}`.toLowerCase().includes(query.trim().toLowerCase());
    return facultyMatch && queryMatch;
  }), [overview?.students, facultyFilter, query]);

  const pendingApprovalCount = (overview?.pendingApprovals ?? []).reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col gap-4 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">{roleConsole.eyebrow}</p>
          <h1 className="section-title mt-1 flex items-center gap-2.5"><ShieldCheck className="h-6 w-6 text-crimson" /> {roleConsole.title}</h1>
          <p className="section-subtitle mt-1.5 max-w-2xl">{roleConsole.purpose}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className={`badge-pill border ${overview ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />{overviewLoading ? 'Loading live operations…' : overview ? 'Live database operations' : 'Live operations unavailable'}</span><span className="badge-pill border border-black/10 bg-white text-muted">{currentRole === 'FACULTY_COORDINATOR' ? `${activeFaculty.code} scope` : overview?.scope === 'DEMO_STUDENT' ? 'Standalone demo scope' : 'University-wide'}</span>{fypStatus && <span className="badge-pill border border-crimson/20 bg-crimson/[0.05] text-crimson">Your FYP: {fypStatus.replace('_', ' ')}</span>}</div>
      </div>

      {overviewError && <div className="flex items-center justify-between gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert"><span>{overviewError}</span><button type="button" onClick={loadOverview} className="secondary-btn px-3 py-2 text-xs">Retry</button></div>}

      <div className="flex gap-2 overflow-x-auto border-b border-black/10 pb-2" role="tablist" aria-label="Admin views">
        {visibleTabs.map(({ id, label, icon: Icon }) => <button key={id} {...getTabProps(id)} type="button" role="tab" id={`admin-tab-${id}`} aria-selected={tab === id} aria-controls={`admin-panel-${id}`} onClick={() => setTab(id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition ${tab === id ? 'bg-crimson text-white' : 'text-muted hover:bg-black/[0.04] hover:text-[#1d1d1f]'}`}><Icon className="h-4 w-4" />{label}{id === 'approvals' && pendingApprovalCount > 0 && <span className={`rounded-full px-1.5 text-[10px] ${tab === id ? 'bg-white/20' : 'bg-crimson/10 text-crimson'}`}>{pendingApprovalCount}</span>}</button>)}
      </div>

      <section className="surface p-5" aria-labelledby="role-tasks-title">
        <h2 id="role-tasks-title" className="text-xs font-bold uppercase tracking-wide text-muted">What to do here</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {roleConsole.tasks.map((task) => {
            const label = typeof task === 'string' ? task : task.label;
            const href = typeof task === 'string' ? '/admin?tab=records' : task.href;
            return (
            <li key={`${href}-${label}`} className="rounded-[14px] border border-black/10 bg-black/[0.02] text-sm text-[#1d1d1f]">
              <Link href={href} className="flex min-h-14 items-start gap-2 p-3 transition hover:bg-white/70">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
              </Link>
            </li>
            );
          })}
        </ul>
      </section>

      <div id={`admin-panel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`} tabIndex={0}>
      {tab === 'records' && DIRECTORY_ROLES.has(currentRole) && <StudentDirectory currentRole={currentRole} />}

      {tab === 'overview' && <AdminSuperDashboard overview={overview} />}

      {tab === 'students' && (
        <>
          {/* The page header badge says "Live database operations", and for the
              People, Audit and Analytics tabs that is true. This tab is not:
              buildCohort() in components/admin/cohort.js synthesises a cohort
              from the seeded student plus the faculty/workshop fixtures. An
              administrator must not mistake a modelled cohort for a real one,
              so the tab states its own provenance rather than inheriting a
              claim made for its neighbours. */}
          <p
            className="mb-4 flex items-start gap-2 rounded-[18px] border border-amber-300 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900"
            role="note"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span>
              <strong>Modelled cohort, not live data.</strong> This view projects one seeded student
              across the faculty and workshop fixtures to demonstrate the at-risk signals. The
              People, Audit and Analytics tabs read the real database.
            </span>
          </p>
          <StudentHealth students={scopedStudents} currentRole={currentRole} facultyFilter={facultyFilter} setFacultyFilter={setFacultyFilter} query={query} setQuery={setQuery} onSelect={setSelectedStudent} loading={overviewLoading} />
        </>
      )}

      {tab === 'approvals' && (
        <div className="space-y-8">
          {FYP_REVIEW_ROLES.has(currentRole) && <FypApprovalQueue currentRole={currentRole} />}
          {LOGBOOK_REVIEW_ROLES.has(currentRole) && <LogbookReviewQueue currentRole={currentRole} />}
          {WORKSHOP_REQUEST_ROLES.has(currentRole) && <WorkshopRequestQueue currentRole={currentRole} />}
          <ApprovalSummary items={overview?.pendingApprovals ?? []} />
        </div>
      )}

      {tab === 'analytics' && <AnalyticsView students={scopedStudents} overview={overview} />}

      {tab === 'people' && PEOPLE_ROLES.has(currentRole) && <IdentityManagement activeFaculty={activeFaculty} currentRole={currentRole} />}

      {tab === 'audit' && PEOPLE_ROLES.has(currentRole) && <AuditLogPanel currentRole={currentRole} />}

      {tab === 'alumni' && PEOPLE_ROLES.has(currentRole) && <AlumniTracker currentRole={currentRole} />}

      {tab === 'data' && DATA_ROLES.has(currentRole) && <DataExplorer currentRole={currentRole} />}
      </div>

      {selectedStudent && <IdentityDrawer student={selectedStudent} canOverride={currentRole === 'SUPER_ADMIN'} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
}

function StudentHealth({ students, currentRole, facultyFilter, setFacultyFilter, query, setQuery, onSelect, loading }) {
  const highRisk = students.filter((student) => student.risk === 'high').length;
  return <section className="space-y-5">
    {loading && <div className="surface p-4 text-sm text-muted" role="status">Loading scoped student records from the database…</div>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Metric label="Students in scope" value={students.length} icon={Users} /><Metric label="Need attention" value={students.filter((s) => s.risk !== 'low').length} icon={AlertTriangle} tone="amber" /><Metric label="High risk" value={highRisk} icon={Gauge} tone="crimson" /></div>
    <div className="surface space-y-4 p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input aria-label="Search students" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, student ID or programme" className="h-11 w-full rounded-[16px] border border-black/10 bg-black/[0.03] pl-10 pr-4 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20" /></div><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-muted" /><select aria-label="Filter students by faculty" value={facultyFilter} onChange={(event) => setFacultyFilter(event.target.value)} disabled={currentRole === 'FACULTY_COORDINATOR'} className="h-11 rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson"><option value="all">All faculties</option>{FACULTIES.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.code} · {faculty.name}</option>)}</select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Students needing employability support</caption><thead><tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-muted"><th scope="col" className="px-3 py-3">Student</th><th scope="col" className="px-3 py-3">Scope</th><th scope="col" className="px-3 py-3">Readiness</th><th scope="col" className="px-3 py-3">Risk</th><th scope="col" className="px-3 py-3">Next intervention</th><th scope="col" className="px-3 py-3" /></tr></thead><tbody className="divide-y divide-black/10">{students.map((student) => <tr key={student.id} className="hover:bg-black/[0.025]"><td className="px-3 py-4"><p className="font-semibold">{student.name}</p><p className="text-xs text-muted">{student.id} · Year {student.year}</p></td><td className="px-3 py-4 text-xs text-muted">{FACULTIES.find((faculty) => faculty.id === student.facultyId)?.code} · {student.programme}</td><td className="px-3 py-4"><div className="flex items-center gap-2"><div className="h-2 w-20 rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-crimson" style={{ width: `${student.readiness}%` }} /></div><span className="text-xs font-semibold">{student.readiness}%</span></div></td><td className="px-3 py-4"><span className={`badge-pill border ${student.risk === 'high' ? 'border-red-200 bg-red-50 text-red-700' : student.risk === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{student.risk}</span></td><td className="px-3 py-4 text-xs text-muted">{student.missing}</td><td className="px-3 py-4 text-right"><button type="button" onClick={() => onSelect(student)} className="secondary-btn px-3 py-2 text-xs">Review <ArrowRight className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table>{students.length === 0 && <p className="p-8 text-center text-sm text-muted">No students match this view.</p>}</div></div>
  </section>;
}

function AnalyticsView({ students, overview }) {
  const avg = students.length ? Math.round(students.reduce((sum, student) => sum + student.readiness, 0) / students.length) : 0;
  const metrics = overview?.metrics ?? {};
  const bars = [
    { label: 'FYP reviews outstanding', value: metrics.pendingFyp ?? 0, max: Math.max(1, students.length) },
    { label: 'Logbook reviews outstanding', value: metrics.pendingLogbook ?? 0, max: Math.max(1, students.length * 2) },
    { label: 'Course verifications outstanding', value: metrics.pendingCourses ?? 0, max: Math.max(1, students.length) },
    { label: 'Upcoming workshops', value: metrics.upcomingWorkshops ?? 0, max: Math.max(1, metrics.upcomingWorkshops ?? 1) },
  ];
  return <section className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Metric label="Average readiness" value={`${overview ? (metrics.readinessAverage ?? avg) : avg}%`} icon={Gauge} /><Metric label="Students in scope" value={overview ? metrics.studentsInScope : '—'} icon={GraduationCap} /><Metric label="Pending actions" value={overview ? (metrics.pendingFyp ?? 0) + (metrics.pendingLogbook ?? 0) + (metrics.pendingCourses ?? 0) : '—'} icon={Clock3} /></div><div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.85fr]"><div className="surface space-y-5 p-6"><div><p className="text-xs font-bold uppercase tracking-wide text-muted">Operational queue</p><h2 className="mt-1 font-heading text-xl font-semibold">What needs attention</h2></div>{bars.map((bar) => <div key={bar.label} className="space-y-2"><div className="flex justify-between text-sm"><span>{bar.label}</span><span className="font-semibold">{bar.value}</span></div><div className="h-2.5 rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-crimson" style={{ width: `${Math.min(100, Math.round((bar.value / bar.max) * 100))}%` }} /></div></div>)}</div><div className="surface space-y-4 p-6"><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-crimson" /><h2 className="font-heading text-xl font-semibold">Latest audit activity</h2></div>{(overview?.audit ?? []).slice(0, 4).map((entry) => <div key={entry.id} className="border-b border-black/[0.06] pb-3 text-xs"><p className="font-semibold">{entry.action}</p><p className="mt-1 text-muted">{entry.resourceType} · {entry.actor?.name ?? 'System'} · {new Date(entry.createdAt).toLocaleString()}</p></div>)}{!overview?.audit?.length && <p className="text-sm text-muted">No audit activity is available in this scope yet.</p>}</div></div></section>;
}

function ApprovalSummary({ items }) {
  return <section className="space-y-4"><div className="surface border-crimson/20 bg-crimson/[0.03] p-5"><div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-crimson" /><div><h2 className="font-heading font-semibold">Live review workload</h2><p className="mt-1 text-sm text-muted">Counts are derived from pending database records. Open the owning module to make a scoped decision.</p></div></div></div>{items.length ? <div className="grid gap-3 lg:grid-cols-3">{items.map((item) => <div key={item.id} className="surface p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{item.type}</p><p className="mt-2 font-heading text-3xl font-bold">{item.count}</p><p className="mt-1 text-xs text-muted">pending in this scope</p>{item.href ? <Link href={item.href} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-crimson hover:underline">Open owning module <ArrowRight className="h-3.5 w-3.5" /></Link> : null}</div>)}</div> : <div className="surface p-10 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 font-semibold">Review workload clear</p><p className="mt-1 text-sm text-muted">New records will appear here when students submit them.</p></div>}</section>;
}

function IdentityDrawer({ student, canOverride, onClose }) {
  return <DismissibleDialog onClose={onClose} labelledBy="identity-drawer-title" overlayClassName="items-stretch justify-end bg-black/30 p-0" className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-black/10 pb-5"><div><p className="text-xs font-bold uppercase tracking-wide text-crimson">Identity matrix</p><h2 id="identity-drawer-title" className="mt-1 font-heading text-xl font-semibold">{student.name}</h2><p className="mt-1 text-sm text-muted">{student.id} · {student.programme}</p></div><button type="button" onClick={onClose} aria-label="Close identity review" className="rounded-xl p-2 text-muted hover:bg-black/[0.04]"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-4"><ReadOnlyRow label="Faculty" value={FACULTIES.find((faculty) => faculty.id === student.facultyId)?.name ?? student.facultyId} /><ReadOnlyRow label="Academic year" value={`Year ${student.year}`} /><ReadOnlyRow label="Career readiness" value={`${student.readiness}%`} /><ReadOnlyRow label="At-risk signal" value={`${student.risk} · ${student.missing}`} /></div>{canOverride ? <div className="mt-7 rounded-[18px] border border-crimson/20 bg-crimson/[0.04] p-4"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-4 w-4 text-crimson" /><div><p className="text-sm font-semibold">Superadmin override enabled</p><p className="mt-1 text-xs leading-relaxed text-muted">Verified identity changes are available from the People &amp; access tab and always create an audit entry. This drawer is intentionally read-only.</p></div></div><button type="button" className="secondary-btn mt-4 w-full justify-center text-xs" onClick={onClose}>Close read-only review <ArrowRight className="h-3.5 w-3.5" /></button></div> : <p className="mt-7 text-xs text-muted">Identity fields are read-only for this role. Ask a Superadmin to make a verified reassignment.</p>}</DismissibleDialog>;
}

function ReadOnlyRow({ label, value }) { return <div className="flex items-start justify-between gap-4 rounded-[16px] border border-black/10 bg-black/[0.03] p-4"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span><span className="max-w-[60%] text-right text-sm font-medium">{value}</span></div>; }
function Metric({ label, value, icon: Icon, tone = 'crimson' }) { return <div className="surface p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span><Icon className={`h-4 w-4 ${tone === 'amber' ? 'text-amber-600' : 'text-crimson'}`} /></div><p className="mt-3 font-heading text-3xl font-bold tabular-nums">{value}</p></div>; }
