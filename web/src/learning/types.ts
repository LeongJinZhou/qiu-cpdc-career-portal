// Learning records (courses and certificates) as the slice 2b API returns them.

export type LearningStatus = 'submitted' | 'verified' | 'rejected';

export const LEARNING_LABEL: Record<LearningStatus, string> = {
  submitted: 'Waiting for CPDC',
  verified: 'Verified',
  rejected: 'Not accepted',
};

export const LEARNING_TONE: Record<LearningStatus, string> = {
  submitted: 'badge',
  verified: 'badge badge-ok',
  rejected: 'badge badge-red',
};

export interface LearningRecord {
  id: number;
  kind: 'course' | 'certificate';
  name: string;
  provider: string;
  completed_on: string;
  link_url: string | null;
  proof_name: string | null;
  has_proof: boolean;
  status: LearningStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ReviewRecord extends LearningRecord {
  user_id: number;
  display_name: string;
  picture_url: string | null;
  matric_no: string | null;
  linkedin_url: string | null;
}
