'use client';

import AssessmentWorkspace from '@/components/AssessmentWorkspace';
import RoleModuleNotice from '@/components/RoleModuleNotice';
import { usePortal } from '@/components/portal/PortalProvider';

const ASSESSMENT_ROLES = new Set([
  'STUDENT',
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'ACADEMIC_SUPERVISOR',
  'CPDC_ADMIN',
  'SUPER_ADMIN',
]);

export default function Page() {
  const { currentRole, activeFaculty, student } = usePortal();
  if (!ASSESSMENT_ROLES.has(currentRole)) {
    return (
      <RoleModuleNotice
        currentRole={currentRole}
        title="Assessments are not part of this workspace"
        description="Students take published assessments. Lecturers and CPDC officers create and review them. Your current role can use the modules shown in your navigation."
        actions={[{ href: '/help', label: 'Open the simple guide', description: 'See what each role can do and where to ask for help.' }]}
      />
    );
  }
  return <AssessmentWorkspace currentRole={currentRole} activeFaculty={activeFaculty} student={student} />;
}
