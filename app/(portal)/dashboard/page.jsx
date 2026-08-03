'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StudentDashboard from '@/components/StudentDashboard';
import StudentPathway from '@/components/portal/StudentPathway';
import LoadingScreen from '@/components/LoadingScreen';
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
  const { student, activeFaculty, currentRole } = usePortal();

  useEffect(() => {
    if (currentRole === 'SUPER_ADMIN') {
      router.replace('/admin');
    }
  }, [currentRole, router]);

  const navigate = (tabId) => {
    const href = TAB_ROUTES[tabId];
    if (href) router.push(href);
  };

  if (currentRole === 'SUPER_ADMIN') {
    return <LoadingScreen label="Opening your admin console" />;
  }

  return (
    <div className="space-y-6">
      {/* The pathway spine sits ABOVE the dashboard tiles on purpose. The tiles
          answer "what is available"; the pathway answers "what should I do
          next", and a student who reads only the first screen should get the
          second answer. Students only — staff and employers have a different
          job here and would be misled by a student progress track. */}
      {currentRole === 'STUDENT' ? (
        <StudentPathway student={student} activeFaculty={activeFaculty} />
      ) : null}

      <StudentDashboard
        student={student}
        activeFaculty={activeFaculty}
        setActiveTab={navigate}
      />
    </div>
  );
}
