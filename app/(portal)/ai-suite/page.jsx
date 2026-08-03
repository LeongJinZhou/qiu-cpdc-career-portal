'use client';

import AICareerSuite from '@/components/AICareerSuite';
import RoleModuleNotice from '@/components/RoleModuleNotice';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { student, activeFaculty, currentRole } = usePortal();
  if (currentRole !== 'STUDENT') {
    return (
      <RoleModuleNotice
        currentRole={currentRole}
        title="Interview practice controls"
        description="The standalone practice studio is student self-service. Staff can review live readiness and course evidence from the operations centre; automated AI scoring is deliberately disabled until an approved provider is configured."
        actions={[{ href: '/admin?tab=analytics', label: 'Open operations analytics', description: 'Review live readiness, workload and audit signals from the staff console.' }]}
      />
    );
  }
  return <AICareerSuite student={student} activeFaculty={activeFaculty} />;
}
