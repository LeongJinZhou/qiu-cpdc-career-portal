'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, LoaderCircle, RefreshCcw, Search, ShieldAlert } from 'lucide-react';

function summarizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return '—';
  }

  const entries = Object.entries(snapshot).filter(([, value]) => value != null).slice(0, 3);
  if (!entries.length) {
    return '—';
  }

  return entries.map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ');
}

function Notice({ title, body, warning = false }) {
  return (
    <div className={`rounded-[20px] border p-4 ${warning ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-black/10 bg-black/[0.03] text-[#1d1d1f]'}`}>
      <div className="flex items-start gap-3">
        {warning ? <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-crimson" />}
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted">{body}</p>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogPanel({ currentRole }) {
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    actor: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
  });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const pageSize = 10;

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError('');
    setAuthNotice('');

    try {
      const params = new URLSearchParams();
      params.set('page', String(filters.page));
      params.set('pageSize', String(pageSize));
      if (filters.action) params.set('action', filters.action);
      if (filters.resource) params.set('resource', filters.resource);
      if (filters.actor) params.set('actor', filters.actor);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);

      const response = await fetch(`/api/admin/audit?${params.toString()}`, {
        credentials: 'include',
        headers: currentRole ? { 'x-demo-role': currentRole } : {},
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        setItems([]);
        setTotal(0);
        setAuthNotice(payload.error ?? 'A real authenticated CPDC or Super Admin session is required for audit visibility.');
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load audit records.');
      }

      setItems(payload.items ?? []);
      setTotal(payload.total ?? 0);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, [filters, currentRole]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  return (
    <section className="space-y-5">
      <div className="surface space-y-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">Audit</p>
            <h2 className="mt-1 font-heading text-2xl font-semibold">Immutable admin activity feed</h2>
            <p className="mt-1 text-sm text-muted">This panel reads the real audit API and shows only sanitized before/after data.</p>
          </div>
          <button type="button" onClick={fetchAudit} className="secondary-btn px-3 py-2 text-xs">
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {authNotice ? <Notice warning title="Admin audit access is unavailable" body={authNotice} /> : null}
        {error ? <Notice title="Could not load audit records" body={error} /> : null}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
          <label className="relative block">
            <span className="sr-only">Filter by action</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={filters.action} onChange={(event) => setFilters((previous) => ({ ...previous, page: 1, action: event.target.value }))} placeholder="Action" className="h-11 w-full rounded-[16px] border border-black/10 bg-black/[0.03] pl-10 pr-4 text-sm outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/20" />
          </label>
          <input value={filters.resource} onChange={(event) => setFilters((previous) => ({ ...previous, page: 1, resource: event.target.value }))} placeholder="Resource type" aria-label="Filter by resource type" className="h-11 rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson" />
          <input value={filters.actor} onChange={(event) => setFilters((previous) => ({ ...previous, page: 1, actor: event.target.value }))} placeholder="Actor user ID" aria-label="Filter by actor user ID" className="h-11 rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson" />
          <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((previous) => ({ ...previous, page: 1, dateFrom: event.target.value }))} aria-label="Filter from date" className="h-11 rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson" />
          <input type="date" value={filters.dateTo} onChange={(event) => setFilters((previous) => ({ ...previous, page: 1, dateTo: event.target.value }))} aria-label="Filter to date" className="h-11 rounded-[16px] border border-black/10 bg-white px-3 text-sm outline-none focus:border-crimson" />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="surface px-4 py-14 text-center text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading immutable audit entries…
            </span>
          </div>
        ) : items.length === 0 ? (
          <div className="surface px-4 py-14 text-center text-sm text-muted">
            {authNotice ? 'The audit service could not verify this admin view.' : 'No audit entries match the current filters.'}
          </div>
        ) : items.map((item) => (
          <article key={item.id} className="surface space-y-3 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge-pill border border-black/10 bg-black/[0.03] text-[#1d1d1f]">{item.action}</span>
                  <span className="badge-pill border border-black/10 bg-white text-muted">{item.resourceType}</span>
                </div>
                <h3 className="mt-2 font-heading text-lg font-semibold">{item.actor?.name ?? 'System'} → {item.resourceId}</h3>
                <p className="mt-1 text-sm text-muted">
                  {item.actor?.email ?? 'No actor email'} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown time'}
                </p>
              </div>
              <div className="text-xs text-muted">
                {item.requestId ? <p>Request ID: {item.requestId}</p> : null}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <SummaryCard label="Before" value={summarizeSnapshot(item.before)} />
              <SummaryCard label="After" value={summarizeSnapshot(item.after)} />
              <SummaryCard label="Metadata" value={summarizeSnapshot(item.metadata)} />
            </div>
          </article>
        ))}
      </div>

      <div className="surface flex items-center justify-between px-4 py-3 text-sm text-muted">
        <span>Page {filters.page} of {totalPages}</span>
        <div className="flex gap-2">
          <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((previous) => ({ ...previous, page: previous.page - 1 }))} className="secondary-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50">
            Previous
          </button>
          <button type="button" disabled={filters.page >= totalPages} onClick={() => setFilters((previous) => ({ ...previous, page: previous.page + 1 }))} className="secondary-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-[18px] border border-black/10 bg-black/[0.02] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#1d1d1f]">{value}</p>
    </div>
  );
}
