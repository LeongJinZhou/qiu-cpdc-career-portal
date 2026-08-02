'use client';

import AdminControlCenter from '@/components/AdminControlCenter';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { activeFaculty, currentRole, student, setStudent } = usePortal();
  return <AdminControlCenter activeFaculty={activeFaculty} currentRole={currentRole} student={student} setStudent={setStudent} />;
}
