// The audit log: who did what, when (newest first).
import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { apiGet, useLoad, type Paged } from '../api';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, SkeletonLines } from '../ui/parts';
import { Pager } from './Pager';

interface Entry {
  id: number;
  action: string;
  target: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  actor: string | null;
}

const ACTIONS: Record<string, string> = {
  'onboarding.complete': 'finished onboarding',
  'linkedin.link': 'linked LinkedIn',
  'linkedin.relink': 'switched LinkedIn account',
  'linkedin.url_change': 'changed LinkedIn link',
  'github.link': 'linked GitHub',
  'profile.pdf_import': 'imported a LinkedIn PDF',
  'profile.view': 'viewed a profile',
  'alumni.view': 'viewed the alumni tracker',
  'alumni.export': 'downloaded the alumni CSV',
  'alumni.convert': 'made a student alumni',
  'registration.approve': 'approved a graduate sign-up',
  'registration.refuse': 'refused a graduate sign-up',
  'user.role': 'changed a role',
  'superadmin.transfer': 'took over as super admin',
  'superadmin.demote': 'stopped being super admin',
};

function when(value: string): string {
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return date.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' });
}

export function AuditLog() {
  const [page, setPage] = useState(1);
  const list = useLoad(`audit:${page}`, () => apiGet<Paged<Entry>>('/api/audit', { page, per_page: 50 }), 'audit');
  return (
    <>
      <PageHead title="Audit log">Role changes, LinkedIn changes, and every view or download of personal data.</PageHead>
      <section className="panel panel-pad">
        {list.error && <LoadError error={list.error} onRetry={list.reload} />}
        {list.loading && !list.data && <SkeletonLines lines={6} />}
        {list.data && list.data.items.length === 0 && <Empty icon={ScrollText} title="Nothing recorded yet" />}
        {list.data && list.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>When</th><th>Who</th><th>What</th><th>On</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {list.data.items.map((e) => (
                  <tr key={e.id}>
                    <td className="small num" style={{ whiteSpace: 'nowrap' }}>{when(e.created_at)}</td>
                    <td className="small">{e.actor ?? 'Removed user'}</td>
                    <td className="small">{ACTIONS[e.action] ?? e.action}</td>
                    <td className="small muted num">{e.target}</td>
                    <td className="small muted" style={{ overflowWrap: 'anywhere' }}>
                      {e.meta ? Object.entries(e.meta).map(([k, v]) => `${k}: ${String(v)}`).join(', ') : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pager page={page} perPage={list.data.per_page} total={list.data.total} onPage={setPage} />}
      </section>
    </>
  );
}
