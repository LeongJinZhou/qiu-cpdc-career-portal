/**
 * Loading UI for every authenticated module route.
 *
 * This file sits *inside* app/(portal)/layout.jsx, so Next keeps PortalShell —
 * sidebar, top bar and mobile tab bar — mounted and swaps only the content
 * area. A full-screen splash here would tear the chrome down and rebuild it on
 * every navigation, which reads as a flash. So this is a skeleton of a module
 * page instead: same rhythm, same corner radii, same column widths as the real
 * thing, topped by the branded loading tab so the state is unmistakable.
 *
 * No client hooks — a loading UI that waits on hydration to paint is no loading
 * UI at all. `animate-pulse` is Tailwind's built-in and stills itself under
 * `prefers-reduced-motion` via the global reduce rule in globals.css; the
 * screen-reader status text below carries the meaning either way.
 */

function Line({ className = '' }) {
  return <div className={`animate-pulse rounded-full bg-black/[0.07] ${className}`} aria-hidden="true" />;
}

function Block({ className = '' }) {
  return <div className={`animate-pulse rounded-[14px] bg-black/[0.05] ${className}`} aria-hidden="true" />;
}

export default function Loading() {
  return (
    <div>
      {/* The loading tab — indeterminate, sits where a page title would start. */}
      <div role="progressbar" aria-valuetext="Loading this module" aria-busy="true">
        <div className="h-1 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div className="qiu-loading-bar h-full w-1/4 rounded-full bg-crimson" />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Loading this module
      </p>

      {/* Page heading */}
      <div className="mt-7 space-y-3">
        <Line className="h-7 w-56 max-w-full" />
        <Line className="h-3.5 w-80 max-w-full" />
      </div>

      {/* Summary tiles */}
      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="surface p-5">
            <Block className="h-9 w-9 rounded-[10px]" />
            <Line className="mt-4 h-6 w-20" />
            <Line className="mt-2.5 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Main column + rail, matching the usual module layout */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="surface p-6">
          <Line className="h-5 w-44" />
          <div className="mt-6 space-y-5">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-start gap-4">
                <Block className="h-11 w-11 flex-shrink-0 rounded-[12px]" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <Line className="h-4 w-1/2" />
                  <Line className="h-3 w-full" />
                  <Line className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="surface p-6">
            <Line className="h-4 w-28" />
            <Block className="mt-5 h-2 w-full rounded-full" />
            <Line className="mt-4 h-3 w-40" />
            <Line className="mt-2.5 h-3 w-32" />
          </div>
          <div className="surface p-6">
            <Line className="h-4 w-24" />
            <div className="mt-5 space-y-3">
              {[0, 1, 2].map((row) => (
                <Line key={row} className="h-3.5 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
