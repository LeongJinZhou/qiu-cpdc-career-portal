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
        actions={[{ href: '/admin', label: 'Open operations centre', description: 'Review the live student health, analytics, approval queues and audit trail.' }]}
      />
    );
  }
  return <AICareerSuite student={student} activeFaculty={activeFaculty} />;
}
