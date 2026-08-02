// Lightweight cross-component signal for live XP updates.
//
// When a module awards XP (career milestone, workshop check-in, FYP submit) it
// calls emitXpUpdated(total). The dashboard subscribes via onXpUpdated so the
// XP tile and tier react immediately, without prop-drilling or a store.

const XP_EVENT = 'qiu:xp-updated';

export function emitXpUpdated(xp) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(XP_EVENT, { detail: { xp } }));
}

export function onXpUpdated(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event) => handler(event.detail?.xp);
  window.addEventListener(XP_EVENT, listener);
  return () => window.removeEventListener(XP_EVENT, listener);
}
