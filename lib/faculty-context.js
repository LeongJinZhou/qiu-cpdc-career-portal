// Demo-only context projection used by the faculty switcher.
//
// A faculty switch must change the complete working context, not only the
// colour and label in the shell. This keeps programme matching, diagnostics,
// roadmaps and next-best-actions aligned while the standalone demo is used.
// Real Firebase identities never use this projection; their faculty and
// programme remain the canonical database values.

const CONTEXTS = {
  business: {
    programme: 'Bachelor of Business Administration (Honours)',
    careerTargets: 'Business analyst / strategy consultant / finance associate',
    industries: 'Banking, consulting, financial services, retail',
    skills: ['Excel', 'Financial modelling', 'Presentation', 'Stakeholder communication'],
  },
  education: {
    programme: 'Bachelor in Early Childhood Education (Honours)',
    careerTargets: 'Instructional designer / teacher / learning support specialist',
    industries: 'Schools, education technology, training and development',
    skills: ['Lesson planning', 'Classroom management', 'Communication', 'Inclusive practice'],
  },
  medicine: {
    programme: 'Bachelor of Medicine and Bachelor of Surgery (MBBS)',
    careerTargets: 'Clinical practitioner / clinical researcher / public health physician',
    industries: 'Hospitals, public health, clinical research, healthcare',
    skills: ['Clinical reasoning', 'Patient communication', 'Evidence appraisal', 'Teamwork'],
  },
  pharmacy: {
    programme: 'Bachelor of Pharmacy with Honours',
    careerTargets: 'Clinical pharmacist / regulatory pharmacist / pharmaceutical researcher',
    industries: 'Hospitals, community pharmacy, pharmaceutical manufacturing, regulatory affairs',
    skills: ['Dispensing', 'Pharmacology', 'Patient counselling', 'Regulatory documentation'],
  },
  lifesciences: {
    programme: 'Bachelor of Science (Honours) in Biotechnology',
    careerTargets: 'Laboratory scientist / biotech analyst / research associate',
    industries: 'Biotechnology, diagnostics, environmental science, research and development',
    skills: ['Laboratory technique', 'Biosafety', 'Data analysis', 'Research documentation'],
  },
  computing_engineering: {
    programme: 'Bachelor of Computer Science (Honours)',
    careerTargets: 'Software engineer / applied AI researcher / data engineer',
    industries: 'AI, software engineering, cloud platforms, climate technology',
    skills: ['Python', 'Machine learning', 'Software testing', 'Technical communication'],
  },
  hospitality: {
    programme: 'Bachelor of Hospitality Management (Honours)',
    careerTargets: 'Hotel operations manager / guest experience lead / events manager',
    industries: 'Hotels, tourism, events, food and beverage',
    skills: ['Guest experience', 'Operations', 'Event planning', 'Service recovery'],
  },
  communication: {
    programme: 'Bachelor of Corporate Communication (Honours)',
    careerTargets: 'Corporate communications specialist / content strategist / PR executive',
    industries: 'Public relations, media, advertising, corporate affairs',
    skills: ['Copywriting', 'Media relations', 'Campaign planning', 'Content production'],
  },
};

export function facultyContextFor(facultyId) {
  return CONTEXTS[facultyId] ?? {
    programme: '',
    careerTargets: '',
    industries: '',
    skills: [],
  };
}

function programmeNames(faculty) {
  return (faculty?.programmes ?? []).map((programme) => (
    typeof programme === 'string' ? programme : programme.name
  )).filter(Boolean);
}

export function preferredProgrammeFor(faculty, currentProgramme = '') {
  const names = programmeNames(faculty);
  if (names.includes(currentProgramme)) return currentProgramme;

  const preferred = facultyContextFor(faculty?.id).programme;
  if (names.includes(preferred)) return preferred;

  return names.find((name) => /bachelor/i.test(name))
    ?? names.find((name) => /diploma/i.test(name))
    ?? names[0]
    ?? '';
}

export function projectStudentToFaculty(student, faculty, programme = '') {
  if (!student || !faculty) return student;
  const context = facultyContextFor(faculty.id);
  const nextProgramme = preferredProgrammeFor(faculty, programme || student.programme);
  const nextSkills = [...new Set([...(context.skills ?? []), ...(student.skills ?? [])])].slice(0, 12);

  return {
    ...student,
    facultyId: faculty.id,
    programmeId: null,
    programme: nextProgramme,
    careerTargets: context.careerTargets || student.careerTargets || '',
    industries: context.industries || student.industries || '',
    skills: nextSkills,
    // A diagnostic belongs to a discipline. Do not display a Computing radar
    // after the user has switched to Medicine in the standalone demo.
    diagnosticResult: null,
  };
}

export function selectProgrammeForFaculty(student, faculty, programme) {
  if (!student || !faculty) return student;
  return projectStudentToFaculty(student, faculty, programme);
}

export { CONTEXTS as FACULTY_CONTEXTS };
