'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Linkedin, LoaderCircle, RefreshCcw, Search } from 'lucide-react';

import { alumniCsv } from '@/lib/admin/alumni';

// Alumni tracking for CPDC: graduates keep their LinkedIn after the QIU email
// closes, so a linked LinkedIn (by sign-in) is what keeps them reachable.

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-[18px] border border-black/10 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold text-[#1d1d1f]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function LinkedInStatus({ row }) {
  if (row.linkedinLinked) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Linked
      </span>
    );
  }
  return <span className="text-xs font-semibold text-amber-800">Not linked</span>;
}

function ProfileLink({ url }) {
  if (!url) return <span className="text-xs text-muted">—</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-crimson underline">
      Profile <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

export default function AlumniTracker({ currentRole }) {
  const [state, setState] = useState({ status: 'loading', rows: [], summary: null, error: '' });
  const [query, setQuery] = useState('');
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, status: 'loading', error: '' }));
    try {
      // The demo-role header only matters in local demo mode; a hosted site
      // ignores it and uses the signed-in session (see lib/admin/route-auth.js).
      const response = await fetch('/api/admin/alumni', {
        cache: 'no-store',
        credentials: 'include',
        headers: currentRole ? { 'x-demo-role': currentRole } : {},
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load alumni.');
      setState({ status: 'ready', rows: payload.rows ?? [], summary: payload.summary ?? null, error: '' });
    } catch (error) {
      setState({ status: 'error', rows: [], summary: null, error: error.message });
    }
  }, [currentRole]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.rows.filter((row) => (
      (!onlyUnlinked || !row.linkedinLinked)
      && (!needle || [row.name, row.matricNo, row.programme, row.personalEmail, row.qiuEmail]
        .some((value) => String(value ?? '').toLowerCase().includes(needle)))
    ));
  }, [state.rows, query, onlyUnlinked]);

  const downloadCsv = () => {
    const blob = new Blob([alumniCsv(visible)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qiu-alumni-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (state.status === 'loading') {
    return (
      <p className="surface flex items-center gap-2 p-6 text-sm text-muted" role="status">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading alumni…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="surface space-y-3 p-6" role="alert">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#1d1d1f]">
          <AlertTriangle className="h-4 w-4 text-crimson" aria-hidden="true" /> {state.error}
        </p>
        <button type="button" onClick={load} className="secondary-btn inline-flex min-h-[44px] items-center gap-2">
          <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  const { summary } = state;

  return (
    <section className="space-y-5" aria-labelledby="alumni-title">
      <div>
        <h2 id="alumni-title" className="font-heading text-lg font-semibold text-[#1d1d1f]">Alumni</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Graduates and students ready to graduate. A linked LinkedIn lets them sign in after their QIU email closes,
          and keeps their personal email up to date each time they do.
        </p>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="In this list" value={summary.total} />
          <Stat label="Alumni" value={summary.alumni} hint="Others are ready to graduate" />
          <Stat label="LinkedIn linked" value={summary.linkedinLinked} hint={`${summary.total - summary.linkedinLinked} not linked`} />
          <Stat label="Seen in 12 months" value={summary.seenLast12Months} hint="Signed in to LinkedIn here" />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block flex-1 sm:max-w-sm">
            <span className="sr-only">Search alumni</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, matric no, programme or email"
              className="h-11 w-full rounded-[14px] border border-black/10 bg-white pl-9 pr-3 text-sm focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
            />
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-[#1d1d1f]">
            <input type="checkbox" checked={onlyUnlinked} onChange={(event) => setOnlyUnlinked(event.target.checked)} className="h-4 w-4 accent-[#e50914]" />
            Only LinkedIn not linked
          </label>
        </div>
        <button type="button" onClick={downloadCsv} disabled={!visible.length} className="secondary-btn inline-flex min-h-[44px] items-center gap-2 disabled:opacity-60">
          <Download className="h-4 w-4" aria-hidden="true" /> Export CSV ({visible.length})
        </button>
      </div>

      {!state.rows.length ? (
        <div className="surface flex items-start gap-3 p-6 text-sm text-muted">
          <Linkedin className="mt-0.5 h-5 w-5 text-[#0a66c2]" aria-hidden="true" />
          <p>No alumni yet. Students appear here when they finish their internship or when CPDC gives them the Alumni role in People &amp; access.</p>
        </div>
      ) : !visible.length ? (
        <p className="surface p-6 text-sm text-muted">Nobody matches this search.</p>
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((row) => (
              <li key={row.matricNo} className="surface space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1d1d1f]">{row.name}</p>
                    <p className="text-xs text-muted">{row.matricNo} · {row.programme}</p>
                  </div>
                  <LinkedInStatus row={row} />
                </div>
                <p className="break-all text-xs text-[#1d1d1f]">{row.personalEmail ?? 'No personal email yet'}</p>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{row.status} · seen {formatDate(row.linkedinLastSeenAt)}</span>
                  <ProfileLink url={row.linkedinUrl} />
                </div>
              </li>
            ))}
          </ul>

          {/* Wide screens: table */}
          <div className="surface hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Alumni and students ready to graduate</caption>
              <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Programme</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">LinkedIn</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Personal email</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.matricNo} className="border-b border-black/[0.06] last:border-0 hover:bg-black/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1d1d1f]">{row.name}</p>
                      <p className="text-xs text-muted">{row.matricNo}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#1d1d1f]">{row.programme}<span className="block text-muted">{row.faculty}</span></td>
                    <td className="px-4 py-3 text-xs">{row.status}</td>
                    <td className="px-4 py-3"><LinkedInStatus row={row} /><div><ProfileLink url={row.linkedinUrl} /></div></td>
                    <td className="break-all px-4 py-3 text-xs">{row.personalEmail ?? <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(row.linkedinLastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
