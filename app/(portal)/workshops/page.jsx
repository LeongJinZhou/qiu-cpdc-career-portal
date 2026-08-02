'use client';

import WorkshopHub from '@/components/WorkshopHub';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { student, setStudent, activeFaculty, currentRole } = usePortal();
  return (
    <WorkshopHub
      student={student}
      setStudent={setStudent}
      activeFaculty={activeFaculty}
      currentRole={currentRole}
    />
  );
}
