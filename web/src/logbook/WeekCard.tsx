// One logged week: what was done, its status and the supervisor's comment. Actions only for the student.
import { MessageSquareText } from 'lucide-react';
import type { ReactNode } from 'react';
import { dateLabel } from '../profile/types';
import { STATUS_BADGE, STATUS_LABEL, weekLabel, type Entry } from './types';

export function WeekCard({ entry, actions, highlight = false }: { entry: Entry; actions?: ReactNode; highlight?: boolean }) {
  return (
    <article className={`lb-week${highlight ? ' lb-week-fresh' : ''}`} aria-label={weekLabel(entry.week_start)}>
      <header className="lb-week-head">
        <div>
          <h3>{weekLabel(entry.week_start)}</h3>
          <span className="small muted num">{entry.hours} h</span>
        </div>
        <span className={STATUS_BADGE[entry.status]}>{STATUS_LABEL[entry.status]}</span>
      </header>
      <p className="lb-text">{entry.activities}</p>
      {entry.learnings && (
        <p className="lb-text small">
          <strong>Learned: </strong>
          {entry.learnings}
        </p>
      )}
      {entry.supervisor_comment && (
        <div className={`lb-comment${entry.status === 'returned' ? ' lb-comment-returned' : ''}`}>
          <MessageSquareText size={16} aria-hidden="true" />
          <div>
            <span className="small muted">Supervisor{entry.decided_at ? `, ${dateLabel(entry.decided_at)}` : ''}</span>
            <p>{entry.supervisor_comment}</p>
          </div>
        </div>
      )}
      {actions && <footer className="row">{actions}</footer>}
    </article>
  );
}

/** Approved weeks over started weeks, with hours. */
export function WeekProgress({ entries, expected }: { entries: Entry[]; expected: number }) {
  const count = (s: Entry['status']) => entries.filter((e) => e.status === s).length;
  const approved = count('approved');
  const hours = entries.filter((e) => e.status === 'approved').reduce((sum, e) => sum + e.hours, 0);
  const share = expected === 0 ? 0 : Math.min(100, Math.round((approved / expected) * 100));
  return (
    <div className="lb-progress">
      <div className="lb-progress-numbers">
        <strong className="num">
          {approved} of {expected}
        </strong>
        <span className="muted">weeks approved · {hours} h</span>
      </div>
      <div className="lb-bar" role="img" aria-label={`${approved} of ${expected} weeks approved`}>
        <span style={{ width: `${share}%` }} />
      </div>
      <div className="row small muted">
        <span>{count('submitted')} with supervisor</span>
        <span>{count('returned')} returned</span>
        <span>{count('draft')} drafts</span>
      </div>
    </div>
  );
}
