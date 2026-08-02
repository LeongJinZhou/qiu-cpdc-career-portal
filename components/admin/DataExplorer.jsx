'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Database,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Table,
  X,
} from 'lucide-react';

const ENTITIES = [
  { id: 'assessmentAttempt', label: 'Assessment Attempts', desc: 'Raw diagnostic attempts, readiness scores, and completion metrics across faculties.' },
  { id: 'application', label: 'Job Applications', desc: 'Active student talent recruitment submissions, interview progression, and hiring stages.' },
  { id: 'workshop', label: 'Workshop Catalogue', desc: 'Global events schedule, speaker assignments, time-gated QR check-ins, and RSVP ledgers.' },
  { id: 'courseEnrolment', label: 'Course Enrolments', desc: 'Coursera and internal AI learning track progression, certificate verifications, and XP rewards.' },
  { id: 'auditLog', label: 'Security Audit Log', desc: 'Immutable security tracking ledger recording every protected administrative database read/write.' },
];

const COLUMN_LABELS = {
  id: 'Record ID',
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

const DATE_COLUMNS = new Set(['submittedAt', 'appliedAt', 'startsAt', 'enrolledAt', 'at']);

function displayValue(column, value) {
  if (value == null || value === '') return '—';
  if (DATE_COLUMNS.has(column)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return String(value);
}

export default function DataExplorer({ currentRole }) {
  const [activeEntity, setActiveEntity] = useState('assessmentAttempt');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

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
              onClick={loadRecords}
              disabled={loading}
              className="secondary-btn px-3.5 py-2 text-xs flex items-center gap-2 bg-white"
              title="Refresh database view"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-crimson' : 'text-muted'}`} />
              <span>Refresh Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Entity Selector Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-black/10">
        {ENTITIES.map((ent) => {
          const isSelected = activeEntity === ent.id;
          return (
            <button
              key={ent.id}
              type="button"
              onClick={() => {
                setActiveEntity(ent.id);
                setPage(1);
                setQuery('');
                setSelectedRow(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition shrink-0 ${
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
          <input
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
                className="p-1.5 rounded-lg border border-black/10 hover:bg-black/[0.04] disabled:opacity-40 disabled:pointer-events-none transition"
                title="Previous Page"
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
                className="p-1.5 rounded-lg border border-black/10 hover:bg-black/[0.04] disabled:opacity-40 disabled:pointer-events-none transition"
                title="Next Page"
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
      <div className="surface overflow-hidden border border-black/10">
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
                  className="hover:bg-crimson/[0.02] transition cursor-pointer"
                  onClick={() => setSelectedRow(row)}
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
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-[2px] animate-fadeIn"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="w-full max-w-lg bg-white h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between border-b border-black/10 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-crimson">
                    {activeMeta.label} · Record Inspection
                  </span>
                  <h3 className="font-heading font-bold text-lg text-[#1d1d1f] mt-0.5">
                    Record ID: {selectedRow.id || 'N/A'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  className="p-2 rounded-xl text-muted hover:bg-black/[0.05] transition"
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
                    <span className="font-bold uppercase tracking-wider text-muted font-mono">{k}</span>
                    <span className="font-medium text-right text-[#1d1d1f] select-all max-w-[65%] break-words">
                      {String(v ?? '—')}
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
                className="w-full py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black transition shadow-sm"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
