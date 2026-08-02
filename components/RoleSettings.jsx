'use client';

import { useState } from 'react';
import { Bell, Check, LockKeyhole, Save, Settings2 } from 'lucide-react';
import AccountProfileForm from '@/components/settings/AccountProfileForm';

const PREFS_KEY = 'qiu.portal.preferences';

const ROLE_COPY = {
  ALUMNI: 'Manage mentor availability and opportunity notifications without editing student records.',
  EMPLOYER: 'Manage employer workspace notifications. Student identity and profile data remain read-only.',
  FACULTY_COORDINATOR: 'Manage faculty-scoped notifications. Verified student identity fields require Superadmin review.',
};

export default function RoleSettings({ currentRole, activeFaculty }) {
  const [preferences, setPreferences] = useState({ opportunities: true, approvals: true, digest: true });
  const [saved, setSaved] = useState(false);

  const save = (event) => {
    event.preventDefault();
    try {
      window.localStorage?.setItem(`${PREFS_KEY}.${currentRole}`, JSON.stringify(preferences));
    } catch {
      // Preferences remain usable for this session.
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="section-title flex items-center gap-2.5"><Settings2 className="h-6 w-6 text-crimson" /> Workspace settings</h1>
          <p className="section-subtitle mt-1.5 max-w-2xl">{ROLE_COPY[currentRole] ?? 'Manage your workspace preferences.'}</p>
        </div>
        <span className="badge-pill w-fit border border-black/10 bg-white text-muted">{currentRole.replace('_', ' ')} · {activeFaculty.code}</span>
      </div>

      <AccountProfileForm />

      <form onSubmit={save} className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="surface space-y-5 p-6">
          <div className="flex items-start gap-3 border-b border-black/10 pb-4"><span className="rounded-xl bg-crimson/10 p-2 text-crimson"><LockKeyhole className="h-4 w-4" /></span><div><h2 className="font-heading text-lg font-semibold">Verified access scope</h2><p className="mt-1 text-xs leading-relaxed text-muted">This demo surface does not expose or edit student identity records. Production access will be resolved from the authenticated QIU account.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><ReadOnly label="Account role" value={currentRole.replace('_', ' ')} /><ReadOnly label="Workspace scope" value={currentRole === 'FACULTY_COORDINATOR' ? activeFaculty.name : 'QIU CPDC network'} /></div>
        </section>

        <section className="surface space-y-5 p-6">
          <div className="flex items-center gap-2 border-b border-black/10 pb-4"><Bell className="h-4 w-4 text-crimson" /><h2 className="font-heading text-lg font-semibold">Notifications</h2></div>
          {Object.entries(preferences).map(([id, enabled]) => <label key={id} className="flex items-center justify-between gap-3 text-sm"><span className="capitalize">{id === 'digest' ? 'Weekly CPDC digest' : id === 'approvals' ? 'Approval activity' : 'Opportunity alerts'}</span><input type="checkbox" checked={enabled} onChange={() => setPreferences((previous) => ({ ...previous, [id]: !enabled }))} className="h-4 w-4 accent-[var(--crimson)]" /></label>)}
          <button type="submit" className="crimson-btn min-h-[46px] w-full justify-center">{saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saved ? 'Saved' : 'Save preferences'}</button>
        </section>
      </form>
    </div>
  );
}

function ReadOnly({ label, value }) {
  return <div className="rounded-[16px] border border-black/10 bg-black/[0.03] p-3.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p><p className="mt-1 truncate text-sm font-medium text-[#1d1d1f]">{value}</p></div>;
}
