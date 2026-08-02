// Shared shape helpers for the assessment routes. Kept out of route.js because
// a Next route module may only export HTTP handlers and route config.

export const assessmentInclude = {
  faculty: { select: { id: true, name: true } },
  programme: { select: { id: true, name: true } },
  questions: { orderBy: { order: 'asc' } },
};

/**
 * Serialize an Assessment for the client. `includeAnswers` is false for the
 * student view: the correct option never leaves the server while a student is
 * sitting the test, exactly as the built-in diagnostics work.
 */
export function serializeAssessment(record, { includeAnswers = false } = {}) {
  return {
    id: record.id,
    title: record.title,
    instructions: record.instructions,
    status: record.status,
    passMark: record.passMark,
    timeLimitMinutes: record.timeLimitMinutes,
    sourceFileName: record.sourceFileName,
    sourceFileType: record.sourceFileType,
    facultyId: record.facultyId,
    programmeId: record.programmeId,
    facultyName: record.faculty?.name ?? null,
    programmeName: record.programme?.name ?? null,
    questionCount: record.questions?.length ?? 0,
    questions: (record.questions ?? []).map((question) => ({
      id: question.id,
      order: question.order,
      prompt: question.prompt,
      options: question.options,
      category: question.category,
      ...(includeAnswers ? { answer: question.correctOptionIndexes?.[0] ?? null } : {}),
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
  };
}

/** The DB rows for a reviewed question list, in review order. */
export function questionCreateData(questions) {
  return questions.map((question, index) => ({
    order: index + 1,
    prompt: question.prompt,
    options: question.options,
    correctOptionIndexes: [question.answer],
    category: question.category,
  }));
}
