'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, LogOut, Menu, Sparkles, X } from 'lucide-react';
import { shouldRenderAuthenticatedPortalChrome, fetchXpSummary } from '@/lib/api';
import { onXpUpdated } from '@/lib/xp-events';
import { FACULTIES } from '@/lib/data/facultyData';
import { homeFor, modulesFor, primaryModulesFor, ROLES } from '@/lib/modules';
import { tierFor, tierProgress } from '@/lib/xp';
import { usePortal } from './PortalProvider';
import QiuLogo from './QiuLogo';
import OnboardingTour from '@/components/OnboardingTour';
import DismissibleDialog from '@/components/ui/DismissibleDialog';
import { useSettings } from '@/lib/settings';
import Avatar from '@/components/ui/Avatar';
import NotificationBell from '@/components/notifications/NotificationBell';

/**
 * Portal chrome: sidebar on desktop, bottom tab bar on mobile.
 *
 * Built mobile-first. Students overwhelmingly open this on a phone between
 * classes, so the primary modules sit in a thumb-reachable bottom bar rather
 * than behind a hamburger.
 */
export default function PortalShell({ children }) {
  const pathname = usePathname();
  const {
    identity,
    identityLoading,
    currentRole,
    setCurrentRole,
    activeFaculty,
    setActiveFaculty,
    setActiveProgramme,
    student,
    demoMode,
  } = usePortal();
  const router = useRouter();
  const [settings] = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const showAuthenticatedChrome = shouldRenderAuthenticatedPortalChrome({ demoMode, identity });

  const modules = modulesFor(currentRole, activeFaculty.id, settings);
  const primary = primaryModulesFor(currentRole, activeFaculty.id, settings);
  const roleHome = homeFor(currentRole, activeFaculty.id, settings);
  const isStudent = currentRole === 'STUDENT';
  const roleLabel = ROLES.find((role) => role.id === currentRole)?.label ?? currentRole;
  const accessLabel = currentRole === 'EMPLOYER'
    ? 'Verified employer account'
    : currentRole === 'ALUMNI'
      ? 'Verified alumni access'
      : isStudent
        ? 'Verified student access'
        : `${roleLabel} operations access`;

  // The sidebar XP tile reads the real ledger total (and reacts to live awards)
  // so it can't drift from the dashboard's headline figure. Falls back to the
  // projection's xp only until the ledger responds.
  const [liveXp, setLiveXp] = useState(null);
  const refreshXp = useCallback(() => fetchXpSummary()
    .then((data) => {
      if (typeof data?.totalXp === 'number') setLiveXp(data.totalXp);
    })
    .catch(() => {}), []);

  useEffect(() => {
    if (!showAuthenticatedChrome || !isStudent) return undefined;
    let cancelled = false;
    refreshXp();
    // Awards invalidate the tile; the server remains authoritative for the
    // next total rather than trusting the event payload.
    const unsubscribe = onXpUpdated(() => {
      if (!cancelled) refreshXp();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [showAuthenticatedChrome, isStudent, refreshXp]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const xp = liveXp ?? student.xp ?? 0;
  const tier = tierFor(xp);
  const { next, progress } = tierProgress(xp);

  // Until the ledger answers, `student.xp` is only the fixture projection, and
  // showing it means the chrome renders a concrete but wrong total that then
  // jumps (3,450 -> 1,450). A number that corrects itself in front of the user
  // is worse than no number, so hold the figure back rather than guess it.
  const xpReady = liveXp !== null;

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  if (!identityLoading && !showAuthenticatedChrome) {
    return (
      <div className="min-h-screen bg-canvas text-[#1d1d1f]">
        <header className="sticky top-0 z-40 border-b border-black/10 bg-canvas/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3">
              <QiuLogo priority className="h-8 w-auto" />
            </Link>
          </div>
        </header>

        <main>
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-[#1d1d1f]">
      {/*
        Skip link (WCAG 2.4.1). Every route renders an 8-12 item sidebar before
        <main>, so without this a keyboard or screen-reader user re-traverses
        the whole navigation on every single page. Visually hidden until
        focused, then the first thing in the tab order.
      */}
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[14px] focus:bg-crimson focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/*
        ---------------- Side navigation ----------------

        Three layouts, not two, because a half-width desktop window is its own
        case. Previously anything under 1024px got phone chrome, which put a
        bottom tab bar across a docked desktop window — wrong affordance, and
        it wasted the horizontal room a split screen still has.

          < 768px   phone   — hamburger drawer + bottom tab bar
          768-1023  split   — persistent 72px icon rail, no bottom bar
          >= 1024px desktop — full 256px sidebar with labels

        The rail is the same <aside>, just narrowed: one nav tree keeps the
        active state and ordering identical across breakpoints.
      */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col border-r border-black/10 bg-surface md:flex lg:w-64">
        <div className="flex justify-center px-3 py-6 lg:justify-start lg:px-6">
          <Link href={roleHome} className="flex items-center gap-3" aria-label="QIU Career Hub home">
            {/* The 6.3:1 lockup cannot fit a 72px rail — the rail shows the mark. */}
            <QiuLogo variant="mark" priority className="h-7 w-auto lg:hidden" />
            <QiuLogo priority className="hidden h-8 w-auto lg:block" />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main">
          {modules.map((mod) => {
            const Icon = mod.icon;
            const active = isActive(mod.href);
            return (
              <Link
                key={mod.id}
                href={mod.href}
                aria-current={active ? 'page' : undefined}
                // The rail hides the label, so the accessible name and the
                // hover tooltip both have to come from the element itself.
                aria-label={mod.longLabel}
                title={mod.longLabel}
                className={`flex min-h-11 items-center justify-center gap-3 rounded-[14px] px-3 text-sm transition-colors lg:justify-start ${
                  active
                    ? 'bg-crimson font-semibold text-white'
                    : 'text-muted hover:bg-black/[0.03] hover:text-[#1d1d1f]'
                }`}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
                <span className="hidden truncate lg:inline">{mod.longLabel}</span>
              </Link>
            );
          })}
        </nav>

        {/* Student progress or role workspace summary */}
        {isStudent ? (
          <div className="m-3 surface p-2 lg:p-4">
            {/* Rail: the tier dot and XP alone; the full panel needs label room. */}
            <div className="flex flex-col items-center gap-1 lg:hidden">
              <Sparkles className="h-3.5 w-3.5 text-crimson" aria-hidden="true" />
              <span className="text-[10px] font-semibold tabular-nums">
                {xpReady ? xp.toLocaleString() : '—'}
              </span>
              {xpReady && (
                <span className="sr-only">
                  {xp.toLocaleString()} XP, {tier.name} tier
                </span>
              )}
            </div>

            <div className="hidden lg:block">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-crimson">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {xpReady ? tier.name : 'Career XP'}
                </span>
                <span className="tabular-nums font-semibold">
                  {xpReady ? `${xp.toLocaleString()} XP` : '—'}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 rounded-full bg-black/[0.06]" role="presentation">
                <div
                  className="h-full rounded-full bg-crimson transition-all duration-500"
                  style={{ width: xpReady ? `${Math.max(4, Math.round(progress * 100))}%` : '0%' }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {!xpReady
                  ? 'Loading your ledger…'
                  : next
                    ? `${(next.min - xp).toLocaleString()} XP to ${next.name}`
                    : 'Top tier reached'}
              </p>
            </div>
          </div>
        ) : (
          <div className="m-3 surface hidden p-4 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Workspace</p>
            <p className="mt-1 font-heading text-base font-semibold">{roleLabel}</p>
            <p className="mt-1 text-[11px] text-muted">{currentRole === 'FACULTY_COORDINATOR' ? `${activeFaculty.code} faculty scope` : accessLabel}</p>
          </div>
        )}

        <div className="px-3 pb-4">
          <Link
            href="/logout"
            className="flex min-h-11 items-center justify-center gap-3 rounded-[14px] px-3 text-sm text-muted hover:bg-black/[0.03] hover:text-[#1d1d1f] lg:justify-start"
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">Sign out</span>
          </Link>
        </div>
      </aside>

      {/* ---------------- Top bar ---------------- */}
      {/*
        Margin, not padding: the header is a full-bleed sticky bar, so left
        padding still let its translucent background paint over the sidebar —
        hiding the QIU mark at the top of the rail. Offsetting the box itself
        keeps the bar beside the nav instead of on top of it.
      */}
      <header className="sticky top-0 z-40 border-b border-black/10 bg-canvas/90 backdrop-blur-xl md:ml-[72px] lg:ml-64">
          <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 lg:px-8">
          {/* Mobile brand + menu */}
          <div className="flex shrink-0 items-center gap-3 md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="icon-btn"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            {/* The full lockup is 6.3:1 — at 375px it would crowd out the XP
                pill and role switcher, so the mobile bar carries the mark. */}
            <QiuLogo variant="mark" priority className="h-7 w-auto" />
          </div>

          {/* Faculty + role switcher. Shown from md so the split-screen bar is
              not just two controls floating at the left edge. */}
          <div className="hidden min-w-0 md:block">
            <p className="text-sm font-semibold">{isStudent ? student.name : roleLabel}</p>
            <p className="text-xs text-muted">
              {isStudent ? `${activeFaculty.name} • Year ${student.year}` : currentRole === 'FACULTY_COORDINATOR' ? `${activeFaculty.name} scope` : 'QIU CPDC workspace'}
            </p>
          </div>

          {/* min-w-0 lets these shrink instead of overflowing the 375px bar. */}
          <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex max-w-[8.5rem] flex-shrink items-center gap-1.5 overflow-hidden rounded-full bg-crimson/10 px-2.5 py-1.5 text-xs font-semibold text-crimson sm:px-3 max-[390px]:hidden lg:hidden">
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="truncate whitespace-nowrap">
                {isStudent ? (xpReady ? `${xp.toLocaleString()} XP` : 'XP') : roleLabel}
              </span>
            </span>

            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setSwitcherOpen((open) => !open)}
                aria-expanded={switcherOpen}
                aria-haspopup="true"
                className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-[14px] border border-black/10 bg-black/[0.03] px-3 text-xs hover:bg-black/[0.06] sm:gap-2"
              >
                <span className="max-w-[5rem] truncate sm:max-w-[9rem]">
                  {ROLES.find((r) => r.id === currentRole)?.label ?? currentRole}
                </span>
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              </button>

              {switcherOpen && (
                <div className="surface absolute right-0 z-50 mt-2 w-72 p-2 max-[640px]:fixed max-[640px]:left-3 max-[640px]:right-3 max-[640px]:top-[4.5rem] max-[640px]:mt-0 max-[640px]:w-auto max-[640px]:max-h-[calc(100vh-5.5rem)] max-[640px]:overflow-y-auto" role="menu" aria-label="Portal view options">
                  <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    View as
                  </p>
                  {demoMode ? ROLES.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setCurrentRole(role.id);
                        setSwitcherOpen(false);
                        router.push(`${homeFor(role.id, activeFaculty.id, settings)}?demoRole=${encodeURIComponent(role.id)}`);
                      }}
                        className={`min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-black/[0.03] ${
                        currentRole === role.id ? 'text-crimson font-semibold' : 'text-[#1d1d1f]'
                      }`}
                    >
                      {role.label}
                      <span className="block text-[11px] text-muted">{role.desc}</span>
                    </button>
                  )) : (
                    <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-3 text-sm">
                      <p className="font-semibold text-[#1d1d1f]">{roleLabel}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        Your live role is managed by QIU administrators. Use People &amp; access to request a verified role change.
                      </p>
                    </div>
                  )}

                  <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Faculty
                  </p>
                  <div className="max-h-48 overflow-y-auto">
                    {FACULTIES.map((faculty) => (
                      <button
                        key={faculty.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setActiveFaculty(faculty);
                          setSwitcherOpen(false);
                        }}
                        className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-black/[0.03] ${
                          activeFaculty.id === faculty.id ? 'text-crimson font-semibold' : 'text-[#1d1d1f]'
                        }`}
                      >
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: faculty.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{faculty.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 border-t border-black/10 px-2 pt-3">
                    <label htmlFor="demo-programme-switcher" className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Programme in selected faculty
                    </label>
                    <select
                      id="demo-programme-switcher"
                      value={student.facultyId === activeFaculty.id ? (student.programme ?? '') : ''}
                      onChange={(event) => {
                        setActiveProgramme(event.target.value);
                        setSwitcherOpen(false);
                      }}
                      className="mt-1.5 h-10 w-full rounded-xl border border-black/10 bg-white px-2.5 text-xs text-[#1d1d1f] outline-none focus:border-crimson"
                    >
                      {activeFaculty.programmes?.map((programme) => {
                        const name = typeof programme === 'string' ? programme : programme.name;
                        return <option key={name} value={name}>{name}</option>;
                      })}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <NotificationBell role={currentRole} />
            <Link
              href="/settings"
              aria-label="Open profile and settings"
              title="Profile and settings"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full"
            >
              <Avatar
                name={identity?.user?.name ?? student.name ?? roleLabel}
                src={identity?.user?.avatarUrl ?? student.avatarUrl ?? null}
                size={36}
              />
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------- Mobile drawer ---------------- */}
      {menuOpen && (
        <DismissibleDialog
          onClose={() => setMenuOpen(false)}
          labelledBy="mobile-menu-title"
          overlayClassName="items-stretch justify-start bg-black/70 p-0 md:hidden"
          className="h-full w-72 max-w-[calc(100vw-2rem)] overflow-y-auto border-r border-black/10 bg-surface p-4 shadow-2xl"
        >
          <nav className="flex h-full flex-col" aria-label="Mobile navigation">
            <div className="flex items-center justify-between pb-4">
              <div className="flex min-w-0 items-center gap-2">
                <QiuLogo className="h-7 w-auto" />
                <h2 id="mobile-menu-title" className="sr-only">Portal navigation</h2>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="icon-btn"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto">
              {modules.map((mod) => {
                const Icon = mod.icon;
                const active = isActive(mod.href);
                return (
                  <Link
                    key={mod.id}
                    href={mod.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-[14px] px-3 text-sm ${
                      active ? 'bg-crimson font-semibold text-white' : 'text-muted hover:bg-black/[0.03]'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    {mod.longLabel}
                  </Link>
                );
              })}
            </div>

            <Link
              href="/logout"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-[14px] px-3 text-sm text-muted hover:bg-black/[0.03]"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
              Sign out
            </Link>
          </nav>
        </DismissibleDialog>
      )}

      {/* ---------------- Content ---------------- */}
      {/* tabIndex={-1} so the skip link can actually move focus here; without
          it the browser scrolls but focus stays on the link. */}
      <main id="portal-main" tabIndex={-1} className="md:pl-[72px] lg:pl-64 focus:outline-none">
        {/* pb-24 clears the phone tab bar; from md up the rail replaces it. */}
        <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 md:pb-8 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      {/* ---------------- Mobile bottom tab bar ---------------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Primary"
      >
        <div className="flex items-stretch justify-around">
          {primary.map((mod) => {
            const Icon = mod.icon;
            const active = isActive(mod.href);
            return (
              <Link
                key={mod.id}
                href={mod.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] ${
                  active ? 'text-crimson' : 'text-muted'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate">{mod.label}</span>
                {/* Active state is not colour-only: an underline carries it too. */}
                <span
                  className={`h-0.5 w-6 rounded-full ${active ? 'bg-crimson' : 'bg-transparent'}`}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </nav>

      <OnboardingTour />
    </div>
  );
}
