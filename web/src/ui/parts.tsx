// Small shared pieces: avatar, a person's name linked to LinkedIn, notices, empty and loading states.
import { AlertCircle, CheckCircle2, ExternalLink, Info, Loader2, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ApiFailure } from '../api';
import './ui.css';

export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {src && !broken ? (
        // LinkedIn photo links expire after a while: fall back to initials.
        <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        initials
      )}
    </span>
  );
}

/** A person's name: a link to their LinkedIn profile when there is one (SPEC rule 13). */
export function PersonName({
  name,
  linkedinUrl,
  photo,
  size = 32,
}: {
  name: string;
  linkedinUrl?: string | null;
  photo?: string | null;
  size?: number;
}) {
  return (
    <span className="person">
      <Avatar name={name} src={photo} size={size} />
      {linkedinUrl ? (
        <a className="person-name" href={linkedinUrl} target="_blank" rel="noopener noreferrer" title="Open LinkedIn profile">
          {name}
          <ExternalLink size={13} aria-hidden="true" />
          <span className="visually-hidden"> (LinkedIn, opens in a new tab)</span>
        </a>
      ) : (
        <span className="person-name" title="No LinkedIn link yet">
          {name}
        </span>
      )}
    </span>
  );
}

type Tone = 'info' | 'ok' | 'warn' | 'error';
const ICONS: Record<Tone, LucideIcon> = { info: Info, ok: CheckCircle2, warn: TriangleAlert, error: AlertCircle };

export function Notice({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const Icon = ICONS[tone];
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon size={28} aria-hidden="true" />
      <strong>{title}</strong>
      {children && <p className="small">{children}</p>}
    </div>
  );
}

export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 18, width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="spin" aria-hidden="true" />;
}

/** The person-facing text of a failed request: the server's own message, or a generic one. */
export function errorText(error: unknown): string {
  if (error instanceof ApiFailure) {
    if (error.status === 429) return 'Too many tries. Please wait a minute and try again.';
    if (error.detail && error.status < 500) return error.detail;
  }
  return 'Something went wrong. Please try again.';
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Notice tone="error">
      <div className="row">
        <span>{errorText(error)}</span>
        <button type="button" className="btn btn-small" onClick={onRetry}>
          Try again
        </button>
      </div>
    </Notice>
  );
}
