'use client';

import { useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  LoaderCircle,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const ICONS = {
  LINKEDIN: Linkedin,
  GITHUB: Github,
  ORCID: ShieldCheck,
  BEHANCE: Sparkles,
  PORTFOLIO: Globe,
};

/**
 * Guided "connect your professional presence" step.
 *
 * Two things this UI has to get right, because they are the whole point:
 *
 *  1. A student who does NOT yet have a LinkedIn account must be walked through
 *     creating one, not simply told they are blocked. The "I don't have one
 *     yet" panel is the guided path: open LinkedIn's sign-up in a new tab, come
 *     back, paste the profile link. A blocking requirement without a route
 *     through it is a dead end.
 *
 *  2. Required and optional must never look the same. Required cards carry a
 *     lock and cannot be skipped; suggested cards say "optional" in words and
 *     are collapsed by default so they cannot be mistaken for more homework.
 *     Meaning is never carried by colour alone.
 */
function ProviderCard({ provider, required, onConnect, onDisconnect, oauthAvailable }) {
  const Icon = ICONS[provider.id] ?? Globe;
  const connected = provider.connected;
  const isConnected = Boolean(connected) && !connected.broken;

  const [open, setOpen] = useState(required && !isConnected);
  const [value, setValue] = useState(connected?.profileUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setWarning('');
    setBusy(true);
    try {
      const result = await onConnect(provider.id, value);
      if (result?.warning) setWarning(result.warning);
      setOpen(false);
    } catch (submitError) {
      setError(submitError.message || 'We could not save that link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-[18px] border p-4 sm:p-5 ${
        isConnected
          ? 'border-emerald-300 bg-emerald-50/60'
          : required
            ? 'border-crimson/40 bg-crimson/[0.03]'
            : 'border-black/10 bg-black/[0.02]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] ${
              isConnected ? 'bg-emerald-600 text-white' : 'bg-black/[0.06] text-[#1d1d1f]'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-sm font-semibold text-[#1d1d1f]">{provider.label}</h3>
              {required ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-crimson px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Required
                </span>
              ) : (
                <span className="rounded-full border border-black/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Optional
                </span>
              )}
              {isConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Connected
                  {connected.method === 'OAUTH' ? ' · verified by ' + provider.label : ''}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{provider.reason}</p>
            {isConnected && connected.profileUrl ? (
              <a
                href={connected.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 break-all text-xs font-medium text-crimson underline"
              >
                {connected.profileUrl}
                <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {isConnected ? (
            <>
              <button type="button" onClick={() => setOpen((o) => !o)} className="secondary-btn min-h-[36px] px-3 text-xs">
                Change
              </button>
              {!required ? (
                <button
                  type="button"
                  onClick={() => onDisconnect(provider.id)}
                  className="min-h-[36px] px-2 text-xs font-medium text-muted underline"
                >
                  Remove
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className={required ? 'crimson-btn min-h-[40px] px-4 text-xs' : 'secondary-btn min-h-[40px] px-4 text-xs'}
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {connected?.broken ? (
        <p className="mt-3 flex items-start gap-2 rounded-[14px] border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800" role="status">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          This link no longer opens. Please update it so CPDC can still reach you.
        </p>
      ) : null}

      {open ? (
        <div className="mt-4 space-y-3 border-t border-black/10 pt-4">
          {oauthAvailable ? (
            <>
              <a
                href={`/api/onboarding/oauth/${provider.id.toLowerCase()}/start`}
                className="crimson-btn flex min-h-[44px] w-full items-center justify-center gap-2 text-sm"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                Sign in with {provider.label}
              </a>
              <p className="text-center text-[11px] text-muted">or paste your profile link</p>
            </>
          ) : null}

          <form onSubmit={submit} className="space-y-2">
            <label htmlFor={`url-${provider.id}`} className="block text-xs font-semibold text-muted">
              Your {provider.label} profile link
            </label>
            <input
              id={`url-${provider.id}`}
              type="url"
              inputMode="url"
              autoComplete="url"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={provider.placeholder}
              className="h-12 w-full rounded-[18px] border border-black/10 bg-white px-4 text-sm text-[#1d1d1f] placeholder:text-muted/60 focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
            />
            {error ? (
              <p className="flex items-start gap-2 text-xs text-red-700" role="alert">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}
            {warning ? (
              <p className="flex items-start gap-2 text-xs text-amber-800" role="status">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                {warning}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="secondary-btn flex min-h-[44px] w-full items-center justify-center gap-2 text-sm">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {busy ? 'Checking the link…' : 'Save link'}
            </button>
          </form>

          {provider.signUpUrl ? (
            <div className="rounded-[14px] bg-black/[0.04] p-3">
              <button
                type="button"
                onClick={() => setShowHelp((s) => !s)}
                className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-[#1d1d1f]"
                aria-expanded={showHelp}
              >
                <span>I don&apos;t have a {provider.label} account yet</span>
                <span aria-hidden="true">{showHelp ? '−' : '+'}</span>
              </button>
              {showHelp ? (
                <ol className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
                  <li>
                    <strong className="text-[#1d1d1f]">1.</strong>{' '}
                    <a
                      href={provider.signUpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-crimson underline"
                    >
                      Create your free {provider.label} account
                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </a>{' '}
                    — it opens in a new tab, so this page stays where it is.
                  </li>
                  <li>
                    <strong className="text-[#1d1d1f]">2.</strong> Use your QIU email so CPDC can match you, and fill in your
                    programme and year.
                  </li>
                  <li>
                    <strong className="text-[#1d1d1f]">3.</strong> Open your own profile and copy the link from the address bar.
                    {provider.profileHelpUrl ? (
                      <>
                        {' '}
                        <a
                          href={provider.profileHelpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-crimson underline"
                        >
                          Where do I find it?
                        </a>
                      </>
                    ) : null}
                  </li>
                  <li>
                    <strong className="text-[#1d1d1f]">4.</strong> Come back to this tab and paste it above.
                  </li>
                </ol>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ConnectAccounts({ state, onConnect, onDisconnect, oauthProviders = [] }) {
  const [showOptional, setShowOptional] = useState(false);
  const required = state?.required ?? [];
  const suggested = state?.suggested ?? [];
  const remaining = state?.missingProviders?.length ?? 0;

  return (
    <section aria-labelledby="connect-heading" className="space-y-5">
      <div>
        <h2 id="connect-heading" className="font-heading text-base font-semibold text-[#1d1d1f]">
          Connect your professional profile
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {remaining > 0
            ? 'This is the one step you cannot skip. It is how CPDC and your lecturers stay in touch with you after you graduate.'
            : 'All set. You can add more below if you want to, or continue.'}
        </p>
      </div>

      <div className="space-y-3">
        {required.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            required
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            oauthAvailable={oauthProviders.includes(provider.id)}
          />
        ))}
      </div>

      {suggested.length > 0 ? (
        <div className="rounded-[18px] border border-black/10">
          <button
            type="button"
            onClick={() => setShowOptional((s) => !s)}
            aria-expanded={showOptional}
            className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left"
          >
            <span className="text-sm font-semibold text-[#1d1d1f]">
              Other profiles you can add{' '}
              <span className="font-normal text-muted">— all optional</span>
            </span>
            <span className="text-muted" aria-hidden="true">{showOptional ? '−' : '+'}</span>
          </button>
          {showOptional ? (
            <div className="space-y-3 border-t border-black/10 p-4">
              <p className="text-xs leading-relaxed text-muted">
                Any student may connect any of these, whatever their faculty. Nothing here blocks you from continuing.
              </p>
              {suggested.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  required={false}
                  onConnect={onConnect}
                  onDisconnect={onDisconnect}
                  oauthAvailable={oauthProviders.includes(provider.id)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
