const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

function hasDiagnostic(student) {
  return Boolean(
    student?.diagnosticResult
    || (student?.badges ?? []).some((badge) => (
      badge?.category === 'Assessment'
      || String(badge?.title ?? '').toLowerCase().includes('diagnostic')
    )),
  );
}

/**
 * Select one transparent, deterministic next action from real student state.
 * Rules are ordered by foundational value, then by year and engagement.
 */
export function nextBestAction({ student = {}, activeFaculty = {} } = {}) {
  const year = Math.min(12, Math.max(1, Number(student.year) || 1));
  const facultyName = activeFaculty.name || 'your faculty';
  const hasProfile = hasText(student.bio) && (hasText(student.careerTargets) || hasText(student.industries));
  const workshopAttendance = Array.isArray(student.workshopAttendance)
    ? student.workshopAttendance.length
    : 0;
  const logbookEntries = Array.isArray(student.logbookEntries) ? student.logbookEntries : [];

  if (!hasProfile) {
    return {
      id: 'profile',
      title: 'Complete your career profile',
      desc: 'Add your goals and short bio so the roadmap and workshop matches become more useful.',
      cta: 'Open profile',
      tab: 'settings',
      icon: 'UserCheck',
    };
  }

  if (!hasDiagnostic(student)) {
    return {
      id: 'diagnostic',
      title: 'Take your Skills Diagnostic',
      desc: 'A short test maps your strengths and gaps so the platform can recommend focused practice.',
      cta: 'Start diagnostic',
      tab: 'diagnostics',
      icon: 'Target',
    };
  }

  if (year >= 3 && !student.fypSubmission) {
    return {
      id: 'fyp',
      title: 'Upload your Final Year Project',
      desc: 'Sync your capstone to your CV and send it to the programme review queue.',
      cta: 'Go to FYP',
      tab: 'fyp',
      icon: 'FileCheck',
    };
  }

  const hasPendingOrApprovedLog = logbookEntries.some((entry) => (
    entry?.status === 'PENDING' || entry?.status === 'APPROVED'
  ));
  if (year >= 2 && !hasPendingOrApprovedLog) {
    return {
      id: 'logbook',
      title: 'Log your next fieldwork activity',
      desc: 'Keep your practical evidence current and send the next entry for supervisor sign-off.',
      cta: 'Open logbook',
      tab: 'logbook',
      icon: 'BookOpen',
    };
  }

  if (workshopAttendance === 0) {
    return {
      id: 'workshop',
      title: `Workshops matched to ${facultyName}`,
      desc: 'Join a focused session, RSVP in advance, and earn verified Career XP at check-in.',
      cta: 'Browse workshops',
      tab: 'workshops',
      icon: 'TrendingUp',
    };
  }

  return {
    id: 'career-path',
    title: 'Advance your Career Path',
    desc: 'Choose the next milestone in your four-year roadmap and keep your readiness moving.',
    cta: 'Open roadmap',
    tab: 'careerpath',
    icon: 'Map',
  };
}
