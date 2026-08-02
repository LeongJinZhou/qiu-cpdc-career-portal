/**
 * Initials avatar.
 *
 * Every person shown in this prototype is seeded demo data, so the fixtures
 * used to hotlink Unsplash portraits. That put photographs of real, identifiable
 * people on fabricated QIU student and alumni profiles — including invented job
 * titles and graduation years — which is not something to ship for a real
 * university, and it made the app depend on an external image host at that.
 *
 * The blueprint asks for exactly this instead (§12.8): "use an initials-based
 * avatar (never a broken image icon) when no photo is set."
 *
 * A real uploaded photo is still honoured via `src`; if it fails to load we
 * fall back to initials rather than showing a broken image.
 */
'use client';

import { useState } from 'react';

/**
 * Stable colour per person.
 *
 * Hashing the name means the same student keeps the same colour across the
 * dashboard, the leaderboard and the alumni directory — a random pick would
 * reshuffle on every render and make people look like different accounts.
 */
const PALETTE = [
  { bg: '#e8f0fe', fg: '#1a4b8f' },
  { bg: '#fdecec', fg: '#a3242c' },
  { bg: '#e9f7ef', fg: '#1c6b42' },
  { bg: '#fef3e2', fg: '#96591a' },
  { bg: '#f0ecfb', fg: '#4c3b8f' },
  { bg: '#e6f6f8', fg: '#14636e' },
];

function paletteFor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

/** First letter of the first and last word — "Nur Aisyah Rahman" -> "NR". */
export function initialsFor(name = '') {
  const words = name
    .replace(/\(.*?\)/g, '') // drop parentheticals like "(You)"
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function Avatar({ name = '', src = null, size = 40, className = '' }) {
  const [failed, setFailed] = useState(false);
  const { bg, fg } = paletteFor(name);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: showImage ? 'transparent' : bg,
        color: fg,
        // Scale the initials with the circle so one component covers a 24px
        // list row and a 96px profile header without per-call font sizing.
        fontSize: Math.round(size * 0.38),
        lineHeight: 1,
        fontWeight: 600,
      }}
      // The name is nearly always rendered as text beside the avatar, so
      // announcing it again would just be noise.
      aria-hidden="true"
    >
      {showImage ? (
        /* User-uploaded photos have no known host at build time, so next/image
           cannot be configured for them; onError gives the initials fallback. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initialsFor(name)
      )}
    </span>
  );
}
