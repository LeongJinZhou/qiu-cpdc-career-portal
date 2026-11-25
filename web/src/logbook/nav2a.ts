// Navigation of slice 2a (logbook, showcase, assessments), added to the shell's NAV by permission.
import { BookOpen, Briefcase, ClipboardCheck, Presentation, Sparkles, type LucideIcon } from 'lucide-react';

export const NAV_2A: { path: string; label: string; icon: LucideIcon; permission: string }[] = [
  { path: '/logbook', label: 'Logbook', icon: BookOpen, permission: 'logbook.own' },
  { path: '/my-project', label: 'My project', icon: Presentation, permission: 'showcase.own' },
  { path: '/assessments', label: 'Assessments', icon: ClipboardCheck, permission: 'assessment.take' },
  { path: '/internships', label: 'Internships', icon: Briefcase, permission: 'logbook.track' },
  { path: '/showcase', label: 'Talent feed', icon: Sparkles, permission: 'showcase.browse' },
  { path: '/assessment-builder', label: 'Assessments', icon: ClipboardCheck, permission: 'assessment.manage' },
];

export const TITLES_2A: Record<string, string> = {
  '/logbook': 'Internship logbook',
  '/my-project': 'My project',
  '/assessments': 'Self-assessments',
  '/internships': 'Internships',
  '/showcase': 'Talent feed',
  '/assessment-builder': 'Assessments',
  '/review': 'Logbook review',
};
