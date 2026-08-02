'use client';

import TalentFeed from '@/components/TalentFeed';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { currentRole, student } = usePortal();
  return <TalentFeed currentRole={currentRole} student={student} />;
}
