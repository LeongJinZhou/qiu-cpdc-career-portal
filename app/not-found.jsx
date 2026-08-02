import Link from 'next/link';
import QiuLogo from '@/components/portal/QiuLogo';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas text-[#1d1d1f] p-6 text-center">
      <div className="mb-8">
        <QiuLogo className="h-10 w-auto" />
      </div>

      <div className="surface p-8 max-w-md w-full rounded-2xl border border-black/10 shadow-lg backdrop-blur-md">
        <span className="text-6xl font-bold text-crimson block mb-2">404</span>
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-muted text-sm mb-6">
          The page or resource you are looking for does not exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-crimson text-white font-medium hover:bg-crimson/90 transition-all text-sm shadow-lg shadow-crimson/20"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
