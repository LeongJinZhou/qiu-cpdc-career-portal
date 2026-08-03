'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, CheckCircle2, FlaskConical, LoaderCircle, ShieldCheck } from 'lucide-react';
import QiuLogo from '@/components/portal/QiuLogo';
import { getPublicAuthMode, hasFirebaseClientConfig } from '@/lib/auth/config';
import { completeGoogleRedirectSignIn, signInWithGoogle } from '@/lib/auth/firebase-client';
import { homeFor } from '@/lib/modules';

// ---------------------------------------------------------------------------
// TURNING ON GOOGLE SIGN-IN  (this page is the whole switch)
// ---------------------------------------------------------------------------
// Nothing on this page collects a QIU password, and it never will. A realistic
// university-branded password box that does not actually authenticate is a
// phishing template, so the only real credential path here is Google, and until
// it is configured the button says so instead of pretending.
//
// To go live, set these and restart — no code change is required:
//
//   1. Firebase console -> Authentication -> Sign-in method -> enable Google.
//      Add your domain under Authentication -> Settings -> Authorized domains.
//   2. Client env (browser-visible, safe to ship):
//        NEXT_PUBLIC_AUTH_MODE=firebase-google
//        NEXT_PUBLIC_FIREBASE_API_KEY
//        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
//        NEXT_PUBLIC_FIREBASE_PROJECT_ID
//        NEXT_PUBLIC_FIREBASE_APP_ID
//      All four are required — hasFirebaseClientConfig() checks exactly these,
//      and the button below stays disabled until they are all present.
//   3. Server env (secret, never NEXT_PUBLIC_):
//        FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//        SESSION_SECRET  (long random string; signs the session cookie)
//      AUTH_MODE=firebase-google as well — AUTH_MODE=demo is refused outside
//      development by getAuthMode(), so production cannot fall back to the
//      seeded student even by accident.
//   4. Allowlist behaviour — this is the part people miss. Verifying a Google
//      token only proves *who* someone is, not that they belong to QIU. A user
//      row must already exist in Postgres with loginAllowed = true and
//      accountStatus = 'ACTIVE' (see assertSessionEligibleUser in
//      lib/auth/session.js), otherwise sign-in is refused with 403 even for a
//      valid @qiu.edu.my account. Seed staff/students first, or bootstrap the
//      first admin with `npm run db:bootstrap-admin`.
//
// After that, POST /api/auth/session exchanges the Firebase ID token for the
// httpOnly session cookie and this page routes the user to their role's home.
// ---------------------------------------------------------------------------

const DEMO_SESSION_KEY = 'qiu.portal.session';

const AUTH_MODE = getPublicAuthMode();
const FIREBASE_CONFIGURED = hasFirebaseClientConfig();
const DEMO_MODE_ENABLED = AUTH_MODE === 'demo' && process.env.NODE_ENV !== 'production';

function demoRoute(pathname, role = 'STUDENT') {
  return `${pathname}?demoRole=${encodeURIComponent(role)}`;
}

/**
 * Where a signed-in account belongs. `homeFor` in lib/modules.js is the single
 * source of truth for all eleven roles — it returns the role's declared home if
 * that module is enabled for them, and otherwise their first accessible module,
 * so no role can ever be routed to a page it cannot open.
 */
function routeForRole(role) {
  const home = homeFor(role);
  return home && home !== '/' ? home : '/dashboard';
}

/**
 * A `next` path captured when someone was bounced off a portal route. Only
 * same-origin absolute paths are honoured — an attacker-supplied
 * `?next=https://evil.example` must never survive a login redirect.
 */
function safeNextPath(candidate) {
  if (typeof candidate !== 'string') return null;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
  if (candidate.startsWith('/login') || candidate.startsWith('/logout')) return null;
  return candidate;
}

async function establishServerSession(idToken) {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Unable to sign in right now.');
  }

  return payload.user;
}

// Best-effort: enrich the student's record with their QIU Employee ID and course
// from the Google directory (Module 16). Runs AFTER the session exists and never
// blocks or fails the sign-in — a declined scope or a directory hiccup is fine.
async function syncDirectoryProfile(accessToken) {
  if (!accessToken) return;
  try {
    await fetch('/api/identity/directory-sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accessToken }),
    });
  } catch {
    // Enrichment is optional; the student is already signed in.
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedOutNotice, setSignedOutNotice] = useState(false);
  const [nextPath, setNextPath] = useState(null);

  const configurationMessage = useMemo(() => {
    if (FIREBASE_CONFIGURED) {
      return '';
    }

    return 'Google sign-in is not switched on yet. The Firebase keys listed in .env.example still need to be added for this site.';
  }, []);

  // Read the query string directly rather than through useSearchParams: this is
  // a statically rendered page, and useSearchParams would force a Suspense
  // boundary around it for no benefit.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setSignedOutNotice(params.get('signedOut') === '1');
      setNextPath(safeNextPath(params.get('next')));
    } catch {
      // A blocked location read just means no banner and no return path.
    }
  }, []);

  const goHome = useCallback((role) => {
    router.replace(nextPath ?? routeForRole(role));
  }, [nextPath, router]);

  // Someone who is already signed in has no business seeing a sign-in page.
  // Send them to their role's home instead of showing a dead-end form.
  useEffect(() => {
    let cancelled = false;

    async function detectExistingSession() {
      if (DEMO_MODE_ENABLED) {
        if (!cancelled) setCheckingSession(false);
        return;
      }

      try {
        const response = await fetch('/api/identity/me', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!response.ok) {
          if (!cancelled) setCheckingSession(false);
          return;
        }

        const identity = await response.json();
        if (cancelled) return;

        if (identity?.user?.id) {
          goHome(identity.role ?? identity.user.role);
          return;
        }

        setCheckingSession(false);
      } catch {
        if (!cancelled) setCheckingSession(false);
      }
    }

    detectExistingSession();

    return () => {
      cancelled = true;
    };
  }, [goHome]);

  const startDemoSession = (role = 'STUDENT') => {
    try {
      window.sessionStorage.setItem(
        DEMO_SESSION_KEY,
        JSON.stringify({ role, facultyId: 'computing_engineering' }),
      );
    } catch {
      // The portal still opens if storage is unavailable.
    }
  };

  const goToDemo = () => {
    setSubmitting(true);
    setError('');
    startDemoSession('STUDENT');
    router.push(demoRoute('/onboarding', 'STUDENT'));
  };

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) {
      return undefined;
    }

    let cancelled = false;

    const finishRedirectSignIn = async () => {
      try {
        const result = await completeGoogleRedirectSignIn();
        if (!result?.user || cancelled) {
          return;
        }

        setSubmitting(true);
        setError('');

        const user = await establishServerSession(await result.user.getIdToken());
        await syncDirectoryProfile(result.directoryAccessToken);
        if (!cancelled) {
          goHome(user.role);
        }
      } catch (redirectError) {
        if (!cancelled) {
          setError(redirectError.message || 'Unable to complete Google sign-in.');
          setSubmitting(false);
        }
      }
    };

    finishRedirectSignIn();

    return () => {
      cancelled = true;
    };
  }, [goHome]);

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setError('');

    try {
      const { redirected, result, accessToken } = await signInWithGoogle();
      if (redirected || !result?.user) {
        return;
      }

      const user = await establishServerSession(await result.user.getIdToken());
      await syncDirectoryProfile(accessToken);
      goHome(user.role);
    } catch (signInError) {
      setError(signInError.message || 'Unable to sign in with Google.');
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-6 text-center">
          <QiuLogo variant="stacked" priority className="h-20 w-auto" />
          <div className="space-y-1.5">
            <h1 className="font-heading text-2xl font-semibold text-[#1d1d1f] sm:text-[28px]">
              Welcome back
            </h1>
            <p className="text-sm text-muted">
              Sign in to QIU Career Hub to track your co-curricular progress.
            </p>
          </div>
        </div>

        {signedOutNotice ? (
          <div
            className="mb-4 flex items-start gap-2 rounded-[18px] border border-black/10 bg-white p-3.5 text-left text-sm text-[#1d1d1f]"
            role="status"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-crimson" aria-hidden="true" />
            <p>You have been signed out. Sign in again whenever you are ready.</p>
          </div>
        ) : null}

        {nextPath ? (
          <div className="mb-4 rounded-[18px] border border-black/10 bg-black/[0.03] p-3.5 text-left text-xs leading-relaxed text-muted">
            Sign in to continue to the page you were opening. We will take you straight there.
          </div>
        ) : null}

        <div className="surface space-y-6 p-6 sm:p-7">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting || checkingSession || !FIREBASE_CONFIGURED}
            aria-describedby="google-signin-hint"
            className="crimson-btn flex min-h-[48px] w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting || checkingSession ? (
              <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            )}
            <span>
              {checkingSession
                ? 'Checking your session…'
                : FIREBASE_CONFIGURED
                  ? 'Continue with your QIU Google account'
                  : 'Google sign-in — not switched on yet'}
            </span>
          </button>
          <p id="google-signin-hint" className="text-center text-xs leading-relaxed text-muted">
            Your QIU Google account is the only way in. We never ask for your QIU password on this
            page — access is granted by the server after Google confirms who you are.
          </p>

          {error ? (
            <div className="flex items-start gap-2 rounded-[18px] border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          ) : null}

          {configurationMessage ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-3 text-left text-xs leading-relaxed text-amber-800">
              {configurationMessage}
            </div>
          ) : null}

          {DEMO_MODE_ENABLED ? (
            <>
              <div className="flex items-center gap-3" role="separator" aria-label="or">
                <div className="h-px flex-1 bg-black/[0.06]" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted">local only</span>
                <div className="h-px flex-1 bg-black/[0.06]" />
              </div>

              <button
                type="button"
                onClick={goToDemo}
                disabled={submitting}
                className="secondary-btn flex min-h-[48px] w-full items-center justify-center gap-2 disabled:opacity-70"
              >
                <span>Open local demo</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-[18px] border border-black/10 bg-black/[0.03] p-3.5 text-left">
          <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-muted">
            This is a demo sign-in. Real access needs Google authentication plus a QIU account
            record approved on the server.
            {DEMO_MODE_ENABLED ? ' Local demo access is enabled only for development smoke tests.' : ''}
          </p>
        </div>
      </div>
    </main>
  );
}
