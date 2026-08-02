'use client';

import { useEffect, useRef, useState } from 'react';
import { Coffee, Mail, Send, ShieldCheck, X } from 'lucide-react';

/**
 * The structured invite is the ONLY way an employer can contact a student.
 * There is no open messaging channel, and the employer never sees the student's
 * email or phone — the invitation is delivered to the student's QIU CPDC inbox,
 * and the student decides whether to reply.
 */
export default function InviteDialog({ candidate, kind, employerName, onClose, onSend }) {
  const [role, setRole] = useState('');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!candidate) return null;

  const isInterview = kind === 'interview';

  const submit = (event) => {
    event.preventDefault();
    if (!role.trim() || !when.trim()) return;
    onSend({ candidate, kind, role: role.trim(), when: when.trim(), note: note.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-sm animate-fadeIn sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-dialog-title"
      onClick={onClose}
    >
      <div
        className="glass-panel max-h-[92vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-b-none p-6 sm:rounded-[18px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-crimson/20 bg-crimson/10 text-crimson">
              {isInterview ? <Mail className="h-5 w-5" aria-hidden="true" /> : <Coffee className="h-5 w-5" aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <h2 id="invite-dialog-title" className="font-heading text-base font-semibold text-[#1d1d1f]">
                {isInterview ? 'Invite to interview' : 'Request a coffee chat'}
              </h2>
              <p className="truncate text-xs text-muted">
                {candidate.name} · {candidate.programme}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close invitation dialog"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] text-muted transition hover:bg-black/[0.06] hover:text-[#1d1d1f]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field
            id="invite-role"
            label={isInterview ? 'Role or position' : 'What would you like to talk about?'}
            value={role}
            onChange={setRole}
            placeholder={isInterview ? 'e.g. Graduate Data Analyst' : 'e.g. Career paths in analytics'}
          />
          <Field
            id="invite-when"
            label="Proposed date and format"
            value={when}
            onChange={setWhen}
            placeholder="e.g. 25 August, 10:00 · virtual"
          />
          <div>
            <label htmlFor="invite-note" className="mb-1.5 block text-xs font-semibold text-muted">
              Message to the student (optional)
            </label>
            <textarea
              id="invite-note"
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Mention what in their public showcase caught your attention."
              className="w-full rounded-[16px] border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-[#1d1d1f] outline-none transition focus:border-crimson focus:ring-2 focus:ring-crimson/20"
            />
          </div>

          <p className="flex items-start gap-2 rounded-[14px] border border-black/[0.06] bg-black/[0.02] p-3 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              Sent from <span className="font-semibold text-[#1d1d1f]">{employerName}</span> to the student&apos;s QIU CPDC
              inbox. You do not receive their contact details unless they choose to reply.
            </span>
          </p>

          <button type="submit" className="crimson-btn min-h-[44px] w-full justify-center text-sm">
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>{isInterview ? 'Send invitation' : 'Send request'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-[16px] border border-black/10 bg-black/[0.03] px-4 text-sm text-[#1d1d1f] outline-none transition focus:border-crimson focus:ring-2 focus:ring-crimson/20"
      />
    </div>
  );
}
