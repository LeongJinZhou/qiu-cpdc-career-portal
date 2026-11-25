// Skills self-rating and gap view as the slice 2b API returns them.

export interface SkillArea {
  id: number;
  name: string;
  description: string;
}

export interface Assessment {
  id: number;
  created_at: string;
  ratings: Record<string, number>; // area id => level 1-5
}

export interface GapRow {
  area_id: number;
  name: string;
  required: number;
  mine: number | null;
  gap: number;
}

export interface GapView {
  job: { id: number; title: string; employer_name: string };
  rated_at: string | null;
  rows: GapRow[];
  met: number;
  total: number;
}
