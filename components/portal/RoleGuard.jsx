'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { canAccess, homeFor, moduleForPath } from '@/lib/modules';
import { useSettings } from '@/lib/settings';
import { usePortal } from './PortalProvider';
import LoadingScreen from '@/components/LoadingScreen';
import { usePathname } from 'next/navigation';

export default function RoleGuard({ children }) {
  const pathname = usePathname();
  const {
    identity,
    identityLoading,
    identityError,
    currentRole,
    activeFaculty,
    hydrated,
    demoMode,
  } = usePortal();
  const [settings] = useSettings();

  if (!hydrated || identityLoading) {
    return <LoadingScreen label="Checking your identity" />;
  }

  if (!demoMode && !identity?.user?.id) {
    const sessionUnavailable = /unavailable|configuration|verify/i.test(identityError || '');
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="surface max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-crimson" aria-hidden="true" />
          <h1 className="section-title mt-4">{sessionUnavailable ? 'We could not verify your session' : 'Sign in required'}</h1>
          <p className="section-subtitle mt-2">
            {identityError || 'Your QIU identity could not be loaded for this session.'}
          </p>
          {sessionUnavailable ? <p className="mt-3 text-xs leading-relaxed text-muted">Try again once, or return to sign-in if your Google session has expired.</p> : null}
          {sessionUnavailable ? <button type="button" onClick={() => window.location.reload()} className="secondary-btn mt-4 inline-flex">Try again</button> : null}
          <Link href="/login" className="secondary-btn mt-4 inline-flex">
            Go to sign-in
          </Link>
        </div>
      </div>
    );
  }

  const allowed = canAccess(currentRole, activeFaculty.id, pathname, settings);

  if (!allowed) {
    const mod = moduleForPath(pathname);
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="surface max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-crimson" aria-hidden="true" />
          <h1 className="section-title mt-4">Access limited for this identity</h1>
          <p className="section-subtitle mt-2">
            {mod?.longLabel ?? 'This area'} is hidden for your current QIU role. Client route guards help with navigation,
            but privileged data still depends on the server capabilities attached to your session.
          </p>
          {/* Resolve the role's real home. This was hardcoded to /dashboard,
              which only STUDENT and SUPER_ADMIN can open — so for the other
              nine roles the escape hatch bounced straight back into this same
              screen. homeFor() validates the destination against real access. */}
          <Link
            href={homeFor(currentRole, activeFaculty.id, settings)}
            className="secondary-btn mt-4 inline-flex"
          >
            Go to your home page
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
