// The career profile as GET /api/profile and GET /api/people/{id} return it.

export type EmploymentStatus = 'employed' | 'self_employed' | 'further_study' | 'seeking' | 'not_seeking' | 'unknown';

export const STATUS_LABEL: Record<EmploymentStatus, string> = {
  employed: 'Employed',
  self_employed: 'Self-employed',
  further_study: 'Further study',
  seeking: 'Looking for work',
  not_seeking: 'Not looking for work',
  unknown: 'Not known',
};

export interface Job {
  title: string;
  company: string;
  location: string | null;
  start: string | null; // YYYY-MM
  end: string | null; // YYYY-MM, null = current
  description: string | null;
}

export interface School {
  school: string;
  degree: string | null;
  field: string | null;
  start_year: number | null;
  end_year: number | null;
}

export interface Profile {
  id: number;
  display_name: string;
  email: string | null;
  picture_url: string | null;
  role: string;
  matric_no: string | null;
  employee_id: string | null;
  department: string | null;
  job_title: string | null;
  alumni_since: string | null;
  last_sign_in_at: string | null;
  linkedin_url: string | null;
  linkedin_name: string | null;
  linkedin_linked: boolean;
  github_url: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
  industry: string | null;
  personal_email: string | null;
  faculty: string | null;
  programme: string | null;
  graduation_year: number | null;
  employment_status: EmploymentStatus;
  current_title: string | null;
  current_company: string | null;
  current_since: string | null; // YYYY-MM-DD
  job_confirmed_at: string | null;
  last_pdf_import_at: string | null;
  experience: (Job & { id: number; source: 'pdf' | 'manual' })[];
  education: (School & { id: number; source: 'pdf' | 'manual' })[];
  skills: string[];
}

/** What POST /api/profile/linkedin-pdf found in a LinkedIn PDF (nothing saved yet). */
export interface PdfPreview {
  name: string;
  headline: string;
  location: string;
  about: string;
  profile_url: string | null;
  skills: string[];
  experience: Job[];
  education: { school: string; degree: string | null; start_year: number | null; end_year: number | null }[];
}

/** "2025-06" as "Jun 2025"; null as "Present" when it is an end date. */
export function monthLabel(value: string | null, isEnd = false): string {
  if (!value) return isEnd ? 'Present' : '';
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-MY', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function dateLabel(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
}
