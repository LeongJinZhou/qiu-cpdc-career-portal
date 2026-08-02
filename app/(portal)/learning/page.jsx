'use client';

import LearningHub from '@/components/LearningHub';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { student, setStudent, activeFaculty, currentRole } = usePortal();
  return (
    <LearningHub
      student={student}
      setStudent={setStudent}
      activeFaculty={activeFaculty}
      currentRole={currentRole}
    />
  );
}
