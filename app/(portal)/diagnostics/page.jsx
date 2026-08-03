'use client';

import DiagnosticTests from '@/components/DiagnosticTests';
import RoleModuleNotice from '@/components/RoleModuleNotice';
import { usePortal } from '@/components/portal/PortalProvider';

export default function Page() {
  const { student, setStudent, activeFaculty, currentRole } = usePortal();
  if (currentRole !== 'STUDENT') {
    return (
      <RoleModuleNotice
        currentRole={currentRole}
        title="Skills diagnostic review"
        description="Diagnostic attempts belong to the student account and are scored by the server. This role view keeps the learner form closed; use the scoped operations centre for readiness and intervention signals."
        actions={[{ href: '/admin?tab=students', label: 'Open student health', description: "Review live readiness and identify the next support action without submitting on a student's behalf." }]}
      />
    );
  }
  return (
    <DiagnosticTests student={student} setStudent={setStudent} activeFaculty={activeFaculty} />
  );
}
