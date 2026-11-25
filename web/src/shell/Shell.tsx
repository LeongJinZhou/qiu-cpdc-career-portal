// The signed-in frame: brand, navigation by permission, the person and sign-out.
import { ClipboardList, GraduationCap, LogOut, ScrollText, UserRound, Users, type LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { can, ROLE_LABEL, type Me } from '../auth';
import { Avatar } from '../ui/parts';
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
