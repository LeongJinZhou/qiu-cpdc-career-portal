'use client';

import { useRouter } from 'next/navigation';
import StudentDashboard from '@/components/StudentDashboard';
import AdminControlCenter from '@/components/AdminControlCenter';
import { usePortal } from '@/components/portal/PortalProvider';

/**
 * StudentDashboard still navigates by calling setActiveTab('autocv') and
 * friends, from when the whole portal lived on one page. Rather than rewrite
 * the component, we translate those tab ids into real routes here — its
 * internal links keep working and browser history stays correct.
 */
const TAB_ROUTES = {
  dashboard: '/dashboard',
  autocv: '/cv',
  workshops: '/workshops',
  alumni: '/network',
  logbook: '/logbook',
  aisuite: '/ai-suite',
  employer: '/employers',
  admin: '/admin',
  fyp: '/fyp',
  diagnostics: '/diagnostics',
  careerpath: '/career-path',
};

export default function Page() {
  const router = useRouter();
  const { student, setStudent, activeFaculty, currentRole } = usePortal();

  const navigate = (tabId) => {
    const href = TAB_ROUTES[tabId];
    if (href) router.push(href);
  };

  if (currentRole === 'SUPER_ADMIN') {
    return <AdminControlCenter activeFaculty={activeFaculty} currentRole={currentRole} student={student} setStudent={setStudent} />;
  }

  return (
    <StudentDashboard
      student={student}
      setStudent={setStudent}
      activeFaculty={activeFaculty}
      setActiveTab={navigate}
    />
  );
}
