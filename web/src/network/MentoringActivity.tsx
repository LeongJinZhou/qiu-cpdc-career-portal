// CPDC's view of mentoring: how many mentors, requests by status, and recent matches. Messages stay private.
import { HandHelping } from 'lucide-react';
import { apiGet, useLoad } from '../api';
import { dateLabel } from '../profile/types';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, PersonName, SkeletonLines } from '../ui/parts';
import './network.css';

interface Activity {
  mentors: number;
  requests: Record<'waiting' | 'accepted' | 'declined' | 'withdrawn', number>;
  this_month: Record<'waiting' | 'accepted' | 'declined' | 'withdrawn', number>;
  matches: {
    id: number;
    decided_at: string;
    student: { display_name: string; linkedin_url: string | null; faculty: string | null };
    mentor: { display_name: string; linkedin_url: string | null };
  }[];
}

export function MentoringActivity() {
  const load = useLoad('mentoring-activity', () => apiGet<Activity>('/api/network/activity'));
  const a = load.data;
  const tiles: [string, number, number | null][] = a
    ? [
        ['Mentors offering', a.mentors, null],
        ['Matches', a.requests.accepted, a.this_month.accepted],
        ['Waiting for a mentor', a.requests.waiting, null],
        ['Declined', a.requests.declined, a.this_month.declined],
      ]
    : [];

  return (
    <>
      <PageHead title="Mentoring activity">
        Alumni mentoring at a glance. Students' messages stay between them and their mentor. Each view is in the audit log.
      </PageHead>
      {load.error && <LoadError error={load.error} onRetry={load.reload} />}
      {!a && !load.error && <SkeletonLines lines={4} />}
      {a && (
        <>
          <dl className="net-stats">
            {tiles.map(([label, total, month]) => (
              <div key={label} className="panel net-stat">
                <dt>{label}</dt>
                <dd className="num">{total}</dd>
                {month !== null && <dd className="small muted num">{month} this month</dd>}
              </div>
            ))}
          </dl>
          <section className="panel panel-pad" aria-labelledby="matches-h">
            <h2 id="matches-h" style={{ marginBottom: 12 }}>Recent matches</h2>
            {a.matches.length === 0 ? (
              <Empty icon={HandHelping} title="No matches yet">When a mentor accepts a student, the match shows here.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Mentor</th>
                      <th>Matched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.matches.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <PersonName name={m.student.display_name} linkedinUrl={m.student.linkedin_url} size={28} />
                          {m.student.faculty && <div className="small muted">{m.student.faculty}</div>}
                        </td>
                        <td><PersonName name={m.mentor.display_name} linkedinUrl={m.mentor.linkedin_url} size={28} /></td>
                        <td className="small muted num">{dateLabel(m.decided_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
