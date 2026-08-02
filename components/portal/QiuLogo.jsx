import Image from 'next/image';

/**
 * The QIU institutional lockup.
 *
 * QIU supplies two *different lockups* — a horizontal one and a stacked one —
 * so `variant` picks the shape and `tone` picks the ink. They are independent:
 * the masters happen to ship horizontal-in-white and stacked-in-black, but
 * scripts/build-brand-assets.mjs derives all four combinations, so a caller
 * never has to accept the wrong layout just to get the right colour.
 *
 * `tone="light"` means light ink for a dark surface — name the ink, and check
 * the surface you are painting on.
 *
 * The registration number DU021(A) is part of the official artwork, so it is
 * never drawn separately; scaling the lockup carries it automatically.
 */

const ASSETS = {
  horizontal: {
    // 6.29:1 — the default. Fits a header or sidebar row without crowding it.
    dark: '/brand/qiu-logo-horizontal-dark.png',
    light: '/brand/qiu-logo-horizontal-light.png',
    width: 1208,
    height: 192,
  },
  stacked: {
    // 2.36:1 — for the login card, footer, and anywhere with vertical room.
    dark: '/brand/qiu-logo-stacked-dark.png',
    light: '/brand/qiu-logo-stacked-light.png',
    width: 814,
    height: 345,
  },
  mark: {
    // 1.81:1 — the QIU glyph alone, for tight chrome and loading states.
    dark: '/brand/qiu-mark-dark.png',
    light: '/brand/qiu-mark-light.png',
    width: 544,
    height: 301,
  },
};

export default function QiuLogo({
  className = 'h-9 w-auto',
  variant = 'horizontal',
  tone = 'dark',
  priority = false,
  /**
   * Decorative means the surrounding text already names the university, so an
   * empty alt keeps screen readers from announcing the wordmark twice.
   */
  decorative = false,
}) {
  const asset = ASSETS[variant] ?? ASSETS.horizontal;

  return (
    <Image
      src={tone === 'light' ? asset.light : asset.dark}
      alt={decorative ? '' : 'Quest International University'}
      width={asset.width}
      height={asset.height}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}
