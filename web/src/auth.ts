// The signed-in person (GET /api/me) and sign-out.
import { ApiFailure, apiGet, apiWrite } from './api';

export type Role = 'superadmin' | 'admin' | 'staff' | 'student' | 'alumni' | 'pending';

export interface Me {
  user: {
    id: number;
    email: string | null;
    display_name: string;
    picture_url: string | null;
    role: Role;
    matric_no: string | null;
    employee_id: string | null;
    department: string | null;
    job_title: string | null;
    onboarded_at: string | null;
    linkedin_url: string | null;
    github_linked: boolean;
    github_url: string | null;
  };
  signed_in_with: 'google' | 'linkedin';
  permissions: string[];
  csrf_token: string;
  onboarding: {
    required: boolean;
    linkedin_linked: boolean;
    profile_url: string | null;
    follow_confirmed: boolean;
    consent_given: boolean;
  };
  job_confirmation_due: boolean;
  features: { linkedin: boolean; github: boolean };
  qiu_linkedin_url: string;
}

/** The signed-in person, or null when nobody is signed in. */
export async function fetchMe(): Promise<Me | null> {
  try {
    return await apiGet<Me>('/api/me');
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) return null;
    throw error;
  }
}

export function signOut(csrfToken: string): Promise<void> {
  return apiWrite('POST', '/api/auth/logout', undefined, csrfToken);
}

export function can(me: Me, permission: string): boolean {
  return me.permissions.includes(permission);
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: 'Super admin',
  admin: 'CPDC admin',
  staff: 'Staff',
  student: 'Student',
  alumni: 'Alumni',
  pending: 'Waiting',
};
