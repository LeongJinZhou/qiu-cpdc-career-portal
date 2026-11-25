// "Closes 31 Dec 2026", or "3 days left" in the last week.
import { CalendarClock } from 'lucide-react';
import { daysLeft, dayLabel } from './types';

export function Closing({ date }: { date: string }) {
  const left = daysLeft(date);
  const soon = left >= 0 && left <= 7;
  let text = `Closes ${dayLabel(date)}`;
  if (left < 0) text = 'Closed';
  else if (left === 0) text = 'Closes today';
  else if (soon) text = `${left} day${left === 1 ? '' : 's'} left`;
  return (
    <span className={soon ? 'closing closing-soon' : 'closing'} title={`Closes ${dayLabel(date)}`}>
      <CalendarClock size={13} aria-hidden="true" />
      {text}
    </span>
  );
}
