import Link from 'next/link';
import QiuLogo from '@/components/portal/QiuLogo';

const LINK_COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'Journey', href: '#journey' },
      { label: 'Features', href: '#features' },
      { label: 'Faculties', href: '#faculties' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Employers & Alumni', href: '#employers' },
      { label: 'Sign in', href: '/login' },
    ],
  },
  {
    title: 'University',
    links: [
      { label: 'About QIU', href: 'https://qiu.edu.my' },
      { label: 'CPDC support', href: '/help' },
      { label: 'Privacy & data', href: '/privacy' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-black/[0.06] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <QiuLogo variant="stacked" className="h-16 w-auto" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Quest International University, Ipoh, Perak, Malaysia.
            </p>
          </div>

          {LINK_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="font-heading text-sm font-semibold text-[#1d1d1f]">{column.title}</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-[#1d1d1f]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 rounded-[24px] bg-[#1d1d1f] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <QiuLogo tone="light" className="h-10 w-auto" />
            <div className="border-l border-white/20 pl-4">
              <p className="text-sm font-semibold">Career-ready from day one.</p>
              <p className="mt-1 text-xs text-white/60">QIU Career Hub · CPDC</p>
            </div>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-white/60 sm:text-right">
            A connected record of your learning, experience and next opportunity.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-black/[0.06] pt-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Quest International University (DU021(A)).</p>
          <p>Ipoh, Perak, Malaysia</p>
        </div>
      </div>
    </footer>
  );
}
