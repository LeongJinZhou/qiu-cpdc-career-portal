// Graduate sign-ups waiting for CPDC (docs/SPEC.md rule 9): approve (merging into a known student) or refuse.
import { ClipboardList, Link2 } from 'lucide-react';
import { useState } from 'react';
import { apiGet, apiWrite, useLoad } from '../api';
import type { Me } from '../auth';
import { dateLabel } from '../profile/types';
import { PageHead } from '../shell/Shell';
import { Empty, LoadError, Notice, PersonName, SkeletonLines, Spinner, errorText } from '../ui/parts';
import './admin.css';

interface Registration {
  id: number;
  matric_no: string;
  name: string;
  programme: string;
  faculty: string | null;
  graduation_year: number;
  created_at: string;
  matched_user_id: number | null;
  matched_name: string | null;
  linkedin_url: string | null;
}

export function Registrations({ me }: { me: Me }) {
  const list = useLoad('registrations', () => apiGet<{ items: Registration[] }>('/api/registrations'));
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function decide(reg: Registration, action: 'approve' | 'refuse') {
    setBusy(reg.id);
    setMessage(null);
    try {
      await apiWrite('POST', `/api/registrations/${reg.id}/${action}`, action === 'approve' ? {} : undefined, me.csrf_token);
      setMessage({ tone: 'ok', text: action === 'approve' ? `${reg.name} is now an alumnus and can sign in with LinkedIn.` : `${reg.name}'s registration was refused.` });
      list.reload();
    } catch (error) {
      setMessage({ tone: 'error', text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHead title="Graduate sign-ups">
        Graduates who signed in with LinkedIn but had no QIU account linked. Check them against QIU's records.
      </PageHead>
      {message && <div style={{ marginBottom: 16 }}><Notice tone={message.tone}>{message.text}</Notice></div>}
      <section className="panel panel-pad">
        {list.error && <LoadError error={list.error} onRetry={list.reload} />}
        {list.loading && !list.data && <SkeletonLines lines={4} />}
        {list.data && list.data.items.length === 0 && <Empty icon={ClipboardList} title="Nothing waiting">New graduate sign-ups appear here.</Empty>}
        {list.data?.items.map((reg) => (
          <div key={reg.id} className="decide">
            <div className="stack" style={{ gap: 6 }}>
              <PersonName name={reg.name} linkedinUrl={reg.linkedin_url} />
              <div className="small">
                <span className="num">{reg.matric_no}</span> · {reg.programme}{reg.faculty ? ` · ${reg.faculty}` : ''} · graduated <span className="num">{reg.graduation_year}</span>
              </div>
              <div className="small muted">Sent {dateLabel(reg.created_at)}</div>
              {reg.matched_user_id ? (
                <span className="badge badge-ok" style={{ justifySelf: 'start' }}>
                  <Link2 size={12} aria-hidden="true" /> Matches {reg.matched_name}: approving joins the two
                </span>
              ) : (
                <span className="badge" style={{ justifySelf: 'start' }}>No QIU account with this matric number</span>
              )}
            </div>
            <div className="row">
              <button type="button" className="btn btn-primary btn-small" disabled={busy !== null} onClick={() => decide(reg, 'approve')}>
                {busy === reg.id && <Spinner size={14} />}Approve
              </button>
              <button type="button" className="btn btn-small" disabled={busy !== null} onClick={() => decide(reg, 'refuse')}>Refuse</button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
