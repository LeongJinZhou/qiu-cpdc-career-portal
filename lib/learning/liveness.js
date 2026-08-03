// Module 6 -- catalogue liveness.
//
// The requirement this file exists for: "if a course is listed today and the
// provider takes it down tomorrow, the platform must take it down too."
//
// The hard part is not detecting a 404. It is NOT over-reacting. A learning
// catalogue that empties itself because Coursera rate-limited one sync run is
// worse than a catalogue with one stale entry, because students stop trusting
// it. So three rules are enforced here:
//
//   1. Only an unambiguous signal counts as "gone": 404, 410, or a redirect
//      landing on the provider's search/browse page (how Coursera and edX
//      actually retire a course -- they bounce you to the catalogue, not to a
//      404).
//   2. Anything inconclusive -- timeout, 429, 5xx, network error -- is UNKNOWN.
//      An UNKNOWN never hides a course.
//   3. A course is only delisted after FAILURE_THRESHOLD *consecutive*
//      confirmed-gone probes. One bad afternoon cannot delist anything.
//
// Pure decision logic lives in `classifyProbe` and `nextCourseState` so both
// are unit-testable without a network.

/** Consecutive confirmed-gone probes before a course is hidden from students. */
export const FAILURE_THRESHOLD = 2;

/**
 * Paths a provider redirects to when a course no longer exists. Landing on one
 * of these means the course URL resolved to "here is our catalogue instead".
 */
const RETIREMENT_LANDING_PATTERNS = [
  /^\/?(search|browse|courses)\/?$/i,
  /^\/?$/, // bare homepage
];

/**
 * Turn one HTTP result into a verdict.
 *
 * @returns {{verdict: 'GONE'|'ALIVE'|'INCONCLUSIVE', status: number|null, note: string}}
 */
export function classifyProbe({ status = null, finalUrl = null, requestedUrl = null, error = null } = {}) {
  if (error) {
    return { verdict: 'INCONCLUSIVE', status: null, note: `Check failed: ${error}` };
  }

  if (status === 404 || status === 410) {
    return { verdict: 'GONE', status, note: `Provider returned ${status}` };
  }

  if (status != null && status >= 200 && status < 300) {
    // A 200 on the provider's search page is a retirement, not a live course.
    if (finalUrl && requestedUrl) {
      try {
        const landed = new URL(finalUrl);
        const asked = new URL(requestedUrl);
        const movedOffCourse = landed.pathname !== asked.pathname;
        const landedOnCatalogue = RETIREMENT_LANDING_PATTERNS.some((pattern) =>
          pattern.test(landed.pathname));

        if (movedOffCourse && landedOnCatalogue) {
          return {
            verdict: 'GONE',
            status,
            note: `Redirected to ${landed.pathname || '/'} — course retired`,
          };
        }
      } catch {
        // Unparseable URL: fall through to ALIVE rather than guessing.
      }
    }
    return { verdict: 'ALIVE', status, note: 'OK' };
  }

  // 401/403/429/5xx: the provider is refusing US, not confirming the course is
  // gone. Never delist on this.
  return {
    verdict: 'INCONCLUSIVE',
    status,
    note: status ? `Provider returned ${status} (inconclusive)` : 'No response',
  };
}

/**
 * Fold a verdict into the course's stored availability state.
 *
 * @param {{availability: string, failureStreak: number, unavailableSince: Date|null}} current
 * @param {{verdict: string, status: number|null, note: string}} probe
 * @param {{now?: Date, threshold?: number}} [options]
 */
export function nextCourseState(current, probe, { now = new Date(), threshold = FAILURE_THRESHOLD } = {}) {
  const base = {
    lastCheckedAt: now,
    lastCheckStatus: probe.status,
    lastCheckNote: probe.note,
  };

  if (probe.verdict === 'ALIVE') {
    return {
      ...base,
      availability: 'AVAILABLE',
      failureStreak: 0,
      // A course that comes back (provider outage misread, or genuinely
      // relisted) is restored rather than left dead.
      unavailableSince: null,
    };
  }

  if (probe.verdict === 'GONE') {
    const failureStreak = (current.failureStreak ?? 0) + 1;
    const delisted = failureStreak >= threshold;

    return {
      ...base,
      failureStreak,
      availability: delisted ? 'UNAVAILABLE' : (current.availability ?? 'UNKNOWN'),
      unavailableSince: delisted ? (current.unavailableSince ?? now) : current.unavailableSince ?? null,
    };
  }

  // INCONCLUSIVE: record that we looked, change nothing else. The streak is
  // deliberately NOT reset -- two confirmed-gone probes separated by one
  // timeout still add up to a retired course.
  return {
    ...base,
    availability: current.availability ?? 'UNKNOWN',
    failureStreak: current.failureStreak ?? 0,
    unavailableSince: current.unavailableSince ?? null,
  };
}

/**
 * Probe one course URL. Never throws.
 *
 * GET rather than HEAD: Coursera and edX both serve inconsistent status codes
 * for HEAD, and a HEAD 405 would read as inconclusive on every single course.
 */
export async function probeCourseUrl(url, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'QIU-CPDC-Platform/1.0 (course availability check)' },
    });

    return classifyProbe({
      status: response.status,
      finalUrl: response.url || null,
      requestedUrl: url,
    });
  } catch (error) {
    return classifyProbe({
      error: error?.name === 'AbortError' ? 'timed out' : (error?.message ?? 'network error'),
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Popularity score for the "Hottest" sort.
 *
 * Recent enrolments dominate, with a gentle bonus for newly added courses so a
 * genuinely new listing is discoverable before it has any enrolments at all --
 * otherwise "hottest" just calcifies into "oldest and most enrolled".
 */
export function trendingScore({ enrolmentsRecent = 0, addedAt = null, now = new Date() }) {
  const popularity = Math.log1p(Math.max(0, enrolmentsRecent)) * 10;

  let freshness = 0;
  if (addedAt) {
    const ageDays = (now.getTime() - new Date(addedAt).getTime()) / 86_400_000;
    // Decays to ~0 over about eight weeks.
    freshness = Math.max(0, 8 - ageDays / 7);
  }

  return Number((popularity + freshness).toFixed(3));
}
