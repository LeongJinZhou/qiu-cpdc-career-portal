// Shapes of the interview practice API (api/src/Interview).

export interface Feedback {
  score: number;
  summary: string;
  strengths: string[];
  improve: string[];
}

export interface Item {
  id: number;
  position: number;
  question: string;
  tip: string | null;
  answer: string | null;
  feedback: Feedback | null;
  answered_at: string | null;
}

export interface Session {
  id: number;
  field: string;
  started_at: string;
  items: Item[];
}

export interface SessionSummary {
  id: number;
  field: string;
  started_at: string;
  questions: number;
  answered: number;
  average: number | null;
}

export interface Status {
  ready: boolean;
  used_today: number;
  daily_limit: number;
  max_chars: number;
  min_chars: number;
  fields: { field: string; questions: number }[];
}

export interface Question {
  id: number;
  field: string;
  question: string;
  tip: string | null;
  active: boolean;
  updated_at: string;
}
