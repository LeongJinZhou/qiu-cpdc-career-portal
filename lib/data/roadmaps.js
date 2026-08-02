// Year-by-Year Career Paths (Blueprint Module 7) — the CPDC platform's
// flagship screen. One 4-stage path per faculty, each stage a concrete,
// faculty-appropriate set of actions that link to a real portal route.
//
// Shape:
//   CAREER_PATHS[facultyId] = [
//     { year: 1..4, label, title, items: [ { label, href, required? } ] },
//     ...
//   ]
//
// `required` items are the ones the reprioritisation logic treats as
// milestones a student cannot afford to skip.

export const CAREER_PATHS = {
  business: [
    {
      year: 1,
      label: 'Year 1',
      title: 'Foundations & Financial Literacy',
      items: [
        { label: 'Complete CPDC onboarding & skills diagnostic', href: '/diagnostics', required: true },
        { label: 'Join a business case club & attend orientation', href: '/workshops' },
        { label: 'Build your first ATS-ready CV draft', href: '/cv' },
        { label: 'Set career targets: banking, consulting or trade', href: '/dashboard' },
      ],
    },
    {
      year: 2,
      label: 'Year 2',
      title: 'Corporate Analytics & Competitions',
      items: [
        { label: 'Enter an inter-varsity business case competition', href: '/workshops', required: true },
        { label: 'Earn a Bloomberg Market Concepts / analytics badge', href: '/diagnostics' },
        { label: 'Log a corporate shadowing / part-time attachment', href: '/logbook' },
        { label: 'Book an alumni coffee chat in finance or strategy', href: '/network' },
        { label: 'Refresh CV with quantified project outcomes', href: '/cv' },
      ],
    },
    {
      year: 3,
      label: 'Year 3',
      title: 'MNC Internship & Strategy',
      items: [
        { label: 'Secure & log a 12–16 week MNC internship', href: '/logbook', required: true },
        { label: 'Complete a financial modelling / valuation workshop', href: '/workshops', required: true },
        { label: 'Run 3 AI mock interviews for graduate schemes', href: '/ai-suite' },
        { label: 'Opt into the employer talent marketplace', href: '/employers' },
        { label: 'Sync internship badges to your CV', href: '/cv' },
      ],
    },
    {
      year: 4,
      label: 'Final Year',
      title: 'Capstone & Graduate Trainee Pool',
      items: [
        { label: 'Publish your capstone / business plan to the showcase', href: '/fyp', required: true },
        { label: 'Apply to graduate trainee & leadership programmes', href: '/employers', required: true },
        { label: 'Finalise ATS CV and LinkedIn audit', href: '/cv' },
        { label: 'Complete an executive interview simulation', href: '/ai-suite' },
        { label: 'Request alumni referrals for target firms', href: '/network' },
      ],
    },
  ],

  education: [
    {
      year: 1,
      label: 'Year 1',
      title: 'Pedagogy Foundations',
      items: [
        { label: 'Complete CPDC onboarding & teaching diagnostic', href: '/diagnostics', required: true },
        { label: 'Attend classroom-management workshops', href: '/workshops' },
        { label: 'Start a lesson-plan portfolio', href: '/logbook' },
        { label: 'Draft your teaching-philosophy CV', href: '/cv' },
      ],
    },
    {
      year: 2,
      label: 'Year 2',
      title: 'Observation & Micro-Teaching',
      items: [
        { label: 'Log supervised classroom observation hours', href: '/logbook', required: true },
        { label: 'Complete inclusive & special-needs education modules', href: '/workshops' },
        { label: 'Earn a child-development / TESL skill badge', href: '/diagnostics' },
        { label: 'Coffee chat with a practising educator alumnus', href: '/network' },
        { label: 'Add micro-teaching evidence to your CV', href: '/cv' },
      ],
    },
    {
      year: 3,
      label: 'Year 3',
      title: 'Teaching Practicum',
      items: [
        { label: 'Complete school teaching practicum & log hours', href: '/logbook', required: true },
        { label: 'Collect supervisor lesson evaluations', href: '/logbook', required: true },
        { label: 'Run a mock teaching-interview session', href: '/ai-suite' },
        { label: 'Attend a curriculum-design workshop', href: '/workshops' },
        { label: 'Join the graduate-teacher employer feed', href: '/employers' },
      ],
    },
    {
      year: 4,
      label: 'Final Year',
      title: 'Certification & Placement',
      items: [
        { label: 'Publish practicum research to the FYP showcase', href: '/fyp', required: true },
        { label: 'Apply to schools & district placements', href: '/employers', required: true },
        { label: 'Finalise teaching-portfolio CV', href: '/cv' },
        { label: 'Complete a panel-interview simulation', href: '/ai-suite' },
        { label: 'Secure alumni references from mentor teachers', href: '/network' },
      ],
    },
  ],

  medicine: [
    {
      year: 1,
      label: 'Year 1',
      title: 'Anatomy & Basic Sciences',
      items: [
        { label: 'Complete CPDC onboarding & clinical-readiness diagnostic', href: '/diagnostics', required: true },
        { label: 'Certify First Aid / BLS through a workshop', href: '/workshops', required: true },
        { label: 'Log cadaveric anatomy lab hours', href: '/logbook' },
        { label: 'Start your clinical CV & competency record', href: '/cv' },
      ],
    },
    {
      year: 2,
      label: 'Year 2',
      title: 'Pathology & Clinical Skills',
      items: [
        { label: 'Complete hospital shadowing logbook (40+ hrs)', href: '/logbook', required: true },
        { label: 'Attend an OSCE clinical-skills simulation workshop', href: '/workshops', required: true },
        { label: 'Pass the systemic pathology skills diagnostic', href: '/diagnostics' },
        { label: 'Coffee chat with a doctor / registrar alumnus', href: '/network' },
        { label: 'Add competency badges to your CV', href: '/cv' },
      ],
    },
    {
      year: 3,
      label: 'Year 3',
      title: 'Junior Clinical Rotations',
      items: [
        { label: 'Log ward clinical-rotation shifts with sign-offs', href: '/logbook', required: true },
        { label: 'Complete OSCE / airway-management prep workshop', href: '/workshops', required: true },
        { label: 'Record anonymised patient case encounters', href: '/logbook' },
        { label: 'Run a clinical-scenario interview simulation', href: '/ai-suite' },
        { label: 'Sync signed-off competencies to your CV', href: '/cv' },
      ],
    },
    {
      year: 4,
      label: 'Final Year',
      title: 'Senior Clinical & Housemanship Prep',
      items: [
        { label: 'Log ICU / emergency senior-rotation hours', href: '/logbook', required: true },
        { label: 'Publish a clinical case report to the showcase', href: '/fyp', required: true },
        { label: 'Enter hospital housemanship placement matching', href: '/employers', required: true },
        { label: 'Complete a medical-board interview simulation', href: '/ai-suite' },
        { label: 'Request specialist alumni references', href: '/network' },
      ],
    },
  ],

  pharmacy: [
    {
      year: 1,
      label: 'Year 1',
      title: 'Pharmaceutical Foundations',
      items: [
        { label: 'Complete CPDC onboarding & pharmacology diagnostic', href: '/diagnostics', required: true },
        { label: 'Clear a biosafety & dispensing-basics workshop', href: '/workshops', required: true },
        { label: 'Start a compounding / lab competency log', href: '/logbook' },
        { label: 'Draft your clinical pharmacy CV', href: '/cv' },
      ],
    },
    {
      year: 2,
      label: 'Year 2',
      title: 'Therapeutics & Compounding',
      items: [
        { label: 'Log compounding & dispensing lab hours', href: '/logbook', required: true },
        { label: 'Complete a clinical-therapeutics workshop', href: '/workshops' },
        { label: 'Pass the drug-interaction skills diagnostic', href: '/diagnostics' },
        { label: 'Coffee chat with a hospital-pharmacist alumnus', href: '/network' },
        { label: 'Add dispensing competencies to your CV', href: '/cv' },
      ],
    },
    {
      year: 3,
      label: 'Year 3',
      title: 'Preceptor Attachment',
      items: [
        { label: 'Complete hospital / community preceptor attachment', href: '/logbook', required: true },
        { label: 'Pass the preceptor competency checklist', href: '/logbook', required: true },
        { label: 'Attend a regulatory & patient-counselling workshop', href: '/workshops' },
        { label: 'Run a clinical-counselling interview simulation', href: '/ai-suite' },
        { label: 'Join the pharmacy employer talent feed', href: '/employers' },
      ],
    },
    {
      year: 4,
      label: 'Final Year',
      title: 'Licensure & Placement',
      items: [
        { label: 'Publish your pharmaceutical research to the showcase', href: '/fyp', required: true },
        { label: 'Enter provisionally-registered pharmacist matching', href: '/employers', required: true },
        { label: 'Finalise your PharmD-ready CV', href: '/cv' },
        { label: 'Complete a licensure interview simulation', href: '/ai-suite' },
        { label: 'Secure preceptor alumni references', href: '/network' },
      ],
    },
  ],

  lifesciences: [
    {
      year: 1,
      label: 'Year 1',
      title: 'Lab Fundamentals & Biosafety',
      items: [
        { label: 'Complete CPDC onboarding & science diagnostic', href: '/diagnostics', required: true },
        { label: 'Clear a BSL-2 biosafety induction workshop', href: '/workshops', required: true },
        { label: 'Start a lab-equipment & technique log', href: '/logbook' },
        { label: 'Draft your research-focused CV', href: '/cv' },
      ],
    },
    {
      year: 2,
      label: 'Year 2',
      title: 'Techniques & Research Methods',
      items: [
        { label: 'Log molecular / analytical lab station hours', href: '/logbook', required: true },
        { label: 'Complete an instrumentation (PCR/HPLC) workshop', href: '/workshops' },
        { label: 'Pass the research-methods skills diagnostic', href: '/diagnostics' },
        { label: 'Coffee chat with a biotech / R&D alumnus', href: '/network' },
        { label: 'Add assay results to your CV portfolio', href: '/cv' },
      ],
    },
    {
      year: 3,
      label: 'Year 3',
      title: 'Industrial Attachment & Research',
      items: [
        { label: 'Complete an industry / research-lab attachment', href: '/logbook', required: true },
        { label: 'Log biosafety clearances and experiment milestones', href: '/logbook', required: true },
        { label: 'Attend a bioinformatics / data-analysis workshop', href: '/workshops' },
        { label: 'Run a research-role interview simulation', href: '/ai-suite' },
        { label: 'Opt into the life-sciences employer feed', href: '/employers' },
      ],
    },
    {
      year: 4,
      label: 'Final Year',
      title: 'Capstone Research & Placement',
      items: [
        { label: 'Publish your research project to the FYP showcase', href: '/fyp', required: true },
        { label: 'Apply to R&D / QA graduate roles', href: '/employers', required: true },
        { label: 'Finalise your research CV & publications list', href: '/cv' },
        { label: 'Complete a technical interview simulation', href: '/ai-suite' },
        { label: 'Request lab-supervisor alumni references', href: '/network' },
      ],
    },
  ],

  computing_engineering: [
    {
      year: 1,
      label: 'Year 1',
      title: 'Foundations & Algorithmic Logic',
      items: [
        { label: 'Complete CPDC onboarding & coding diagnostic', href: '/diagnostics', required: true },
        { label: 'Set up GitHub & attend a version-control workshop', href: '/workshops', required: true },
        { label: 'Log your first personal build in the portfolio', href: '/logbook' },
        { label: 'Draft your developer CV', href: '/cv' },
      ],
    },
    {
      year: 2,
      label: 'Year 2',
      title: 'Applied Software & Systems',
      items: [
        { label: 'Compete in a 48-hour hackathon', href: '/workshops', required: true },
        { label: 'Earn a cloud / data-structures skill badge', href: '/diagnostics' },
        { label: 'Ship an open-source contribution & log it', href: '/logbook' },
        { label: 'Coffee chat with a software-engineer alumnus', href: '/network' },
        { label: 'Audit your CV & LinkedIn against job specs', href: '/cv' },
      ],
    },
    {
      year: 3,
      label: 'Year 3',
      title: 'Industrial Attachment & FYP',
      items: [
        { label: 'Complete a 12-week tech internship logbook', href: '/logbook', required: true },
        { label: 'Submit FYP milestone code for review', href: '/fyp', required: true },
        { label: 'Run 3 technical mock interviews', href: '/ai-suite' },
        { label: 'Attend a system-design / AI workshop', href: '/workshops' },
        { label: 'Opt into the tech employer talent feed', href: '/employers' },
      ],
    },
    {
      year: 4,
      label: 'Final Year',
      title: 'Career Launch & Employer Matching',
      items: [
        { label: 'Present your FYP at the tech showcase', href: '/fyp', required: true },
        { label: 'Apply to top-employer talent pools', href: '/employers', required: true },
        { label: 'Finalise ATS CV & portfolio sync', href: '/cv' },
        { label: 'Complete a system-design interview simulation', href: '/ai-suite' },
        { label: 'Request alumni referrals to target teams', href: '/network' },
      ],
    },
  ],

  hospitality: [
    {
      year: 1,
      label: 'Year 1',
      title: 'Service Foundations',
      items: [
        { label: 'Complete CPDC onboarding & hospitality diagnostic', href: '/diagnostics', required: true },
        { label: 'Clear a food-safety / HACCP workshop', href: '/workshops', required: true },
        { label: 'Start a shift & technique logbook', href: '/logbook' },
        { label: 'Draft your hospitality CV', href: '/cv' },
      ],
    },
    {
      year: 2,
      label: 'Year 2',
      title: 'Operations & Culinary Technique',
      items: [
        { label: 'Log hotel-operations / kitchen shift hours', href: '/logbook', required: true },
        { label: 'Complete a culinary or front-office workshop', href: '/workshops' },
        { label: 'Pass a service-standards skills diagnostic', href: '/diagnostics' },
        { label: 'Coffee chat with a hotelier / chef alumnus', href: '/network' },
        { label: 'Add guest-satisfaction scores to your CV', href: '/cv' },
      ],
    },
    {
      year: 3,
      label: 'Year 3',
      title: 'Industry Placement',
      items: [
        { label: 'Complete an internship at a hotel / venue', href: '/logbook', required: true },
        { label: 'Collect supervisor scorecards & sign-offs', href: '/logbook', required: true },
        { label: 'Attend an events / banquet-management workshop', href: '/workshops' },
        { label: 'Run a guest-facing interview simulation', href: '/ai-suite' },
        { label: 'Join the hospitality employer feed', href: '/employers' },
      ],
    },
    {
      year: 4,
      label: 'Final Year',
      title: 'Management Track & Placement',
      items: [
        { label: 'Publish a capstone event / concept to the showcase', href: '/fyp', required: true },
        { label: 'Apply to management-trainee programmes', href: '/employers', required: true },
        { label: 'Finalise your operations CV', href: '/cv' },
        { label: 'Complete a management interview simulation', href: '/ai-suite' },
        { label: 'Secure alumni references from venue managers', href: '/network' },
      ],
    },
  ],

  communication: [
    {
      year: 1,
      label: 'Year 1',
      title: 'Media Foundations',
      items: [
        { label: 'Complete CPDC onboarding & media diagnostic', href: '/diagnostics', required: true },
        { label: 'Attend a writing / production-basics workshop', href: '/workshops' },
        { label: 'Start a published-work portfolio log', href: '/logbook' },
        { label: 'Draft your communications CV', href: '/cv' },
      ],
    },
    {
      year: 2,
      label: 'Year 2',
      title: 'Storytelling & Campaigns',
      items: [
        { label: 'Publish articles / assets to your portfolio', href: '/logbook', required: true },
        { label: 'Complete a digital-campaign / PR workshop', href: '/workshops' },
        { label: 'Pass a media-writing skills diagnostic', href: '/diagnostics' },
        { label: 'Coffee chat with a journalist / PR alumnus', href: '/network' },
        { label: 'Add reach & engagement metrics to your CV', href: '/cv' },
      ],
    },
    {
      year: 3,
      label: 'Year 3',
      title: 'Agency / Newsroom Attachment',
      items: [
        { label: 'Complete an agency / newsroom internship log', href: '/logbook', required: true },
        { label: 'Log press releases & campaign approvals', href: '/logbook', required: true },
        { label: 'Attend a crisis-communication workshop', href: '/workshops' },
        { label: 'Run an on-camera / pitch interview simulation', href: '/ai-suite' },
        { label: 'Join the media & comms employer feed', href: '/employers' },
      ],
    },
    {
      year: 4,
      label: 'Final Year',
      title: 'Portfolio Launch & Placement',
      items: [
        { label: 'Publish your capstone campaign to the showcase', href: '/fyp', required: true },
        { label: 'Apply to media, PR & advertising graduate roles', href: '/employers', required: true },
        { label: 'Finalise your portfolio-linked CV', href: '/cv' },
        { label: 'Complete a client-pitch interview simulation', href: '/ai-suite' },
        { label: 'Request alumni referrals at target outlets', href: '/network' },
      ],
    },
  ],

  default: [
    {
      year: 1,
      label: 'Year 1',
      title: 'Orientation & Self-Discovery',
      items: [
        { label: 'Complete CPDC onboarding & skills diagnostic', href: '/diagnostics', required: true },
        { label: 'Explore campus career clubs & workshops', href: '/workshops' },
        { label: 'Start your activity logbook', href: '/logbook' },
        { label: 'Draft your first CV', href: '/cv' },
      ],
    },
    {
      year: 2,
      label: 'Year 2',
      title: 'Skill Acquisition & Field Intro',
      items: [
        { label: 'Complete a first industry attachment log', href: '/logbook', required: true },
        { label: 'Earn two skill badges', href: '/diagnostics' },
        { label: 'Attend targeted skill workshops', href: '/workshops' },
        { label: 'Coffee chat with an alumnus in your field', href: '/network' },
        { label: 'Refresh your ATS CV', href: '/cv' },
      ],
    },
    {
      year: 3,
      label: 'Year 3',
      title: 'Advanced Fieldwork & Logbook',
      items: [
        { label: 'Log 100+ field / practical hours', href: '/logbook', required: true },
        { label: 'Pass the supervisor competency checklist', href: '/logbook', required: true },
        { label: 'Run mock interviews for your target role', href: '/ai-suite' },
        { label: 'Opt into the employer marketplace', href: '/employers' },
        { label: 'Sync badges to your CV', href: '/cv' },
      ],
    },
    {
      year: 4,
      label: 'Final Year',
      title: 'Graduation & Career Placement',
      items: [
        { label: 'Publish your capstone to the FYP showcase', href: '/fyp', required: true },
        { label: 'Enter employer marketplace matching', href: '/employers', required: true },
        { label: 'Finalise your CV & portfolio', href: '/cv' },
        { label: 'Complete a final interview simulation', href: '/ai-suite' },
        { label: 'Request alumni references', href: '/network' },
      ],
    },
  ],
};

/**
 * Return the 4-stage career path for a faculty, falling back to the generic
 * default path when the faculty is unknown or has no bespoke roadmap.
 */
export function careerPathFor(facultyId) {
  return CAREER_PATHS[facultyId] ?? CAREER_PATHS.default;
}

/**
 * Stable identifier for a single roadmap milestone, shared by the Career Path
 * UI and the persistence API so a given item always maps to the same DB row.
 * Derived from position (faculty + year + index) rather than the label text so
 * copy edits don't orphan a student's completion history.
 */
export function milestoneId(facultyId, year, index) {
  return `${facultyId}:${year}:${index}`;
}

/**
 * Look up a milestone by its derived id, returning its stage/label context or
 * null when the id doesn't resolve (e.g. a stale id after a roadmap change).
 */
export function findMilestone(facultyId, id) {
  const stages = careerPathFor(facultyId);
  for (const stage of stages) {
    for (let index = 0; index < stage.items.length; index += 1) {
      if (milestoneId(facultyId, stage.year, index) === id) {
        return { stage, year: stage.year, index, item: stage.items[index] };
      }
    }
  }
  return null;
}
