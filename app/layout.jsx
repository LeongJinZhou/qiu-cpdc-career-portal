import { Inter, Outfit } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });

export const metadata = {
  // A template keeps every route's tab ending in the institution name without
  // each page having to repeat it.
  title: {
    default: 'QIU Career Hub | Quest International University',
    template: '%s | QIU Career Hub',
  },
  description:
    'The Quest International University career development platform: your 4-year roadmap, Career XP, fieldwork logbooks, FYP showcase, workshops and employer connections.',
  applicationName: 'QIU Career Hub',
  // app/icon.png is picked up by the App Router automatically; declaring the
  // Apple touch icon here gives an installed home-screen shortcut the mark too.
  icons: { apple: '/brand/qiu-mark-dark.png' },
};

// Next 15 wants viewport concerns out of `metadata`. The theme colour matches
// --color-canvas so mobile browser chrome blends into the page.
export const viewport = {
  themeColor: '#f5f5f7',
  colorScheme: 'light',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="bg-canvas text-[#1d1d1f] font-sans antialiased selection:bg-crimson selection:text-white">
        {children}
      </body>
    </html>
  );
}
