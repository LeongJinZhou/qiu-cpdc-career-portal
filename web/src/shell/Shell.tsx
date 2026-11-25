// The signed-in frame: brand, navigation by permission, the person and sign-out.
import { ClipboardList, GraduationCap, LogOut, ScrollText, UserRound, Users, type LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { BadgeCheck, BookOpenCheck, BriefcaseBusiness, Building2, Gauge } from 'lucide-react'; // slice 2b
// slice 3a (workshops, CV, career path)
import { CalendarDays, FileText, Route } from 'lucide-react';
// slice 3b icons (BookOpenCheck comes from the slice 2b line)
import { HandHelping, MessagesSquare, Network } from 'lucide-react';
import { can, ROLE_LABEL, type Me } from '../auth';
import { Avatar } from '../ui/parts';
import { NAV_2A } from '../logbook/nav2a'; // slice 2a
import './shell.css';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission: string;
}

export const NAV: NavItem[] = [
  { path: '/profile', label: 'My profile', icon: UserRound, permission: 'profile.own' },
  { path: '/alumni', label: 'Alumni tracker', icon: GraduationCap, permission: 'alumni.track' },
  { path: '/people', label: 'People', icon: Users, permission: 'people.view' },
  { path: '/registrations', label: 'Graduate sign-ups', icon: ClipboardList, permission: 'registrations.decide' },
  { path: '/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.view' },
  ...NAV_2A, // slice 2a
  // --- slice 2b (start) ---
  { path: '/jobs', label: 'Jobs', icon: BriefcaseBusiness, permission: 'jobs.browse' },
  { path: '/skills', label: 'Skills', icon: Gauge, permission: 'skills.own' },
  { path: '/learning', label: 'Learning', icon: BookOpenCheck, permission: 'learning.own' },
  { path: '/employers', label: 'Employers', icon: Building2, permission: 'jobs.manage' },
  { path: '/learning-checks', label: 'Learning checks', icon: BadgeCheck, permission: 'learning.verify' },
  // --- slice 2b (end) ---
  // slice 3a (workshops, CV, career path)
  { path: '/workshops', label: 'Workshops', icon: CalendarDays, permission: 'workshops.view' },
  { path: '/cv', label: 'CV builder', icon: FileText, permission: 'cv.own' },
  { path: '/career-path', label: 'Career path', icon: Route, permission: 'careerpath.view' },
  // --- slice 3b: alumni network, mentoring, interview practice (begin) ---
  { path: '/network', label: 'Alumni network', icon: Network, permission: 'network.view' },
  { path: '/interview', label: 'Interview practice', icon: MessagesSquare, permission: 'interview.practice' },
  { path: '/mentoring', label: 'Mentoring activity', icon: HandHelping, permission: 'mentoring.activity' },
  { path: '/questions', label: 'Interview questions', icon: BookOpenCheck, permission: 'interview.bank' },
  // --- slice 3b (end) ---
];

export function Shell({
  me,
  path,
  go,
  onSignOut,
  children,
}: {
  me: Me;
  path: string;
  go: (to: string) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const items = NAV.filter((item) => can(me, item.permission));
  const follow = (to: string) => (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    go(to);
  };
  return (
    <>
      <header className="shell-top">
        <div className="shell-bar">
          <a className="shell-brand" href="/profile" onClick={follow('/profile')}>
            <img src="/brand/qiu-mark-dark.png" alt="" />
            <span>Career Portal</span>
          </a>
          <nav className="shell-nav" aria-label="Main">
            {items.map(({ path: to, label, icon: Icon }) => (
              <a key={to} href={to} onClick={follow(to)} aria-current={path.startsWith(to) ? 'page' : undefined}>
                <Icon size={16} aria-hidden="true" />
                {label}
              </a>
            ))}
          </nav>
          <div className="shell-user">
            <div className="shell-user-text">
              <strong>{me.user.display_name}</strong>
              <span>{ROLE_LABEL[me.user.role]}</span>
            </div>
            <Avatar name={me.user.display_name} src={me.user.picture_url} size={34} />
            <button type="button" className="btn btn-quiet btn-small" onClick={onSignOut} aria-label="Sign out" title="Sign out">
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <main className="shell-main">{children}</main>
    </>
  );
}

export function PageHead({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
