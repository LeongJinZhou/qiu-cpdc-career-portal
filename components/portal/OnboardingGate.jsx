'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import LoadingScreen from '@/components/LoadingScreen';

/**
 * Sends a student who has not finished first-login onboarding to /onboarding,
 * and — the part that matters most — gets out of the way permanently once they
 * have.
 *
 * The verdict comes from the server (`GET /api/onboarding`), which reads
 * `Student.onboardingCompletedAt`. It is deliberately NOT read from
 * sessionStorage: the promise made to the student is "confirm once", and a
 * client-side flag would break that on the next device, the next browser, or
 * the next time they clear their data.
 *
 * Failure behaviour is fail-open on purpose. If this check errors, the student
 * proceeds into the portal. The alternative — locking everyone out of the whole
 * platform because one enrichment endpoint is unhappy — is far worse than a
 * student occasionally not being re-prompted, and every write endpoint enforces
 * the requirement server-side regardless.
 */
export default function OnboardingGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch('/api/onboarding', {
          cache: 'no-store',
          credentials: 'include',
        });

        if (!response.ok) {
          if (!cancelled) setChecking(false);
          return;
        }

        const state = await response.json();

        if (cancelled) return;

        if (state?.needsOnboarding) {
          setRedirecting(true);
          // Carry the demo role through so the switcher survives the detour.
          const demoRole = searchParams.get('demoRole');
          const target = demoRole
            ? `/onboarding?demoRole=${encodeURIComponent(demoRole)}`
            : '/onboarding';
          router.replace(target);
          return;
        }

        setChecking(false);
      } catch {
        // Network hiccup: let the student through. See the fail-open note above.
        if (!cancelled) setChecking(false);
      }
    }

    check();

    return () => {
      cancelled = true;
    };
    // Re-runs on navigation so a student who finishes onboarding and lands back
    // in the portal is re-evaluated once, then never blocks again.
  }, [pathname, router, searchParams]);

  if (checking || redirecting) {
    return <LoadingScreen label={redirecting ? 'Setting up your account' : 'Loading your portal'} />;
  }

  return children;
}
