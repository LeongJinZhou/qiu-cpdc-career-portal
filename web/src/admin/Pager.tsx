// Previous / next for a paged list.
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pager({ page, perPage, total, onPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void }) {
  const last = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return <div className="pager num">{total} {total === 1 ? 'person' : 'people'}</div>;
  return (
    <div className="pager">
      <span className="num">
        {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total}
      </span>
      <div className="row">
        <button type="button" className="btn btn-small" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-small" onClick={() => onPage(page + 1)} disabled={page >= last} aria-label="Next page">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
