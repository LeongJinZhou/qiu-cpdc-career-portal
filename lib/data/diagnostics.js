// Skills Diagnostic Tests (Blueprint Module 8).
//
// Short, per-faculty assessments that produce a strengths/gaps profile. The
// result maps each weak skill category to a `recommendTag`, which the
// Diagnostics UI matches against workshop tags to surface "here are 3
// workshops for your gap" — the feedback loop the blueprint calls for.
//
// Kept as fixtures (like the rest of the prototype's content) so the module is
// fully demonstrable without a question bank service. The shape is intentionally
// close to what an API would return, so swapping in a real source is a data
// change, not a UI rewrite.

const DEFAULT_DIAGNOSTIC = {
  id: 'diag-default',
  title: 'Career Readiness Diagnostic',
  minutes: 6,
  passMark: 0.6,
  questions: [
    {
      id: 'q1',
      category: 'Communication',
      recommendTag: 'Communication',
      prompt: 'A recruiter asks "Tell me about yourself." What is the strongest opening?',
      options: [
        'A chronological list of every module you have taken.',
        'A 30-second summary linking your strengths to the role.',
        'A question about the salary and benefits.',
        'A detailed account of your hobbies.',
      ],
      answer: 1,
    },
    {
      id: 'q2',
      category: 'Problem Solving',
      recommendTag: 'Critical Thinking',
      prompt: 'You are stuck on a task with an approaching deadline. The best first step is to:',
      options: [
        'Keep trying the same approach until it works.',
        'Break the problem down and identify the smallest blocking step.',
        'Wait for someone to notice and help.',
        'Move to a different task and hope it resolves itself.',
      ],
      answer: 1,
    },
    {
      id: 'q3',
      category: 'Digital Literacy',
      recommendTag: 'Productivity',
      prompt: 'Which practice best protects your work on a shared project?',
      options: [
        'Saving one copy on your laptop only.',
        'Emailing the file to yourself each night.',
        'Using version control / cloud sync with a clear history.',
        'Printing a copy as a backup.',
      ],
      answer: 2,
    },
    {
      id: 'q4',
      category: 'Teamwork',
      recommendTag: 'Leadership',
      prompt: 'A teammate misses a shared deadline. The most professional response is to:',
      options: [
        'Report them immediately to the supervisor.',
        'Do their part silently and say nothing.',
        'Ask what happened and agree a recovery plan together.',
        'Refuse to work with them again.',
      ],
      answer: 2,
    },
    {
      id: 'q5',
      category: 'Career Planning',
      recommendTag: 'Career Planning',
      prompt: 'The most useful thing to do in your first year, career-wise, is to:',
      options: [
        'Nothing — careers only matter in the final year.',
        'Build your profile, explore workshops, and take a skills baseline.',
        'Apply for senior roles straight away.',
        'Wait for the university to assign you a job.',
      ],
      answer: 1,
    },
  ],
};

const FACULTY_DIAGNOSTICS = {
  computing_engineering: {
    id: 'diag-fce',
    title: 'Computing & Engineering Skills Diagnostic',
    minutes: 8,
    passMark: 0.6,
    questions: [
      {
        id: 'q1',
        category: 'Logical Reasoning',
        recommendTag: 'Critical Thinking',
        prompt: 'What is the time complexity of a binary search on a sorted array of n items?',
        options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
        answer: 1,
      },
      {
        id: 'q2',
        category: 'Data Structures',
        recommendTag: 'Deep Learning',
        prompt: 'Which structure gives average O(1) lookup by key?',
        options: ['Linked list', 'Array', 'Hash map', 'Binary tree'],
        answer: 2,
      },
      {
        id: 'q3',
        category: 'Version Control',
        recommendTag: 'Productivity',
        prompt: 'You committed a bug to main. The safest way to undo it publicly is to:',
        options: [
          'Delete the repository.',
          'Force-push over history so nobody notices.',
          'Add a revert commit that undoes the change.',
          'Edit the file on the server directly.',
        ],
        answer: 2,
      },
      {
        id: 'q4',
        category: 'Communication',
        recommendTag: 'Communication',
        prompt: 'In a code review, the most useful comment is one that:',
        options: [
          'Says "this is wrong".',
          'Explains the issue and suggests a concrete improvement.',
          'Rewrites everything without explanation.',
          'Approves without reading.',
        ],
        answer: 1,
      },
      {
        id: 'q5',
        category: 'System Design',
        recommendTag: 'Artificial Intelligence',
        prompt: 'A service is slow under load. The best first diagnostic is to:',
        options: [
          'Buy a bigger server immediately.',
          'Measure where time is spent before changing anything.',
          'Rewrite it in another language.',
          'Add more features.',
        ],
        answer: 1,
      },
    ],
  },
  business: {
    id: 'diag-fob',
    title: 'Business & Finance Skills Diagnostic',
    minutes: 8,
    passMark: 0.6,
    questions: [
      {
        id: 'q1',
        category: 'Financial Literacy',
        recommendTag: 'Financial Modeling',
        prompt: 'Enterprise value in a DCF is most directly driven by:',
        options: [
          'The company logo.',
          'Projected free cash flows discounted to present value.',
          'The number of employees.',
          'Last year’s marketing spend.',
        ],
        answer: 1,
      },
      {
        id: 'q2',
        category: 'Communication',
        recommendTag: 'Communication',
        prompt: 'When pitching to executives, you should lead with:',
        options: [
          'Every assumption in your model.',
          'The recommendation and the expected impact.',
          'An apology for taking their time.',
          'A long history of the industry.',
        ],
        answer: 1,
      },
      {
        id: 'q3',
        category: 'Analytics',
        recommendTag: 'Critical Thinking',
        prompt: 'A KPI improved but revenue fell. The right move is to:',
        options: [
          'Celebrate the KPI.',
          'Investigate whether the KPI actually drives the outcome.',
          'Remove the KPI.',
          'Ignore the revenue.',
        ],
        answer: 1,
      },
      {
        id: 'q4',
        category: 'Leadership',
        recommendTag: 'Leadership',
        prompt: 'Your case-competition team disagrees on strategy. As lead you should:',
        options: [
          'Pick your own idea and move on.',
          'Facilitate a quick structured decision using agreed criteria.',
          'Let the loudest voice win.',
          'Postpone until after the deadline.',
        ],
        answer: 1,
      },
      {
        id: 'q5',
        category: 'Career Planning',
        recommendTag: 'Career Planning',
        prompt: 'To break into investment banking, the highest-leverage early step is to:',
        options: [
          'Wait to be discovered.',
          'Network with alumni and build a modeling portfolio.',
          'Only focus on grades.',
          'Avoid case competitions.',
        ],
        answer: 1,
      },
    ],
  },
  medicine: {
    id: 'diag-fom',
    title: 'Medicine Clinical Readiness Diagnostic',
    minutes: 8,
    passMark: 0.6,
    questions: [
      {
        id: 'q1',
        category: 'Clinical Reasoning',
        recommendTag: 'Clinical Skills',
        prompt: 'A patient presents with acute chest pain. Your first priority is to:',
        options: [
          'Order every possible test at once.',
          'Assess airway, breathing, circulation and take a focused history.',
          'Reassure and send home.',
          'Consult the internet.',
        ],
        answer: 1,
      },
      {
        id: 'q2',
        category: 'Communication',
        recommendTag: 'Communication',
        prompt: 'Breaking difficult news to a patient is best done by:',
        options: [
          'Using dense medical jargon.',
          'A clear, empathetic, structured conversation.',
          'Delegating it to a poster.',
          'Avoiding eye contact.',
        ],
        answer: 1,
      },
      {
        id: 'q3',
        category: 'Professionalism',
        recommendTag: 'Leadership',
        prompt: 'You notice a colleague breach a hygiene protocol. You should:',
        options: [
          'Ignore it.',
          'Raise it constructively and follow the safety process.',
          'Post about it publicly.',
          'Copy the behaviour.',
        ],
        answer: 1,
      },
      {
        id: 'q4',
        category: 'Evidence',
        recommendTag: 'Critical Thinking',
        prompt: 'A new treatment claim is based on one small study. You should:',
        options: [
          'Adopt it immediately.',
          'Appraise the evidence quality before changing practice.',
          'Reject all new treatments.',
          'Ask social media.',
        ],
        answer: 1,
      },
      {
        id: 'q5',
        category: 'Career Planning',
        recommendTag: 'Career Planning',
        prompt: 'To prepare for housemanship, the most useful log to keep is:',
        options: [
          'Nothing — it is assigned automatically.',
          'A verified record of clinical hours and competencies.',
          'A list of cafeterias.',
          'Only exam scores.',
        ],
        answer: 1,
      },
    ],
  },
};

/** The diagnostic for a faculty, falling back to the general readiness test. */
export function diagnosticFor(facultyId) {
  return FACULTY_DIAGNOSTICS[facultyId] ?? DEFAULT_DIAGNOSTIC;
}

/** Every built-in diagnostic, in the order a student sees them offered. */
export function builtInDiagnostics() {
  return [DEFAULT_DIAGNOSTIC, ...Object.values(FACULTY_DIAGNOSTICS)];
}

/**
 * Look a built-in diagnostic up by its *test* id (`diag-fce`), not its faculty
 * id. Returns null for anything unknown — callers must not fall back to the
 * default test, because scoring an attempt against a different question bank
 * silently produces the wrong result.
 */
export function diagnosticById(testId) {
  return builtInDiagnostics().find((test) => test.id === testId) ?? null;
}

// Staff-authored assessments (uploaded and reviewed by a lecturer or CPDC
// officer) are addressed as `assessment:<id>` so one testId namespace covers
// both sources — a DiagnosticResult row records which test was taken either way.
export const ASSESSMENT_TEST_PREFIX = 'assessment:';

export function assessmentTestId(assessmentId) {
  return `${ASSESSMENT_TEST_PREFIX}${assessmentId}`;
}

export function assessmentIdFromTestId(testId) {
  return typeof testId === 'string' && testId.startsWith(ASSESSMENT_TEST_PREFIX)
    ? testId.slice(ASSESSMENT_TEST_PREFIX.length)
    : null;
}

/**
 * Convert a stored Assessment (+ its question rows) into exactly the test shape
 * `scoreDiagnostic` consumes, so an imported assessment drives the same score,
 * radar and gap analysis as a built-in one with no special-casing downstream.
 */
export function assessmentToTest(assessment) {
  const questions = [...(assessment?.questions ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((question, index) => {
      const category = String(question.category ?? '').trim() || 'General';
      const correct = Array.isArray(question.correctOptionIndexes)
        ? question.correctOptionIndexes[0]
        : question.answer;
      return {
        id: `q${index + 1}`,
        category,
        recommendTag: category,
        prompt: question.prompt,
        options: question.options ?? [],
        answer: Number.isInteger(correct) ? correct : 0,
      };
    });

  return {
    id: assessmentTestId(assessment.id),
    title: assessment.title,
    minutes: assessment.timeLimitMinutes ?? Math.max(2, Math.ceil(questions.length * 1.5)),
    passMark: typeof assessment.passMark === 'number' ? assessment.passMark : 0.6,
    instructions: assessment.instructions ?? null,
    imported: true,
    questions,
  };
}

/**
 * Score a set of answers (index per question id) into an overall result plus a
 * per-category breakdown, and collect the recommend tags for weak categories.
 */
export function scoreDiagnostic(test, answers) {
  const categories = {};
  let correct = 0;

  for (const q of test.questions) {
    const chosen = answers[q.id];
    const isRight = chosen === q.answer;
    if (isRight) correct += 1;

    const cat = (categories[q.category] ??= { total: 0, correct: 0, recommendTag: q.recommendTag });
    cat.total += 1;
    if (isRight) cat.correct += 1;
  }

  const breakdown = Object.entries(categories).map(([name, c]) => ({
    name,
    ratio: c.correct / c.total,
    recommendTag: c.recommendTag,
    strong: c.correct / c.total >= 0.5,
  }));

  const ratio = correct / test.questions.length;
  const gapTags = breakdown.filter((c) => !c.strong).map((c) => c.recommendTag);

  return {
    correct,
    total: test.questions.length,
    ratio,
    passed: ratio >= test.passMark,
    breakdown,
    gapTags,
  };
}
