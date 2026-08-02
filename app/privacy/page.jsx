import Link from 'next/link';
import QiuLogo from '@/components/portal/QiuLogo';

export const metadata = {
  title: 'Privacy & data | QIU Career Hub',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/" aria-label="QIU Career Hub home"><QiuLogo variant="stacked" className="h-16 w-auto" /></Link>
        <article className="surface mt-10 space-y-6 p-6 sm:p-8">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-crimson">QIU Career Hub</p><h1 className="section-title mt-2">Privacy & data</h1><p className="section-subtitle mt-2">A plain-language summary for this prototype environment.</p></div>
          <section className="space-y-2"><h2 className="font-heading text-lg font-semibold">What the demo stores</h2><p className="text-sm leading-relaxed text-muted">Demo profile preferences and settings are stored in your browser session or local storage so the experience survives refreshes. The logbook flow uses the configured development database and single-use supervisor links.</p></section>
          <section className="space-y-2"><h2 className="font-heading text-lg font-semibold">Before production</h2><p className="text-sm leading-relaxed text-muted">QIU SSO, authenticated API authorization, retention rules and a formal privacy notice must be connected before real student records are used.</p></section>
          <Link href="/help" className="secondary-btn w-fit">Open CPDC support</Link>
        </article>
      </div>
    </main>
  );
}
