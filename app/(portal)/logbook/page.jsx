'use client';

import ModularLogbook from '@/components/ModularLogbook';
import LogbookReviewQueue from '@/components/admin/LogbookReviewQueue';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { student, setStudent, activeFaculty, currentRole } = usePortal();
  if (currentRole !== 'STUDENT') {
    return <LogbookReviewQueue currentRole={currentRole} />;
  }
  return <ModularLogbook student={student} setStudent={setStudent} activeFaculty={activeFaculty} />;
}
