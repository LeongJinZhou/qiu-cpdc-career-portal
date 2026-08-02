'use client';

import FYPShowcase from '@/components/FYPShowcase';
import FypApprovalQueue from '@/components/admin/FypApprovalQueue';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { student, setStudent, activeFaculty, currentRole } = usePortal();
  if (currentRole !== 'STUDENT') {
    return <FypApprovalQueue currentRole={currentRole} />;
  }
  return <FYPShowcase student={student} setStudent={setStudent} activeFaculty={activeFaculty} />;
}
