'use client';

import EmployerWorkspace from '@/components/EmployerWorkspace';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { student, currentRole } = usePortal();
  return <EmployerWorkspace student={student} currentRole={currentRole} />;
}
