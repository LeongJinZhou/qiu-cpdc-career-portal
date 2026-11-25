// Self-assessment data as the API sends it (api/src/Assessment).

export type AssessmentStatus = 'draft' | 'published' | 'archived';

export interface Result {
  assessment_id: number;
  title: string;
  score: number;
  max_score: number;
  percent: number;
  band: string | null;
  taken_at?: string;
}

export interface Available {
  id: number;
  title: string;
  description: string;
  question_count: number;
  latest: Result | null;
}

export interface TakeQuestion {
  id: number;
  prompt: string;
  options: { id: number; label: string }[];
}

export interface Taking {
  id: number;
  title: string;
  description: string;
  questions: TakeQuestion[];
}

export interface Band {
  min_percent: number;
  label: string;
}

export interface EditQuestion {
  id?: number;
  prompt: string;
  options: { id?: number; label: string; points: number }[];
}

export interface Managed {
  id: number;
  title: string;
  description: string;
  status: AssessmentStatus;
  bands: Band[];
  questions: EditQuestion[];
  locked: boolean;
  updated_at: string;
}

export interface ManagedRow {
  id: number;
  title: string;
  status: AssessmentStatus;
  updated_at: string;
  question_count: number;
  attempt_count: number;
  people_count: number;
  average_percent: number | null;
}

export const STATUS_LABEL: Record<AssessmentStatus, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' };
export const STATUS_BADGE: Record<AssessmentStatus, string> = { draft: 'badge', published: 'badge badge-ok', archived: 'badge badge-warn' };

/** What the editor sends: ids and the locked flag are not part of the saved shape. */
export function toSaveBody(a: Pick<Managed, 'title' | 'description' | 'bands' | 'questions'>) {
  return {
    title: a.title,
    description: a.description,
    bands: a.bands.map((b) => ({ min_percent: b.min_percent, label: b.label })),
    questions: a.questions.map((q) => ({ prompt: q.prompt, options: q.options.map((o) => ({ label: o.label, points: o.points })) })),
  };
}

/** The first problem the server would refuse, in the editor's words; null when it can be saved. */
export function editorProblem(a: Pick<Managed, 'title' | 'bands' | 'questions'>): string | null {
  if (a.title.trim().length < 3) return 'Give it a title.';
  if (!a.bands.some((b) => b.min_percent === 0)) return 'One result band must start at 0%.';
  if (new Set(a.bands.map((b) => b.min_percent)).size !== a.bands.length) return 'Two result bands start at the same score.';
  if (a.bands.some((b) => !b.label.trim())) return 'Every result band needs a name.';
  if (a.questions.length === 0) return 'Add at least one question.';
  for (const [i, q] of a.questions.entries()) {
    if (q.prompt.trim().length < 3) return `Question ${i + 1} needs its text.`;
    if (q.options.length < 2) return `Question ${i + 1} needs at least two answers.`;
    if (q.options.some((o) => !o.label.trim())) return `Every answer of question ${i + 1} needs its text.`;
  }
  return null;
}
