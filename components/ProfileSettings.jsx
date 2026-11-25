'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, FileText, LogOut, UserCircle } from 'lucide-react';
import { usePortal } from '@/components/portal/PortalProvider';
import PersonalDetailsForm from '@/components/settings/PersonalDetailsForm';
import ResumeEditor from '@/components/settings/ResumeEditor';
import LinkedInImport from '@/components/settings/LinkedInImport';

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
  const [importVersion, setImportVersion] = useState(0);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="section-title flex items-center gap-2.5">
            <UserCircle className="h-6 w-6 text-crimson" aria-hidden="true" /> Profile &amp; settings
          </h1>
          <p className="section-subtitle mt-1.5 max-w-2xl">
            {/* This used to claim EVERYTHING here saves to the QIU account.
                Your details and resume do; notification preferences are still
                stored per-browser (see NotificationPreferences below), so the
                blanket claim was false for that one tab. Scoped rather than
                deleted, because the guarantee is real and worth stating where
                it actually holds. */}
            Keep your details and resume up to date. Your details, links and resume are saved to your
            QIU account, so they follow you to any device.
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
        {tab === 'details' || tab === 'resume' ? (
          <div className="mb-6">
            <LinkedInImport onImported={() => setImportVersion((version) => version + 1)} />
          </div>
        ) : null}
        {/* The key remounts the form so it reloads what the import saved. */}
        {tab === 'details' ? <PersonalDetailsForm key={`details-${importVersion}`} /> : null}
        {tab === 'resume' ? <ResumeEditor key={`resume-${importVersion}`} /> : null}
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
 * Notification choices are a per-device convenience, not account data. Domain
 * actions are still recorded server-side in the notification bell and outbox;
 * these switches only control local highlights until preference storage is
 * promoted to the account layer.
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
          These choices are remembered on this device only and change what the portal highlights for
          you. Registration, approval and workflow alerts are recorded in the notification bell and
          queued for email when a provider is connected.
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
