import crypto from 'node:crypto';

const TOKEN_BYTES = 32;
const DEFAULT_TTL_DAYS = 14;

/**
 * Mint a supervisor approval token.
 *
 * Returns the raw token (sent once, in the link) and the hash (all we persist).
 * The raw value is deliberately not recoverable from storage: if the database
 * leaks, the leaked hashes cannot be replayed as working approval links.
 */
export function createMagicToken(ttlDays = DEFAULT_TTL_DAYS) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  return { token, tokenHash: hashToken(token), expiresAt };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time comparison, so response timing does not leak how much of a
 * guessed token was correct.
 */
export function tokenMatches(token, expectedHash) {
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function isExpired(approval, now = new Date()) {
  return approval.expiresAt.getTime() <= now.getTime();
}
