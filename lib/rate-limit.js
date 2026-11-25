// In-memory sliding-window rate limiter.
//
// Enough for one server instance (the Render plan runs one). If the app is
// ever scaled to several instances, move this to a shared store (e.g. Redis),
// or each instance will allow the full limit.

export function createRateLimiter({ limit, windowMs, maxKeys = 10_000 }) {
  const hits = new Map(); // key -> sorted timestamps

  function check(key, now = Date.now()) {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { allowed: false, retryAfterMs: windowMs - (now - recent[0]) };
    }
    recent.push(now);
    // Re-insert so Map order is least-recently-used first, then evict.
    hits.delete(key);
    hits.set(key, recent);
    while (hits.size > maxKeys) hits.delete(hits.keys().next().value);
    return { allowed: true, retryAfterMs: 0 };
  }

  return { check, size: () => hits.size };
}
