import QiuLogo from '@/components/portal/QiuLogo';

/**
 * Branded full-screen loading splash.
 *
 * Deliberately a *server* component with no state or effects: a loading UI that
 * has to hydrate before it paints defeats the point. Everything here is static
 * markup plus CSS animation, so Next can stream it instantly.
 *
 * The centrepiece is the "loading tab" — the indeterminate crimson pill that
 * sweeps across its track (`.qiu-loading-bar` in globals.css). Because it is
 * indeterminate the progressbar carries `aria-valuetext` and no value, and the
 * status text is announced politely, so the state is never motion-only. Under
 * `prefers-reduced-motion` the sweep stops and the pill simply rests in its
 * track; the label still says what is happening.
 */
export default function LoadingScreen({
  label = 'Loading your career hub',
  hint = 'Bringing together your programme journey, workshops and next steps.',
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4 py-12">
      {/* Ambient wash — decorative, keeps the splash from reading as a blank page. */}
      <div
        aria-hidden="true"
        className="qiu-aurora pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-crimson/10 blur-[130px]"
      />

      <div className="w-full max-w-sm">
        <div className="surface qiu-float-in flex flex-col items-center gap-7 px-7 py-9 text-center">
          <QiuLogo variant="stacked" priority className="h-16 w-auto" />

          <div className="w-full space-y-2" role="status" aria-live="polite">
            <p className="font-heading text-base font-semibold text-[#1d1d1f]">{label}</p>
            <p className="text-xs leading-relaxed text-muted">{hint}</p>
          </div>

          {/* The loading tab. */}
          <div className="w-full" role="progressbar" aria-valuetext={label} aria-busy="true">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.07]">
              <div className="qiu-loading-bar h-full w-1/3 rounded-full bg-crimson" />
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] tracking-wide text-muted">
          Quest International University &middot; CPDC
        </p>
      </div>
    </main>
  );
}
