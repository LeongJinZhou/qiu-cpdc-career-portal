export function parseWorkshopStart(value) {
  const raw = String(value ?? '').trim();
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) {
    throw new Error('startsAt must be a valid start date.');
  }
  return date;
}

export function seatsLeft(capacity, rsvpCount) {
  if (capacity == null) return null;
  return Math.max(0, Number(capacity) - Number(rsvpCount || 0));
}

export function isRegistrationOpen({ registrationDeadline = null, startsAt, now = new Date() } = {}) {
  const current = now instanceof Date ? now : new Date(now);
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  const deadline = registrationDeadline == null
    ? start
    : registrationDeadline instanceof Date ? registrationDeadline : new Date(registrationDeadline);
  if ([current, start, deadline].some((value) => Number.isNaN(value.getTime()))) return false;
  return current.getTime() < deadline.getTime() && current.getTime() < start.getTime();
}

export function isQrCheckInOpen(
  startsAt,
  { now = new Date(), beforeHours = 2, afterHours = 36 } = {},
) {
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(start.getTime()) || Number.isNaN(current.getTime())) return false;

  const earliest = start.getTime() - beforeHours * 60 * 60 * 1000;
  const latest = start.getTime() + afterHours * 60 * 60 * 1000;
  return current.getTime() >= earliest && current.getTime() <= latest;
}

export function checkInAward({ alreadyCheckedIn, xpValue }) {
  return { xpAwarded: alreadyCheckedIn ? 0 : Number(xpValue) || 0 };
}
