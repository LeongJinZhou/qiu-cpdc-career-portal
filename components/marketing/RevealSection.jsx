'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Scroll-reveal wrapper.
 *
 * The trap with reveal-on-scroll is that it starts content at `opacity: 0` and
 * relies on JavaScript to bring it back — so a failed observer, a crawler, or a
 * disabled script leaves the page permanently blank. This one inverts that:
 * content renders **visible**, and the hidden state is only ever opted into on
 * the client, and only for elements that are already below the fold. An element
 * you can see never flips, so hydration causes no flash, and if anything at all
 * goes wrong the failure mode is "no animation" rather than "no content".
 *
 * Reduced-motion visitors skip the mechanism entirely and get static content.
 */

// useLayoutEffect warns during SSR, but the measurement below has to happen
// before paint on the client — so pick the right hook per environment.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function RevealSection({
  children,
  className = '',
  as: Tag = 'div',
  delay = 0,
  ...rest
}) {
  const ref = useRef(null);
  const [hidden, setHidden] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    let reduced = false;
    try {
      reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    } catch {
      reduced = false;
    }
    if (reduced) return undefined;

    // Only hide what the visitor cannot see yet. Anything already on screen
    // stays exactly as it was server-rendered.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) return undefined;

    setHidden(true);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHidden(false);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(node);

    // Belt and braces: if the observer somehow never fires, show the content.
    const failsafe = window.setTimeout(() => {
      setHidden(false);
      observer.disconnect();
    }, 4000);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        hidden ? 'translate-y-6 opacity-0' : 'translate-y-0 opacity-100'
      } ${className}`}
      style={{ transitionDelay: hidden ? '0ms' : `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
