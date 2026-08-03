'use client';

import EmployerWorkspace from '@/components/EmployerWorkspace';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { currentRole } = usePortal();
  return <EmployerWorkspace currentRole={currentRole} />;
}
