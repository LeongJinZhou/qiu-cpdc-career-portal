'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import QiuLogo from '@/components/portal/QiuLogo';
import { signOutGoogle } from '@/lib/auth/firebase-client';

// Browser-side state that must not outlive the session. The session cookie is
// httpOnly and can only be cleared by the server, which is why the fetch below
// comes first — wiping these alone would leave a valid session behind.
const LOCAL_SESSION_KEYS = [
  'qiu.portal.session',
  'qiu.portal.profile',
  'qiu.portal.preferences',
];

/**
 * A real sign-out, reachable as a normal link.
 *
 * The portal sidebar signs out inline; this page exists so that sign-out is
 * also a plain URL (/logout) — bookmarkable, linkable from an email, and usable
 * when the portal chrome is not rendering because the session is already
 * broken. It lands everyone on /login regardless of role: after sign-out there
 * is no role left to route by.
 */
export default function LogoutPage() {
  const router = useRouter();
  const [status, setStatus] = useState('working');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function signOut() {
      let failure = '';

      try {
        const response = await fetch('/api/auth/signout', {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) {
          failure = 'We could not reach the server to end your session. Check your connection and try again.';
        }
      } catch {
        failure = 'We could not reach the server to end your session. Check your connection and try again.';
      }

      try {
        for (const key of LOCAL_SESSION_KEYS) {
          window.sessionStorage?.removeItem(key);
          window.localStorage?.removeItem(key);
        }
      } catch {
        // Storage may be blocked; the server cookie is what actually matters.
      }

      try {
        await signOutGoogle();
      } catch {
        // Firebase is optional in local demo mode. The server cookie above is
        // still the authoritative sign-out operation.
      }

      if (cancelled) return;

      if (failure) {
        setError(failure);
        setStatus('error');
        return;
      }

      setStatus('done');
      window.setTimeout(() => {
        if (!cancelled) router.replace('/login?signedOut=1');
      }, 900);
    }

    signOut();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10 sm:px-6">
      <div className="w-full max-w-sm text-center">
        <QiuLogo variant="stacked" priority className="mx-auto h-16 w-auto" />

        <div className="surface mt-8 space-y-4 p-6 sm:p-7">
          {status === 'working' ? (
            <>
              <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-crimson" aria-hidden="true" />
              <h1 className="font-heading text-xl font-semibold text-[#1d1d1f]">Signing you out…</h1>
              <p className="text-sm text-muted">Ending your session on the QIU server.</p>
            </>
          ) : null}

          {status === 'done' ? (
            <>
              <CheckCircle2 className="mx-auto h-7 w-7 text-crimson" aria-hidden="true" />
              <h1 className="font-heading text-xl font-semibold text-[#1d1d1f]">You are signed out</h1>
              <p className="text-sm text-muted">
                Your session has ended on this device. Taking you back to the sign-in page.
              </p>
              <Link href="/login" className="secondary-btn inline-flex min-h-[44px] items-center justify-center">
                Go to sign-in now
              </Link>
            </>
          ) : null}

          {status === 'error' ? (
            <>
              <div
                className="flex items-start gap-2 rounded-[18px] border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="crimson-btn min-h-[44px] w-full justify-center"
              >
                Try signing out again
              </button>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
