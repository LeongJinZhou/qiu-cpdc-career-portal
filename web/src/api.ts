// The one API client (docs/API.md): JSON in and out, CSRF token on changes, errors as ApiFailure.
import { useCallback, useEffect, useRef, useState } from 'react';

export class ApiFailure extends Error {
  readonly status: number;
  readonly code: string;
  /** The server's generic message; for a 400 it names the field ("Invalid or unknown field: body"). */
  readonly detail: string;
  /** For a 400 on a form: the request field the server rejected, and for a bulk request the row (`index`). */
  readonly field: string | null;
  readonly index: number | null;
  /** The other keys of the error object (a 409 CONFLICT adds saved_by, saved_at and rev). */
  readonly extra: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    detail = '',
    field: string | null = null,
    index: number | null = null,
    extra: Record<string, unknown> = {},
  ) {
    super(`${status} ${code}`);
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.field = field;
    this.index = index;
    this.extra = extra;
  }
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown; field?: unknown; index?: unknown; [key: string]: unknown };
  field?: unknown;
  index?: unknown;
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorBody | null;
    // The field and row may sit inside "error" or beside it.
    const field = body?.error?.field ?? body?.field;
    const index = body?.error?.index ?? body?.index;
    throw new ApiFailure(
      res.status,
      typeof body?.error?.code === 'string' ? body.error.code : 'UNKNOWN',
      typeof body?.error?.message === 'string' ? body.error.message : '',
      typeof field === 'string' ? field : null,
      typeof index === 'number' ? index : null,
      body?.error ?? {},
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type Query = Record<string, string | number | undefined>;

export function apiGet<T>(path: string, query: Query = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(name, String(value));
  }
  const qs = params.toString();
  return send<T>(qs ? `${path}?${qs}` : path, { headers: { Accept: 'application/json' } });
}

/** POST, PUT, PATCH or DELETE with the CSRF token. A 204 resolves to undefined. */
export function apiWrite<T = void>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  csrfToken: string,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-CSRF-Token': csrfToken };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return send<T>(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown, csrfToken: string): Promise<T> {
  return apiWrite<T>('PATCH', path, body, csrfToken);
}

/** One file as multipart/form-data with the CSRF token (the browser sets the boundary). */
export function apiUpload<T>(path: string, field: string, file: File, csrfToken: string): Promise<T> {
  const form = new FormData();
  form.append(field, file);
  return send<T>(path, { method: 'POST', headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken }, body: form });
}

interface Loaded<T> {
  id: string;
  group: string;
  data?: T;
  error?: unknown;
}

/**
 * Loads on mount and whenever `key` changes; reload() loads again. Answers for an older key are ignored.
 * `loading` is true during any load. `data` is kept while reloading and while `key` changes inside the same `group`
 * (default: the key itself), and cleared when the group changes.
 */
export function useLoad<T>(key: string, load: () => Promise<T>, group = key) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Loaded<T> | null>(null);
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });
  const id = `${key}#${attempt}`;

  useEffect(() => {
    let live = true;
    latest.current().then(
      (data) => live && setResult({ id, group, data }),
      (error: unknown) => live && setResult({ id, group, error }),
    );
    return () => {
      live = false;
    };
  }, [id, group]);

  const sameKey = result?.group === group ? result : null;
  const current = result?.id === id ? result : null;
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { loading: current === null, data: sameKey?.data, error: current?.error ?? null, reload };
}

/** The paged list envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}
