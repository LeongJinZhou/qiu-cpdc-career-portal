import { MapPin } from 'lucide-react';
import PortalPreview from '@/components/marketing/PortalPreview';

/**
 * Landing hero.
 *
 * The motion here is deliberately CSS-only (staggered `.qiu-fade-up` on the
 * headline, drifting `.qiu-aurora` wash) so the first paint is already the
 * finished frame — no hydration gate on the most important text on the site.
 * The one interactive piece, the portal preview, is isolated in its own client
 * component so the rest of the hero stays a server component.
 */

const HEADLINE = ['Your', 'career,', 'tracked', 'from'];

export default function Hero() {
  return (
    <section
      aria-label="Introduction"
      className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-36 lg:px-8 lg:pt-44"
    >
      {/* Ambient wash — decorative only. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="qiu-aurora absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-crimson/15 blur-[140px]" />
        <div
          className="qiu-aurora absolute -right-24 top-40 h-[380px] w-[380px] rounded-full bg-sky-200/40 blur-[130px]"
          style={{ animationDelay: '3s' }}
        />
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* ---------- Copy ---------- */}
        <div className="text-center lg:text-left">
          <span className="badge-pill qiu-fade-up inline-flex items-center gap-1.5 border border-black/10 bg-white/70 text-muted backdrop-blur">
            <MapPin size={12} aria-hidden="true" />
            Quest International University &middot; Ipoh, Malaysia
          </span>

          <h1 className="mt-6 font-heading text-[2.6rem] font-bold leading-[1.05] tracking-tight text-[#1d1d1f] sm:text-6xl lg:text-[4.25rem]">
            {HEADLINE.map((word, i) => (
              <span
                key={word}
                className="qiu-fade-up mr-[0.28em] inline-block"
                style={{ animationDelay: `${80 + i * 70}ms` }}
              >
                {word}
              </span>
            ))}
            <span
              className="qiu-fade-up relative inline-block text-crimson"
              style={{ animationDelay: `${80 + HEADLINE.length * 70}ms` }}
            >
              day one
              {/* Hand-drawn-feeling underline, decorative. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                className="absolute -bottom-1 left-0 h-2.5 w-full text-crimson/35"
              >
                <path
                  d="M2 8C40 3 78 2 115 4c30 1.6 55 3.4 83 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p
            className="section-subtitle qiu-fade-up mx-auto mt-7 max-w-xl text-base leading-relaxed sm:text-lg lg:mx-0"
            style={{ animationDelay: '420ms' }}
          >
            QIU Career Hub keeps every workshop, placement, certificate and project in one
            connected record — so the CV you need on graduation day has been building itself
            since your first semester.
          </p>

          <div
            className="qiu-fade-up mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
            style={{ animationDelay: '500ms' }}
          >
            <a
              href="#journey"
              className="crimson-btn min-h-[44px] w-full justify-center text-base sm:w-auto"
            >
              See how it works
            </a>
          </div>

          <p
            className="qiu-fade-up mt-5 text-xs text-muted"
            style={{ animationDelay: '560ms' }}
          >
            For students, alumni, employers and CPDC staff — one sign-in, one record.
          </p>
        </div>

        {/* ---------- Product preview ---------- */}
        <div className="flex justify-center lg:justify-end">
          <PortalPreview />
        </div>
      </div>
    </section>
  );
}
