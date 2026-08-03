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
        actions={[{
          href: '/admin?tab=students',
          label: 'Open student health & analytics',
          description: 'Review scoped readiness, missing milestones, next interventions and live operational workload in one staff console.',
        }]}
      />
    );
  }
  return <CareerPath student={student} activeFaculty={activeFaculty} />;
}
