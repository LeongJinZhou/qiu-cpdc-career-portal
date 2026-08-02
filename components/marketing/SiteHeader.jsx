'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import QiuLogo from '@/components/portal/QiuLogo';

const NAV_LINKS = [
  { href: '#journey', label: 'Journey' },
  { href: '#features', label: 'Features' },
  { href: '#faculties', label: 'Faculties' },
  { href: '#employers', label: 'Employers & Alumni' },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/[0.06] bg-canvas/80 backdrop-blur-xl">
      {/*
        The horizontal lockup is ~6.3:1, so at h-9 it alone eats ~225px. Add
        four nav links and a wide CTA and the row does not fit until ~1024px —
        at the 768px `md` breakpoint it used to collide with the logo and wrap
        both "Employers & Alumni" and the button onto second lines. The full
        nav therefore starts at `lg`, and everything narrower (including a
        half-screen desktop window) gets the sheet.
      */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link href="/" className="flex-shrink-0" aria-label="QIU Career Hub home">
          <QiuLogo priority className="h-7 w-auto sm:h-9" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex xl:gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-medium text-muted transition-colors hover:text-[#1d1d1f]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Link href="/login" className="crimson-btn whitespace-nowrap text-sm">
            Sign in with QIU SSO
          </Link>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[10px] text-[#1d1d1f] lg:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav
          aria-label="Mobile"
          className="border-t border-black/[0.06] bg-canvas px-4 pb-6 pt-2 sm:px-6 lg:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center text-base font-medium text-muted hover:text-[#1d1d1f]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            className="crimson-btn mt-4 flex min-h-[44px] w-full items-center justify-center text-sm"
          >
            Sign in with QIU SSO
          </Link>
        </nav>
      )}
    </header>
  );
}
