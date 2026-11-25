// FYP showcase data as the API sends it (api/src/Showcase).

export interface Project {
  id: number;
  title: string;
  summary: string;
  tech: string[];
  project_year: number;
  faculty: string | null;
  repo_url: string | null;
  demo_url: string | null;
  image_url: string | null;
  published: boolean;
  published_at: string | null;
  updated_at: string;
  student: { id: number; display_name: string; picture_url: string | null; linkedin_url: string | null };
}

export interface Filters {
  tech: { tech: string; count: number }[];
  faculties: string[];
  years: number[];
}

/** The server's limit (setting showcase_image_max_bytes); checked here only to save a wasted upload. */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Tags from a comma-separated field: trimmed, no empties, no case-insensitive repeats. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const tag = raw.trim().replace(/\s+/g, ' ');
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag.slice(0, 40));
    }
  }
  return out.slice(0, 12);
}
