import { Lock } from 'lucide-react';

/**
 * Read-only display field for values auto-detected from QIU records.
 */
export default function AutoDetectedField({ label, value }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold text-muted">{label}</span>
      <div className="flex min-h-[48px] items-center justify-between gap-3 rounded-[18px] border border-black/10 bg-black/[0.03] px-4 py-3">
        <span className="text-sm font-medium text-[#1d1d1f]">{value}</span>
        <span className="flex flex-shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Auto-detected
        </span>
      </div>
    </div>
  );
}
