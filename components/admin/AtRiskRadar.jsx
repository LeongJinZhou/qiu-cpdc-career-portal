'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  FlaskConical,
  Gauge,
  Search,
  Users,
} from 'lucide-react';
import { FACULTIES } from '@/lib/data/facultyData';
import { cohortToCsv, RISK_LABELS, STATUS_LABELS, facultyOf } from './cohort';
import { BarList, DerivationNote, Metric, Toolbar, ToolbarSelect, downloadCsv } from './AdminUI';

/** Flag icons are keyed by name so the data layer stays free of JSX imports. */
const FLAG_ICONS = { FlaskConical, BookOpen, FileText, AlertTriangle };

const RISK_STYLES = {
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  watch: 'border-black/10 bg-black/[0.04] text-[#424245]',
  clear: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const RISK_ORDER = { high: 0, medium: 1, watch: 2, clear: 3 };

/**
 * At-risk radar (Module 13).
 *
 * Flags final-year students missing an FYP, logbook hours or a complete
 * resume. Risk is never conveyed by colour alone: each row carries the risk
 * word, and each flag carries its own icon and sentence.
 */
export default function AtRiskRadar({ rows, currentRole, facultyFilter, setFacultyFilter, onSelect }) {
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [finalYearOnly, setFinalYearOnly] = useState(false);

  const coordinatorLocked = currentRole === 'FACULTY_COORDINATOR';

  const visible = useMemo(() => rows
    .filter((row) => {
      const matchesQuery = !query.trim()
        || `${row.name} ${row.id} ${row.programme}`.toLowerCase().includes(query.trim().toLowerCase());
      const matchesRisk = riskFilter === 'all' || row.risk === riskFilter;
      const matchesYear = !finalYearOnly || row.isFinalYear;
      return matchesQuery && matchesRisk && matchesYear;
    })
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.readiness - b.readiness),
  [rows, query, riskFilter, finalYearOnly]);

  const finalYear = rows.filter((row) => row.isFinalYear);
  const highRisk = rows.filter((row) => row.risk === 'high');
  const missingFyp = finalYear.filter((row) => row.flags.some((flag) => flag.id === 'fyp'));
  const shortHours = rows.filter((row) => row.flags.some((flag) => flag.id === 'logbook'));
  const incompleteResume = rows.filter((row) => row.flags.some((flag) => flag.id === 'resume'));

  const triggers = [
    { id: 'fyp', label: 'Final-year, no FYP under review', count: missingFyp.length, value: missingFyp.length },
    { id: 'logbook', label: 'Logbook hours below requirement', count: shortHours.length, value: shortHours.length },
    { id: 'resume', label: 'Resume incomplete', count: incompleteResume.length, value: incompleteResume.length },
  ];

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Students in scope" value={rows.length} context="Demo cohort rows visible to your role" icon={Users} />
        <Metric label="Final year" value={finalYear.length} context="Subject to the at-risk rules below" icon={Gauge} />
        <Metric label="High risk" value={highRisk.length} context="Final year with 2 or more open flags" icon={AlertTriangle} tone="amber" />
      </div>

      <div className="glass-panel space-y-5 p-5 sm:p-6">
        <Toolbar
          onExport={() => downloadCsv('qiu-at-risk-radar.csv', cohortToCsv(visible))}
          note={`${visible.length} of ${rows.length} rows`}
        >
          <ToolbarSelect
            label="Faculty"
            value={facultyFilter}
            onChange={setFacultyFilter}
            disabled={coordinatorLocked}
            options={[
              { value: 'all', label: 'All faculties' },
              ...FACULTIES.map((faculty) => ({ value: faculty.id, label: `${faculty.code} · ${faculty.name}` })),
            ]}
          />
          <ToolbarSelect
            label="Risk"
            value={riskFilter}
            onChange={setRiskFilter}
            options={[
              { value: 'all', label: 'Any risk level' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'watch', label: 'Watch' },
              { value: 'clear', label: 'On track' },
            ]}
          />
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[14px] border border-black/10 bg-white px-3 text-xs font-semibold text-[#424245]">
            <input
              type="checkbox"
              checked={finalYearOnly}
              onChange={(event) => setFinalYearOnly(event.target.checked)}
              className="h-4 w-4 accent-crimson"
            />
            Final year only
          </label>
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              aria-label="Search students"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, ID or programme"
              className="h-11 w-full rounded-[14px] border border-black/10 bg-black/[0.03] pl-9 pr-3 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20"
            />
          </div>
        </Toolbar>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <caption className="sr-only">At-risk radar for the demo cohort</caption>
            <thead>
              <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-muted">
                <th scope="col" className="px-3 py-3">Student</th>
                <th scope="col" className="px-3 py-3">Scope</th>
                <th scope="col" className="px-3 py-3">Readiness</th>
                <th scope="col" className="px-3 py-3">Risk</th>
                <th scope="col" className="px-3 py-3">Open flags</th>
                <th scope="col" className="px-3 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {visible.map((row) => (
                <tr key={row.id} className="align-top hover:bg-black/[0.025]">
                  <td className="px-3 py-4">
                    <p className="font-semibold text-[#1d1d1f]">{row.name}</p>
                    <p className="text-xs text-muted">
                      {row.id} · Year {row.year}
                      {row.isFinalYear ? ' · final year' : ''}
                    </p>
                    {row.status !== 'ACTIVE' ? (
                      <span className="badge-pill mt-1.5 border border-amber-200 bg-amber-50 text-amber-800">{STATUS_LABELS[row.status]}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-4 text-xs text-muted">
                    <span className="font-semibold text-[#424245]">{facultyOf(row.facultyId)?.code}</span>
                    <br />{row.programme}
                    {row.overridden ? <span className="badge-pill mt-1.5 border border-crimson/20 bg-crimson/[0.06] text-crimson">Overridden</span> : null}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-black/[0.06]">
                        <div className="h-full rounded-full bg-crimson" style={{ width: `${row.readiness}%` }} />
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{row.readiness}%</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{row.tier} · {row.xp.toLocaleString()} XP</p>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`badge-pill border ${RISK_STYLES[row.risk]}`}>
                      {row.risk === 'clear'
                        ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        : <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}
                      {RISK_LABELS[row.risk]}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    {row.flags.length === 0 ? (
                      <span className="text-xs text-muted">None</span>
                    ) : (
                      <ul className="space-y-1.5">
                        {row.flags.map((flag) => {
                          const Icon = FLAG_ICONS[flag.icon] ?? AlertTriangle;
                          return (
                            <li key={flag.id} className="flex items-start gap-1.5 text-xs text-[#424245]">
                              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                              <span>{flag.label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <button type="button" onClick={() => onSelect(row)} className="secondary-btn min-h-[44px] px-3 text-xs">
                      Review <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? <p className="p-8 text-center text-sm text-muted">No students match this view.</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BarList
          title="What is triggering flags"
          caption={`Counted across the ${rows.length} students in scope.`}
          data={triggers}
          unit="count"
        />
        <div className="space-y-3">
          <DerivationNote>
            Readiness is the unweighted mean of five components — FYP status, logbook hours against the
            faculty requirement, resume sections filled, workshops attended out of three, and whether the
            skills diagnostic has been taken. Nothing here is a projected placement rate.
          </DerivationNote>
          <DerivationNote>
            Rows come from the demo cohort fixture plus the signed-in demo student&apos;s live state, so a
            submission made in the student view moves these numbers straight away.
          </DerivationNote>
        </div>
      </div>
    </section>
  );
}
