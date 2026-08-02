'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Search,
  Users,
} from 'lucide-react';

import { DerivationNote, Metric, Toolbar, ToolbarSelect, downloadCsv } from '@/components/admin/AdminUI';
import StudentRecord from '@/components/admin/StudentRecord';

/**
 * The staff student directory: search a cohort, open one student, read the part
 * of their record your role is entitled to.
 *
 * Every scoping decision is the server's. This component never filters rows for
 * safety — it only asks /api/students, which will not return a student outside
 * the caller's scope. That is why the faculty dropdown is built from the
 * response's facets rather than from the static faculty list: a coordinator's
 * dropdown should contain their faculty and nothing else.
 */

const ATTENTION_STYLES = {
  high: { icon: AlertTriangle, className: 'border-red-200 bg-red-50 text-red-800' },
  medium: { icon: CircleAlert, className: 'border-amber-200 bg-amber-50 text-amber-900' },
  low: { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
};

/** Meaning is never carried by colour alone — every pill has an icon and a word. */
function AttentionPill({ level, label }) {
  const style = ATTENTION_STYLES[level] ?? ATTENTION_STYLES.low;
  const Icon = style.icon;
  return (
    <span className={`badge-pill border ${style.className} inline-flex items-center gap-1.5`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

function CompletenessBar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-20 shrink-0 rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full bg-crimson transition-[width] duration-500" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums">{value}%</span>
    </div>
  );
}

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function StudentDirectory({ currentRole }) {
  const [search, setSearch] = useState('');
  const [facultyId, setFacultyId] = useState('all');
  const [programmeId, setProgrammeId] = useState('all');
  const [year, setYear] = useState('all');
  const [needsAttention, setNeedsAttention] = useState(false);
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const debouncedSearch = useDebounced(search);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (facultyId !== 'all') params.set('facultyId', facultyId);
      if (programmeId !== 'all') params.set('programmeId', programmeId);
      if (year !== 'all') params.set('year', year);
      if (needsAttention) params.set('needsAttention', 'true');
      params.set('page', String(page));

      const response = await fetch(`/api/students?${params.toString()}`, {
        cache: 'no-store',
        headers: currentRole ? { 'x-demo-role': currentRole } : {},
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not load the student directory.');
      setData(payload);
    } catch (loadError) {
      setError(loadError.message || 'Could not load the student directory.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [currentRole, debouncedSearch, facultyId, programmeId, year, needsAttention, page]);

  useEffect(() => { load(); }, [load]);

  // Any change to a filter puts you back on page 1; staying on page 4 of a
  // narrower result set is how staff conclude the search is broken.
  useEffect(() => { setPage(1); }, [debouncedSearch, facultyId, programmeId, year, needsAttention]);

  const students = data?.students ?? [];
  const facets = data?.facets ?? { faculties: [], programmes: [], years: [] };

  const programmeOptions = useMemo(() => {
    const list = facultyId === 'all'
      ? facets.programmes
      : facets.programmes.filter((programme) => programme.facultyId === facultyId);
    return [{ value: 'all', label: 'All programmes' }, ...list.map((programme) => ({ value: programme.id, label: programme.name }))];
  }, [facets.programmes, facultyId]);

  const exportCsv = () => {
    const header = ['Matric number', 'Name', 'Faculty', 'Programme', 'Year', 'Record completeness %', 'Attention', 'Approved hours', 'What is missing'];
    const rows = students.map((student) => [
      student.matricNo,
      student.name,
      student.faculty ?? '',
      student.programme ?? '',
      student.year,
      student.readiness,
      student.attention,
      student.approvedHours,
      student.outstanding.join('; ') || 'Nothing outstanding',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadCsv(`qiu-student-directory-page-${page}.csv`, csv);
  };

  if (selectedId) {
    return (
      <section className="space-y-5">
        <button type="button" onClick={() => setSelectedId(null)} className="secondary-btn min-h-[44px] px-3.5 text-xs">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the student list
        </button>
        <StudentRecord studentId={selectedId} currentRole={currentRole} />
      </section>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const needingAttention = students.filter((student) => student.attentionLevel !== 'low').length;

  return (
    <section className="space-y-5">
      <div className="surface space-y-2 p-5">
        <h2 className="font-heading text-lg font-bold text-[#1d1d1f]">Student records</h2>
        <p className="text-sm text-muted">
          Search for a student, then open their record. You will see the parts of the record your role is responsible for,
          and a note explaining anything that is held back.
        </p>
        {data?.scope?.description ? (
          <p className="flex items-start gap-2 rounded-[14px] border border-black/10 bg-black/[0.02] p-3 text-xs leading-relaxed text-muted">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-[#1d1d1f]">Who you can see: </strong>
              {data.scope.description}
              {data.scope.demo ? ' (Demo mode: your scope is taken from the seeded cohort.)' : ''}
            </span>
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{error}</span>
          <button type="button" onClick={load} className="secondary-btn min-h-[44px] px-3.5 text-xs">Try again</button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Students you can see" value={data ? data.total : '—'} context="Matching your search and filters" icon={Users} />
        <Metric label="On this page" value={students.length} context={`Page ${data?.page ?? 1} of ${totalPages}`} />
        <Metric label="Needing follow-up" value={data ? needingAttention : '—'} context="On this page, from their live records" icon={AlertTriangle} tone="amber" />
      </div>

      <div className="surface space-y-4 p-5">
        <Toolbar onExport={students.length ? exportCsv : undefined} exportLabel="Export this page" note={`${data?.total ?? 0} in scope`}>
          <label className="relative min-w-0 flex-1 basis-full sm:basis-64">
            <span className="sr-only">Search students by name, matric number or email</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, matric number or email"
              className="min-h-[44px] w-full rounded-[14px] border border-black/10 bg-black/[0.03] pl-10 pr-4 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20"
            />
          </label>

          <ToolbarSelect
            label="Faculty"
            value={facultyId}
            onChange={(value) => { setFacultyId(value); setProgrammeId('all'); }}
            options={[{ value: 'all', label: 'All faculties' }, ...facets.faculties.map((faculty) => ({ value: faculty.id, label: `${faculty.code} · ${faculty.name}` }))]}
          />
          <ToolbarSelect label="Programme" value={programmeId} onChange={setProgrammeId} options={programmeOptions} />
          <ToolbarSelect
            label="Year of study"
            value={year}
            onChange={setYear}
            options={[{ value: 'all', label: 'All years' }, ...[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `Year ${value}` }))]}
          />
          <label className="flex min-h-[44px] items-center gap-2 rounded-[14px] border border-black/10 bg-white px-3 text-xs font-semibold text-[#1d1d1f]">
            <input
              type="checkbox"
              checked={needsAttention}
              onChange={(event) => setNeedsAttention(event.target.checked)}
              className="h-4 w-4 accent-[#e50914]"
            />
            Only students needing follow-up
          </label>
        </Toolbar>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted" role="status">Loading student records from the database…</p>
        ) : students.length === 0 ? (
          <div className="space-y-2 py-12 text-center">
            <p className="font-heading text-base font-semibold text-[#1d1d1f]">No students to show</p>
            <p className="mx-auto max-w-md text-sm text-muted">
              {data?.emptyReason
                ?? (search || facultyId !== 'all' || programmeId !== 'all' || year !== 'all' || needsAttention
                  ? 'Nothing matches these filters. Clear the search box, or set the faculty and year back to “All”.'
                  : 'There are no student records in your scope yet. They will appear here as students are enrolled.')}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop: one row per student. */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <caption className="sr-only">Students you are responsible for</caption>
                <thead>
                  <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-muted">
                    <th scope="col" className="px-3 py-3">Student</th>
                    <th scope="col" className="px-3 py-3">Programme</th>
                    <th scope="col" className="px-3 py-3">Year</th>
                    <th scope="col" className="px-3 py-3">Record completeness</th>
                    <th scope="col" className="px-3 py-3">Attention</th>
                    <th scope="col" className="px-3 py-3">What is still missing</th>
                    <th scope="col" className="px-3 py-3"><span className="sr-only">Open record</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-black/[0.025]">
                      <td className="px-3 py-4">
                        <p className="font-semibold text-[#1d1d1f]">{student.name}</p>
                        <p className="text-xs text-muted">{student.matricNo}</p>
                      </td>
                      <td className="px-3 py-4 text-xs text-muted">{student.facultyCode ? `${student.facultyCode} · ` : ''}{student.programme ?? '—'}</td>
                      <td className="px-3 py-4 text-sm tabular-nums">{student.year}</td>
                      <td className="px-3 py-4"><CompletenessBar value={student.readiness} /></td>
                      <td className="px-3 py-4"><AttentionPill level={student.attentionLevel} label={student.attention} /></td>
                      <td className="px-3 py-4 text-xs text-muted">{student.outstanding.length ? student.outstanding.join(' · ') : 'Nothing outstanding'}</td>
                      <td className="px-3 py-4 text-right">
                        <button type="button" onClick={() => setSelectedId(student.id)} className="secondary-btn min-h-[44px] px-3.5 text-xs">
                          Open record <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: the same rows as cards, so nothing needs sideways scrolling. */}
            <ul className="space-y-3 lg:hidden">
              {students.map((student) => (
                <li key={student.id} className="rounded-[16px] border border-black/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#1d1d1f]">{student.name}</p>
                      <p className="text-xs text-muted">{student.matricNo} · Year {student.year}</p>
                    </div>
                    <AttentionPill level={student.attentionLevel} label={student.attention} />
                  </div>
                  <p className="mt-2 text-xs text-muted">{student.facultyCode ? `${student.facultyCode} · ` : ''}{student.programme ?? '—'}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <CompletenessBar value={student.readiness} />
                    <button type="button" onClick={() => setSelectedId(student.id)} className="secondary-btn min-h-[44px] px-3.5 text-xs">
                      Open record <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    <span className="font-semibold text-[#1d1d1f]">Still missing: </span>
                    {student.outstanding.length ? student.outstanding.join(' · ') : 'Nothing outstanding'}
                  </p>
                </li>
              ))}
            </ul>

            <DerivationNote>
              “Record completeness” counts five checks the platform can verify: a complete profile, at least one approved
              fieldwork entry, an approved Final Year Project, a passed skills diagnostic, and at least one verified course.
              It is not a grade and it is not an official academic result.
            </DerivationNote>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-black/10 pt-4">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="secondary-btn min-h-[44px] px-3.5 text-xs disabled:opacity-40">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous
                </button>
                <span className="text-xs text-muted">Page {data.page} of {totalPages}</span>
                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="secondary-btn min-h-[44px] px-3.5 text-xs disabled:opacity-40">
                  Next <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
