'use client';

import CareerPath from '@/components/CareerPath';
import RoleModuleNotice from '@/components/RoleModuleNotice';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { student, activeFaculty, currentRole } = usePortal();
  if (currentRole !== 'STUDENT') {
    return (
      <RoleModuleNotice
        currentRole={currentRole}
        title="Career path operations"
        description="The multi-year milestone graph is student-owned. Staff use the live operations views to review readiness, verified internship hours and lifecycle transitions without editing a student's roadmap as if they were the student."
        actions={[
          { href: '/admin', label: 'Open student health', description: 'Review scoped readiness, missing milestones and the next intervention for each student.' },
          { href: '/admin', label: 'Open analytics', description: 'See live FYP, logbook, course-verification and workshop workload metrics.' },
        ]}
      />
    );
  }
  return <CareerPath student={student} activeFaculty={activeFaculty} />;
}
