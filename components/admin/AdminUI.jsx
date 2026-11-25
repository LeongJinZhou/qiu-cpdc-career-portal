'use client';

import { Download, Filter, Info } from 'lucide-react';

/**
 * Shared console furniture.
 *
 * Blueprint UI rule: one chart style everywhere, filters always top-left,
 * export always top-right. Both rules are enforced by these components rather
 * than by convention, so a new analytics view cannot drift out of alignment.
 *
 * The chart language is deliberately two primitives only — a horizontal bar
 * list and a single trend line — both drawn with the same track colour, the
 * same crimson fill, the same 11px muted label and tabular figures.
 */

/** Filters slot on the left, a single export action on the right. */
export function Toolbar({ children, onExport, exportLabel = 'Export CSV', note }) {
  return (
    <div className="flex flex-col gap-3 border-b border-black/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {children ? <Filter className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> : null}
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {note ? <span className="hidden text-xs text-muted sm:inline">{note}</span> : null}
        {onExport ? (
          <button type="button" onClick={onExport} className="secondary-btn min-h-[44px] px-3.5 text-xs">
            <Download className="h-4 w-4" aria-hidden="true" /> {exportLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Consistent select used in every toolbar. */
export function ToolbarSelect({ label, value, onChange, options, disabled }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-muted">
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[44px] rounded-[14px] border border-black/10 bg-white px-3 text-sm font-medium text-[#1d1d1f] outline-none focus:border-crimson disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Headline number tile. `context` must always explain what the figure counts. */
export function Metric({ label, value, context, icon: Icon, tone = 'crimson' }) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        {Icon ? <Icon className={`h-4 w-4 shrink-0 ${tone === 'amber' ? 'text-amber-600' : 'text-crimson'}`} aria-hidden="true" /> : null}
      </div>
      <p className="mt-3 font-heading text-3xl font-bold leading-none tabular-nums text-[#1d1d1f]">{value}</p>
      {context ? <p className="mt-2 text-xs text-muted">{context}</p> : null}
    </div>
  );
}

export function PanelHeading({ title, description, children }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-heading text-lg font-bold text-[#1d1d1f]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Where a figure comes from. Used wherever a percentage is shown. */
export function DerivationNote({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-[14px] border border-black/10 bg-black/[0.02] p-3 text-xs leading-relaxed text-muted">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/**
 * The console's only bar chart.
 *
 * `unit` is 'percent' or 'count'; counts are scaled against the largest bar so
 * a cohort of 14 does not render as four invisible slivers.
 */
export function BarList({ title, caption, data, unit = 'percent', emptyLabel = 'No data in this scope.' }) {
  const max = unit === 'percent' ? 100 : Math.max(1, ...data.map((item) => item.value ?? item.count ?? 0));

  return (
    <div className="surface space-y-4 p-5">
      <div>
        <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#1d1d1f]">{title}</h3>
        {caption ? <p className="mt-1 text-xs text-muted">{caption}</p> : null}
      </div>
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {data.map((item) => {
            const value = item.value ?? item.count ?? 0;
            const width = Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100));
            return (
              <li key={item.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-[#1d1d1f]" title={item.fullLabel ?? item.label}>
                    {item.label}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-[#1d1d1f]">
                    {unit === 'percent' ? `${value}%` : value}
                    {item.count !== undefined && unit === 'percent' ? (
                      <span className="ml-1.5 text-xs font-normal text-muted">({item.count})</span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-black/[0.06]">
                  <div className="h-full rounded-full bg-crimson transition-[width] duration-500" style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The console's only trend chart: attendance per published event, in date
 * order. Hand-rolled SVG (there is no chart library and none may be added).
 * The same values are repeated as a screen-reader list so the chart is not the
 * only way to read them.
 */
export function TrendChart({ title, caption, points, emptyLabel = 'No events published in this scope yet.' }) {
  const width = 320;
  const height = 120;
  const padding = { top: 12, right: 8, bottom: 24, left: 8 };
  const max = Math.max(1, ...points.map((point) => point.count));

  const coords = points.map((point, index) => {
    const span = points.length > 1 ? points.length - 1 : 1;
    const x = padding.left + (index / span) * (width - padding.left - padding.right);
    const y = padding.top + (1 - point.count / max) * (height - padding.top - padding.bottom);
    return { ...point, x, y };
  });

  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = coords.length
    ? `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padding.bottom} L ${coords[0].x.toFixed(1)} ${height - padding.bottom} Z`
    : '';

  return (
    <div className="surface space-y-4 p-5">
      <div>
        <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#1d1d1f]">{title}</h3>
        {caption ? <p className="mt-1 text-xs text-muted">{caption}</p> : null}
      </div>

      {points.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-32 w-full"
            role="img"
            aria-label={`${title}. ${points.map((point) => `${point.label}: ${point.count}`).join('. ')}`}
          >
            {[0, 0.5, 1].map((ratio) => {
              const y = padding.top + ratio * (height - padding.top - padding.bottom);
              return <line key={ratio} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(0,0,0,0.08)" strokeWidth="1" />;
            })}
            {area ? <path d={area} fill="rgba(229,9,20,0.08)" /> : null}
            <path d={line} fill="none" stroke="#e50914" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {coords.map((point) => (
              <g key={point.id}>
                <circle cx={point.x} cy={point.y} r="3.5" fill="#fff" stroke="#e50914" strokeWidth="2" />
                <text x={point.x} y={height - 8} textAnchor="middle" fontSize="9" fill="#6e6e73">{point.shortLabel ?? point.label}</text>
              </g>
            ))}
          </svg>
          <ul className="space-y-1.5 border-t border-black/10 pt-3">
            {points.map((point) => (
              <li key={point.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-muted" title={point.label}>{point.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-[#1d1d1f]">{point.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Trigger a client-side CSV download without adding a dependency. */
export function downloadCsv(filename, contents) {
  try {
    const blob = new Blob([contents], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Released a moment later: revoking at once can cancel the download in
    // some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // Download blocked (sandboxed iframe) — nothing else in the view depends
    // on this succeeding, so fail quietly rather than throwing in a handler.
  }
}
