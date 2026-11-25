// The CV as GET /api/cv and PUT /api/cv carry it: profile data (read only here) plus what the CV adds.
import type { Job, School } from '../profile/types';

export interface CvItem {
  heading: string;
  sub: string;
  period: string;
  detail: string;
}

export interface CvSection {
  title: string;
  items: CvItem[];
}

export interface CvContent {
  contact: { email: string; phone: string; location: string; website: string };
  headline: string;
  summary: string;
  hidden_experience: number[];
  hidden_education: number[];
  show_skills: boolean;
  sections: CvSection[];
}

export interface CvProfile {
  display_name: string;
  email: string | null;
  personal_email: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  faculty: string | null;
  programme: string | null;
  graduation_year: number | null;
  experience: (Job & { id: number })[];
  education: (School & { id: number })[];
  skills: string[];
}

export interface CvResponse {
  profile: CvProfile;
  cv: CvContent;
  saved_at: string | null;
}

/** Section ideas offered with one click; the person can name their own. */
export const SECTION_IDEAS = ['Projects', 'Certifications', 'Awards', 'Leadership and activities', 'Languages', 'Volunteering'];

export const blankItem: CvItem = { heading: '', sub: '', period: '', detail: '' };

/** The first problem the server would refuse, in plain words, or null. */
export function cvProblem(cv: CvContent): string | null {
  if (cv.contact.website && !/^https:\/\/\S+$/.test(cv.contact.website)) return 'The website must start with https://.';
  if (cv.contact.phone && !/^[0-9+() -]*$/.test(cv.contact.phone)) return 'The phone number may only have digits, spaces, +, - and brackets.';
  if (cv.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cv.contact.email)) return 'The email does not look right.';
  for (const section of cv.sections) {
    if (!section.title.trim()) return 'Every extra section needs a title.';
    if (section.items.some((item) => !item.heading.trim())) return `Every entry in "${section.title}" needs a heading.`;
  }
  return null;
}
