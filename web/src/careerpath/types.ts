// Career paths as GET /api/career-paths returns them.

export interface PathStep {
  id: number;
  title: string;
  detail: string | null;
  done: boolean;
}

export interface CareerPath {
  id: number;
  programme: string;
  title: string;
  summary: string | null;
  skills: { name: string; have: boolean }[];
  steps: PathStep[];
  step_count: number;
  done_count: number;
}

export interface Overview {
  programmes: string[];
  programme: string | null;
  my_programme: string | null;
  paths: CareerPath[];
}

/** What CPDC sends (POST /api/career-paths, PUT /api/career-paths/{id}). */
export interface PathDraft {
  programme: string;
  title: string;
  summary: string;
  skills: string[];
  steps: { id?: number; title: string; detail: string }[];
}

export function draftOf(path: CareerPath | null, programme: string): PathDraft {
  return path
    ? {
        programme: path.programme,
        title: path.title,
        summary: path.summary ?? '',
        skills: path.skills.map((s) => s.name),
        steps: path.steps.map((s) => ({ id: s.id, title: s.title, detail: s.detail ?? '' })),
      }
    : { programme, title: '', summary: '', skills: [], steps: [{ title: '', detail: '' }] };
}

/** The first problem the server would refuse, in plain words, or null. */
export function pathProblem(d: PathDraft): string | null {
  if (!d.programme.trim()) return 'Add the programme.';
  if (!d.title.trim()) return 'Add the target role.';
  if (d.steps.some((s) => !s.title.trim())) return 'Every step needs a title.';
  return null;
}
