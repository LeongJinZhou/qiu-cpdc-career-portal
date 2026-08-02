'use client';

import ProfileSettings from '@/components/ProfileSettings';
import RoleSettings from '@/components/RoleSettings';
import SettingsEngine from '@/components/SettingsEngine';
import AccountProfileForm from '@/components/settings/AccountProfileForm';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { currentRole, activeFaculty } = usePortal();
  if (currentRole === 'CPDC_ADMIN' || currentRole === 'SUPER_ADMIN') {
    return <div className="space-y-6"><AccountProfileForm /><SettingsEngine /></div>;
  }
  if (currentRole === 'STUDENT') return <ProfileSettings />;
  return <RoleSettings currentRole={currentRole} activeFaculty={activeFaculty} />;
}
