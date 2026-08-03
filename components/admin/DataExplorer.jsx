'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Database,
  Download,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  Table,
  X,
} from 'lucide-react';
import { buildCsv } from '@/lib/csv';
import DismissibleDialog from '@/components/ui/DismissibleDialog';

const ENTITIES = [
  { id: 'student', label: 'Students', desc: 'Every student record with the Employee ID, course code and email read from the QIU Google directory at login.' },
  { id: 'assessmentAttempt', label: 'Assessment Attempts', desc: 'Raw diagnostic attempts, readiness scores, and completion metrics across faculties.' },
  { id: 'application', label: 'Job Applications', desc: 'Active student talent recruitment submissions, interview progression, and hiring stages.' },
  { id: 'workshop', label: 'Workshop Catalogue', desc: 'Global events schedule, speaker assignments, time-gated QR check-ins, and RSVP ledgers.' },
  { id: 'courseEnrolment', label: 'Course Enrolments', desc: 'Coursera and internal AI learning track progression, certificate verifications, and XP rewards.' },
  { id: 'auditLog', label: 'Security Audit Log', desc: 'Immutable security tracking ledger recording every protected administrative database read/write.' },
];

const COLUMN_LABELS = {
  id: 'Record ID',
  name: 'Name',
  employeeId: 'Employee ID',
  courseCode: 'Course',
  email: 'Email',
  faculty: 'Faculty',
  directorySyncedAt: 'Directory synced',
  student: 'Student',
  matricNo: 'Student ID',
  assessment: 'Assessment',
  score: 'Score',
  passed: 'Result',
  submittedAt: 'Submitted',
  posting: 'Job posting',
  stage: 'Stage',
  appliedAt: 'Applied',
  title: 'Title',
  category: 'Category',
  startsAt: 'Starts',
  capacity: 'Capacity',
  rsvps: 'RSVPs',
  courseId: 'Course',
  status: 'Status',
  enrolledAt: 'Enrolled',
  action: 'Action',
  resourceType: 'Record type',
  resourceId: 'Record ID',
  actorUserId: 'Actor ID',
  at: 'Recorded',
};

const DATE_COLUMNS = new Set(['submittedAt', 'appliedAt', 'startsAt', 'enrolledAt', 'at', 'directorySyncedAt']);

function displayValue(column, value) {
  if (value == null || value === '') return '—';
  if (DATE_COLUMNS.has(column)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return String(value);
}

export default function DataExplorer({ currentRole }) {
  const [activeEntity, setActiveEntity] = useState('student');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [exporting, setExporting] = useState(false);
  const tabRefs = useRef([]);

  const selectEntity = useCallback((entityId) => {
    setActiveEntity(entityId);
    setPage(1);
    setQuery('');
    setSelectedRow(null);
  }, []);

  const handleEntityKeyDown = useCallback((event, index) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % ENTITIES.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + ENTITIES.length) % ENTITIES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = ENTITIES.length - 1;
    if (nextIndex === index) return;
    event.preventDefault();
    selectEntity(ENTITIES[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }, [selectEntity]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1); // Reset to first page on search query change
    }, 350);
    return () => clearTimeout(handler);
  }, [query]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/data/${activeEntity}?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(debouncedQuery)}`, {
        headers: { 'x-demo-role': currentRole || 'SUPER_ADMIN' },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load cross-student dataset from database.');
      }
      setData(json);
    } catch (err) {
      setError(err.message || 'Error occurred while querying database explorer.');
    } finally {
      setLoading(false);
    }
  }, [activeEntity, page, pageSize, debouncedQuery, currentRole]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Export every row matching the current data set + search (not just the page
  // on screen) by walking pages at the server's max size. Bounded so a huge
  // table can never spin forever; each fetched page is still audited server-side.
  const handleExport = useCallback(async () => {
    setExporting(true);
    setError('');
    try {
      const MAX_PAGES = 200;
      const EXPORT_PAGE_SIZE = 100;
      let columns = data?.columns ?? [];
      const allRows = [];
      for (let p = 1; p <= MAX_PAGES; p += 1) {
        const res = await fetch(`/api/admin/data/${activeEntity}?page=${p}&pageSize=${EXPORT_PAGE_SIZE}&q=${encodeURIComponent(debouncedQuery)}`, {
          headers: { 'x-demo-role': currentRole || 'SUPER_ADMIN' },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Export failed while reading the data set.');
        if (Array.isArray(json.columns) && json.columns.length) columns = json.columns;
        allRows.push(...(json.rows ?? []));
        if (p >= (json.pageCount ?? 1)) break;
      }
      if (!allRows.length) { setError('There are no records to export.'); return; }
      const blob = new Blob([buildCsv(columns, allRows, COLUMN_LABELS)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeEntity}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.message || 'The export could not be completed.');
    } finally {
      setExporting(false);
    }
  }, [activeEntity, debouncedQuery, currentRole, data?.columns]);

  const activeMeta = useMemo(() => ENTITIES.find((e) => e.id === activeEntity) || ENTITIES[0], [activeEntity]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Overview Banner */}
      <div className="surface p-6 border-l-4 border-crimson">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-crimson">
              <Database className="h-4 w-4" />
              <span>University-Wide Cross-Student Record Explorer</span>
            </div>
            <h2 className="text-xl font-heading font-bold mt-1 text-[#1d1d1f]">
              {activeMeta.label}
            </h2>
            <p className="text-sm text-muted mt-1 max-w-3xl">
              {activeMeta.desc} Every read interaction in this workspace is permanently committed to the security audit log (`ADMIN_DATA_EXPLORER_VIEWED`) with deduplication boundaries.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading}
              className="secondary-btn px-3.5 py-2 text-xs flex items-center gap-2 bg-white disabled:opacity-50"
              aria-label="Export every matching record as CSV"
            >
              <Download className={`h-4 w-4 ${exporting ? 'animate-pulse text-crimson' : 'text-muted'}`} />
              <span>{exporting ? 'Preparing…' : 'Export CSV'}</span>
            </button>
            <button
              type="button"
              onClick={loadRecords}
              disabled={loading}
              className="secondary-btn px-3.5 py-2 text-xs flex items-center gap-2 bg-white"
              aria-label="Refresh database view"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-crimson' : 'text-muted'}`} />
              <span>Refresh Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Entity Selector Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-black/10" role="tablist" aria-label="University data sets">
        {ENTITIES.map((ent) => {
          const isSelected = activeEntity === ent.id;
          return (
            <button
              key={ent.id}
              type="button"
              id={ent.id}
              ref={(node) => { tabRefs.current[ENTITIES.indexOf(ent)] = node; }}
              role="tab"
              aria-selected={isSelected}
              aria-controls="admin-data-table-panel"
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectEntity(ent.id)}
              onKeyDown={(event) => handleEntityKeyDown(event, ENTITIES.indexOf(ent))}
              className={`flex min-h-11 items-center gap-2 px-4 rounded-xl text-sm font-semibold transition shrink-0 ${
                isSelected
                  ? 'bg-[#1d1d1f] text-white shadow-sm'
                  : 'bg-black/[0.03] text-muted hover:bg-black/[0.06] hover:text-[#1d1d1f]'
              }`}
            >
              <Table className={`h-4 w-4 ${isSelected ? 'text-crimson' : 'text-muted'}`} />
              <span>{ent.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search Bar & Pagination Controls Header */}
      <div className="surface p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <label htmlFor="admin-data-search" className="sr-only">
            Search {activeMeta.label}
          </label>
          <input
            id="admin-data-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${activeMeta.label.toLowerCase()} by ID, student, or title...`}
            className="h-10 w-full rounded-xl border border-black/10 bg-black/[0.02] pl-10 pr-4 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20 transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-black"
              aria-label={`Clear ${activeMeta.label} search`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {data && (
          <div className="flex items-center gap-4 text-xs font-semibold text-muted">
            <span>
              Showing {Math.min(data.total, (data.page - 1) * data.pageSize + 1)} – {Math.min(data.total, data.page * data.pageSize)} of <strong className="text-[#1d1d1f] font-bold">{data.total}</strong> records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="icon-btn rounded-lg border border-black/10 hover:bg-black/[0.04] disabled:opacity-40 disabled:pointer-events-none transition"
                aria-label="Previous page"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="px-2.5 py-1 rounded-md bg-black/[0.04] text-[#1d1d1f]">
                Page {data.page} of {data.pageCount}
              </span>
              <button
                type="button"
                disabled={!data.pageCount || page >= data.pageCount || loading}
                onClick={() => setPage((p) => p + 1)}
                className="icon-btn rounded-lg border border-black/10 hover:bg-black/[0.04] disabled:opacity-40 disabled:pointer-events-none transition"
                aria-label="Next page"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={loadRecords} className="secondary-btn px-3 py-1.5 text-xs bg-white">
            Retry Connection
          </button>
        </div>
      )}

      {/* Records Table Display */}
      <div id="admin-data-table-panel" role="tabpanel" aria-labelledby={activeEntity} className="surface overflow-hidden border border-black/10">
        <div className="overflow-x-auto min-h-[360px]">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-black/[0.03] border-b border-black/10 text-[11px] font-bold uppercase tracking-wider text-muted">
                {(data?.columns || []).map((col) => (
                  <th key={col} className="px-4 py-3 font-bold">
                    {COLUMN_LABELS[col] || col}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {loading && !data?.rows?.length && (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-muted text-sm font-medium">
                    <RefreshCw className="h-6 w-6 animate-spin text-crimson mx-auto mb-2" />
                    Querying real database records for {activeMeta.label}...
                  </td>
                </tr>
              )}
              {!loading && (!data?.rows || data.rows.length === 0) && (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-muted text-sm font-medium">
                    <AlertCircle className="h-7 w-7 text-amber-500 mx-auto mb-2" />
                    No records matched your search query in this data dataset. Try relaxing your filter terms.
                  </td>
                </tr>
              )}
              {(data?.rows || []).map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className="hover:bg-crimson/[0.02] transition"
                >
                  {(data?.columns || []).map((col) => {
                    const val = row[col];
                    const isStatus = col === 'passed' || col === 'status' || col === 'stage' || col === 'risk';
                    return (
                      <td key={col} className="px-4 py-3.5 text-xs text-[#1d1d1f] font-medium max-w-[220px] truncate">
                        {isStatus ? (
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold border text-[11px] ${
                              val === 'Passed' || val === 'COMPLETED' || val === 'Approved'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : val === 'Not passed' || val === 'REJECTED'
                                ? 'bg-red-50 border-red-200 text-red-800'
                                : 'bg-blue-50 border-blue-200 text-blue-800'
                            }`}
                          >
                            {String(val)}
                          </span>
                        ) : (
                          displayValue(col, val)
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setSelectedRow(row)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/10 bg-white text-xs font-semibold hover:border-crimson hover:text-crimson transition shadow-2xs"
                      aria-label={`Inspect ${activeMeta.label} record ${row.id || idx + 1}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep Inspection Drawer Modal */}
      {selectedRow && (
        <DismissibleDialog
          onClose={() => setSelectedRow(null)}
          labelledBy="admin-inspector-title"
          overlayClassName="items-stretch justify-end bg-black/40 p-0"
          className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl"
        >
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-black/10 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-crimson">
                    {activeMeta.label} · Record Inspection
                  </span>
                  <h3 id="admin-inspector-title" className="font-heading font-bold text-lg text-[#1d1d1f] mt-0.5">
                    Record ID: {selectedRow.id || 'N/A'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  className="icon-btn"
                  aria-label="Close record inspector"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-xs text-muted font-medium mb-2">
                  Read-only details returned directly from the configured database through Prisma:
                </p>
                {Object.entries(selectedRow).map(([k, v]) => (
                  <div
                    key={k}
                    className="p-3.5 rounded-2xl bg-black/[0.025] border border-black/[0.06] flex items-center justify-between gap-4 text-xs"
                  >
                    <span className="font-bold text-muted">{COLUMN_LABELS[k] || k}</span>
                    <span className="font-medium text-right text-[#1d1d1f] select-all max-w-[65%] break-words">
                      {displayValue(k, v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-black/10">
              <div className="p-4 rounded-2xl bg-crimson/[0.04] border border-crimson/20 text-xs text-crimson mb-4">
                <strong className="font-bold block mb-0.5">🔒 Immutable Security Boundary</strong>
                Direct mutating edits across exploratory cross-student records require explicit transactional audit logging via the dedicated identity and policy management workflows.
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="secondary-btn w-full border-[#1d1d1f] bg-[#1d1d1f] text-sm font-semibold text-white hover:bg-black"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </DismissibleDialog>
      )}
    </div>
  );
}
