'use client';

import AutoCVEngine from '@/components/AutoCVEngine';
import RoleModuleNotice from '@/components/RoleModuleNotice';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { student, activeFaculty, currentRole } = usePortal();
  if (currentRole !== 'STUDENT') {
    return (
      <RoleModuleNotice
        currentRole={currentRole}
        title="Review a student CV"
        description="Staff accounts do not edit a student’s personal CV from the student self-service screen. Open a role-permitted student record from the Admin console instead."
        actions={[{ href: '/admin?tab=records', label: 'Open student records', description: 'Search by student ID, name or email, then review the fields your role is allowed to see.' }]}
      />
    );
  }
  return <AutoCVEngine student={student} activeFaculty={activeFaculty} />;
}
