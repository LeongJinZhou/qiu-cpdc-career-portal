// The count under a list, with previous / next once it has more than one page.
import { Pager } from '../admin/Pager';

export function ListFooter({
  page,
  perPage,
  total,
  noun,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  noun: string;
  onPage: (page: number) => void;
}) {
  if (total > perPage) return <Pager page={page} perPage={perPage} total={total} onPage={onPage} />;
  return <div className="pager num">{total} {total === 1 ? noun : `${noun}s`}</div>;
}
