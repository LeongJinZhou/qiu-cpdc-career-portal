'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, FileText, LogOut, UserCircle } from 'lucide-react';
import { usePortal } from '@/components/portal/PortalProvider';
import PersonalDetailsForm from '@/components/settings/PersonalDetailsForm';
import ResumeEditor from '@/components/settings/ResumeEditor';

const PREFS_KEY = 'qiu.portal.preferences';

const TABS = [
  { id: 'details', label: 'Personal details', icon: UserCircle },
  { id: 'resume', label: 'Resume', icon: FileText },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const NOTIFICATION_LABELS = {
  workshops: 'Workshops that match my interests',
  approvals: 'When a supervisor approves my logbook',
  opportunities: 'New jobs and internships for me',
};

export default function ProfileSettings() {
  const { student, activeFaculty } = usePortal();
  const [tab, setTab] = useState('details');

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="section-title flex items-center gap-2.5">
            <UserCircle className="h-6 w-6 text-crimson" aria-hidden="true" /> Profile &amp; settings
          </h1>
          <p className="section-subtitle mt-1.5 max-w-2xl">
            Keep your details and resume up to date. Everything you change here is saved to your QIU
            account, not just to this browser.
          </p>
        </div>
        <span className="badge-pill w-fit border border-black/10 bg-white text-muted">
          {activeFaculty?.code} · Year {student?.year}
        </span>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Profile sections">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={active}
              aria-controls={`settings-panel-${id}`}
              onClick={() => setTab(id)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-[16px] border px-4 text-sm font-semibold transition ${
                active
                  ? 'border-crimson bg-crimson text-white'
                  : 'border-black/10 bg-white text-muted hover:bg-black/[0.03]'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
      >
        {tab === 'details' ? <PersonalDetailsForm /> : null}
        {tab === 'resume' ? <ResumeEditor /> : null}
        {tab === 'notifications' ? <NotificationPreferences /> : null}
      </div>

      <section className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold">Signing out</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Ends your session on this device. Your saved details stay on your QIU account and will be
            here when you sign back in.
          </p>
        </div>
        <Link href="/logout" className="secondary-btn inline-flex min-h-[44px] items-center justify-center gap-2">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Link>
      </section>
    </div>
  );
}

/**
 * Notification choices are a per-device convenience, not account data — there is
 * no notification delivery service behind them yet. They are stored in this
 * browser and the copy says so, rather than implying an email preference the
 * platform would not honour.
 */
function NotificationPreferences() {
  const [notifications, setNotifications] = useState({
    workshops: true,
    approvals: true,
    opportunities: true,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage?.getItem(PREFS_KEY) ?? 'null');
      if (stored) setNotifications((previous) => ({ ...previous, ...stored }));
    } catch {
      // Preferences are optional in restricted browsers.
    }
  }, []);

  const toggle = (id) => {
    const next = { ...notifications, [id]: !notifications[id] };
    setNotifications(next);
    try {
      window.localStorage?.setItem(PREFS_KEY, JSON.stringify(next));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch {
      // Choices still apply for this session.
    }
  };

  return (
    <section className="surface space-y-4 p-5 sm:p-6">
      <div className="border-b border-black/10 pb-4">
        <h2 className="font-heading text-lg font-semibold">What you want to hear about</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          These choices are remembered on this device only, and change what the portal highlights for
          you. They do not currently change any emails you receive.
        </p>
      </div>

      {Object.entries(notifications).map(([id, enabled]) => (
        <label key={id} className="flex min-h-[44px] items-center justify-between gap-3 text-sm">
          <span>{NOTIFICATION_LABELS[id] ?? id}</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => toggle(id)}
            className="h-5 w-5 accent-[var(--crimson)]"
          />
        </label>
      ))}

      {saved ? (
        <p className="text-xs font-semibold text-crimson" role="status">Saved on this device.</p>
      ) : null}
    </section>
  );
}
