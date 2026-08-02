import { tierFor } from './xp.js';

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(value, timeZone) {
  const date = asDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function previousDay(key) {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Count the current consecutive login streak from audit activity.
 *
 * If the student has not logged in yet today, yesterday remains the active
 * streak so the dashboard does not drop to zero during a normal day. A gap
 * ends the streak; lastSignInAt alone is intentionally not enough to inflate
 * this value.
 */
export function computeLoginStreakDays(
  events,
  { now = new Date(), timeZone = 'Asia/Kuala_Lumpur' } = {},
) {
  const keys = new Set(
    (Array.isArray(events) ? events : [])
      .map((event) => dayKey(event?.createdAt ?? event, timeZone))
      .filter(Boolean),
  );
  const today = dayKey(now, timeZone);
  if (!today) return 0;

  let cursor = keys.has(today) ? today : previousDay(today);
  if (!keys.has(cursor)) return 0;

  let streak = 0;
  while (keys.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

/** Return only safe, client-facing fields from the append-only XP ledger. */
export function serializeXpLedger(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const createdAt = asDate(entry?.createdAt);
      if (!createdAt) return null;
      return {
        id: entry.id,
        amount: entry.amount,
        source: entry.source,
        note: entry.note ?? null,
        createdAt: createdAt.toISOString(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Build the stable dashboard contract from database-derived inputs. */
export function buildXpSummary({
  totalXp = 0,
  ledger = [],
  loginEvents = [],
  now = new Date(),
  timeZone = 'Asia/Kuala_Lumpur',
} = {}) {
  const safeTotal = Number.isFinite(Number(totalXp)) ? Number(totalXp) : 0;
  return {
    totalXp: safeTotal,
    tier: tierFor(safeTotal).name,
    streakDays: computeLoginStreakDays(loginEvents, { now, timeZone }),
    ledger: serializeXpLedger(ledger),
  };
}
