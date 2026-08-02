'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts up to `value` the first time it scrolls into view.
 *
 * The final value is what renders on the server and what a reduced-motion or
 * no-JavaScript visitor sees — the animation is strictly decoration layered on
 * top, never the thing that produces the number.
 */
export default function CountUp({ value, duration = 1100, className = '' }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    let reduced = false;
    try {
      reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    } catch {
      reduced = false;
    }
    if (reduced) return undefined;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutCubic — fast then settling, so the last digits land calmly.
          const eased = 1 - (1 - t) ** 3;
          setDisplay(Math.round(value * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        setDisplay(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(node);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {display}
    </span>
  );
}
