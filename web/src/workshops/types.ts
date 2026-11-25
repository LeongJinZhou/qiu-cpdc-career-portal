// Workshops as GET /api/workshops returns them. Times: starts_at/ends_at are UTC (ISO), *_local Malaysia time.

export type Audience = 'student' | 'staff' | 'alumni';

export const AUDIENCE_LABEL: Record<Audience, string> = { student: 'Students', staff: 'Staff', alumni: 'Alumni' };

export interface Workshop {
  id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  starts_local: string;
  ends_local: string;
  mode: 'in_person' | 'online';
  venue: string | null;
  online_url: string | null;
  capacity: number;
  audience: Audience[];
  status: 'published' | 'cancelled';
  going_count: number;
  waitlist_count: number;
  spots_left: number;
  started: boolean;
  ended: boolean;
  in_audience: boolean;
  my_rsvp: { status: 'going' | 'waitlist'; checked_in: boolean; waitlist_position: number | null } | null;
  checkin_code?: string;
  checked_in_count?: number;
}

export interface Attendee {
  user_id: number;
  display_name: string;
  email: string | null;
  role: string;
  matric_no: string | null;
  employee_id: string | null;
  department: string | null;
  picture_url: string | null;
  linkedin_url: string | null;
  status: 'going' | 'waitlist';
  queued_at: string;
  checked_in_at: string | null;
  checkin_method: 'code' | 'list' | null;
}

/** What the form sends (POST /api/workshops, PUT /api/workshops/{id}). */
export interface WorkshopDraft {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  mode: 'in_person' | 'online';
  venue: string;
  online_url: string;
  capacity: number;
  audience: Audience[];
}

const ZONE = 'Asia/Kuala_Lumpur';

/** "Thu, 16 Jan 2027" in Malaysia time. */
export function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: ZONE });
}

/** "10:00 am" in Malaysia time. */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', timeZone: ZONE });
}

/** Day of month and short month for the date block of a card. */
export function dateParts(iso: string): { day: string; month: string } {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString('en-MY', { day: 'numeric', timeZone: ZONE }),
    month: date.toLocaleDateString('en-MY', { month: 'short', timeZone: ZONE }),
  };
}
