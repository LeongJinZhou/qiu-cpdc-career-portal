// Shapes of the alumni network and mentoring API (api/src/Network).

export interface DirectoryEntry {
  id: number;
  display_name: string;
  linkedin_url: string | null;
  title: string | null;
  company: string | null;
  faculty: string | null;
  graduation_year: number | null;
  mentor: { topics: string[]; slots_left: number } | null;
}

export interface Choices {
  visible: boolean;
  show_title: boolean;
  show_company: boolean;
  show_faculty: boolean;
  show_year: boolean;
}

export interface OwnEntry {
  choices: Choices;
  fields: {
    display_name: string;
    linkedin_url: string | null;
    title: string | null;
    company: string | null;
    faculty: string | null;
    graduation_year: number | null;
  };
  mentoring: { active: boolean; topics: string[]; slots_per_month: number } | null;
}

export type RequestStatus = 'waiting' | 'accepted' | 'declined' | 'withdrawn';

export interface MentorRequest {
  id: number;
  status: RequestStatus;
  message: string;
  reply: string | null;
  created_at: string;
  decided_at: string | null;
  person: { id: number; display_name: string; linkedin_url: string | null; faculty: string | null; email: string | null };
}

export const STATUS_TEXT: Record<RequestStatus, string> = {
  waiting: 'Waiting',
  accepted: 'Matched',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 600;
