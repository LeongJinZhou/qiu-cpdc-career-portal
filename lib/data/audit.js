'use client';

// Module 13 — administrative audit log.
//
// Every privileged action in the console (identity override, approval
// decision, settings change, magic-link revocation) is appended here so the
// change is attributable and reviewable. Like lib/settings.js this is
// localStorage-backed because the prototype has no session server yet; it is
// deliberately the single seam that swaps to an API later.
//
// SECURITY NOTE: a client-held log is evidence for the operator, not a tamper
// -proof record. Once real SSO lands the server must write the authoritative
// entry (actor id, IP, timestamp) at the same moment it authorises the action,
// and this module becomes a read-through cache of that server log.

import { useCallback, useEffect, useState } from 'react';

export const AUDIT_STORAGE_KEY = 'qiu.audit';

/** Cap the client-side log so localStorage never grows without bound. */
const MAX_ENTRIES = 250;

export const AUDIT_CATEGORIES = [
  { id: 'identity', label: 'Identity override' },
  { id: 'approval', label: 'Approval decision' },
  { id: 'settings', label: 'Platform setting' },
  { id: 'content', label: 'Content & curation' },
  { id: 'access', label: 'Access & accounts' },
];

// Module-level cache + subscriber set. Two panels can be mounted at once (the
// settings engine writing, the audit table reading); without this they would
// each hold a private copy and the table would not update until remount.
let cache = null;
const listeners = new Set();

function readStored() {
  if (cache) return cache;
  try {
    const raw = window.localStorage?.getItem(AUDIT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist(entries) {
  cache = entries;
  try {
    window.localStorage?.setItem(AUDIT_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable (private mode) — the log still works for this session.
  }
  listeners.forEach((listener) => listener(entries));
}

/**
 * Append an entry. Safe to call from an event handler in any component.
 *
 * @param {object} entry
 * @param {string} entry.category  one of AUDIT_CATEGORIES ids
 * @param {string} entry.action    what happened, in plain language
 * @param {string} [entry.target]  who or what it happened to
 * @param {string} [entry.detail]  before -> after, or a short justification
 * @param {string} [entry.actor]   acting role (defaults to 'SUPER_ADMIN')
 * @param {string} [entry.scope]   faculty code the action applied to
 */
export function recordAudit(entry) {
  if (typeof window === 'undefined') return null;
  const row = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    actor: entry.actor ?? 'SUPER_ADMIN',
    category: entry.category ?? 'settings',
    action: entry.action ?? 'Unspecified change',
    target: entry.target ?? '',
    detail: entry.detail ?? '',
    scope: entry.scope ?? 'University-wide',
  };
  persist([row, ...readStored()].slice(0, MAX_ENTRIES));
  return row;
}

/**
 * Subscribe to the log.
 *
 * SSR guard: the first render returns an empty list so server and client markup
 * agree; the stored entries arrive in an effect after mount.
 */
export function useAuditLog() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    setEntries(readStored());
    const listener = (next) => setEntries(next);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  const record = useCallback((entry) => recordAudit(entry), []);

  const clear = useCallback(() => persist([]), []);

  return { entries, record, clear };
}

/** Human-readable timestamp for the table. Locale-stable to avoid SSR drift. */
export function formatAuditTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Serialise the log for the export button. */
export function auditToCsv(entries) {
  const header = ['timestamp', 'actor', 'category', 'action', 'target', 'detail', 'scope'];
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = entries.map((entry) => [
    entry.at,
    entry.actor,
    entry.category,
    entry.action,
    entry.target,
    entry.detail,
    entry.scope,
  ].map(escape).join(','));
  return [header.join(','), ...rows].join('\n');
}
