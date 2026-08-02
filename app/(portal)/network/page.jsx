'use client';

import AlumniNetwork from '@/components/AlumniNetwork';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { student, activeFaculty, currentRole } = usePortal();
  return <AlumniNetwork student={student} activeFaculty={activeFaculty} currentRole={currentRole} />;
}
