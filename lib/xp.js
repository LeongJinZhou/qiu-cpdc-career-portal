// Career XP rules from the CPDC blueprint.
//
// These are the single source of truth for award values and tier thresholds;
// UI components should read from here rather than hardcoding numbers.

export const XP_VALUES = {
  PROFILE_SETUP: 100,
  WORKSHOP_ATTENDANCE: 150,
  COURSE_COMPLETION: 300,
  MOCK_INTERVIEW: 100,
  LOGBOOK_ONTIME: 50,
  DIAGNOSTIC_PASSED: 150,
  STREAK_BONUS: 200,

  // Not in the original blueprint's action list: the FYP showcase was added
  // later and needs its own value. Reusing an unrelated constant would file
  // the award under the wrong source in the XP ledger.
  FYP_SUBMISSION: 250,

  // Module 6 learning paths. Finishing every course in a CPDC-curated path is a
  // distinct achievement from the individual COURSE_COMPLETION awards it
  // contains, so it gets its own bonus rather than an inflated course value —
  // otherwise the XP ledger cannot explain where the extra points came from.
  LEARNING_PATH_COMPLETION: 500,

  // Module 3 Career Path: each roadmap milestone a student completes awards a
  // fixed amount, once, via an idempotent ledger entry.
  CAREER_MILESTONE: 100,
};

// Ordered high -> low so tierFor can return the first match.
export const TIERS = [
  { name: 'Diamond', min: 12000 },
  { name: 'Platinum', min: 7000 },
  { name: 'Gold', min: 3500 },
  { name: 'Silver', min: 1500 },
  { name: 'Bronze', min: 500 },
  { name: 'Novice', min: 0 },
];

/** Current tier for an XP total. */
export function tierFor(xp) {
  return TIERS.find((tier) => xp >= tier.min) ?? TIERS[TIERS.length - 1];
}

/**
 * Progress toward the next tier.
 * At the top tier there is nothing further to earn, so progress reads 100%.
 */
export function tierProgress(xp) {
  const current = tierFor(xp);
  const currentIndex = TIERS.findIndex((tier) => tier.name === current.name);
  const next = currentIndex > 0 ? TIERS[currentIndex - 1] : null;

  if (!next) {
    return { current, next: null, progress: 1, xpToNext: 0 };
  }

  const span = next.min - current.min;
  const earned = xp - current.min;

  return {
    current,
    next,
    progress: span === 0 ? 1 : earned / span,
    xpToNext: next.min - xp,
  };
}
