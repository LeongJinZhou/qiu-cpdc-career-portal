const REDACTED = '[REDACTED]';
const REDACTABLE_KEY_PATTERN = /(token|password|secret|privatekey|credential)/i;

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function shouldRedactKey(key) {
  return REDACTABLE_KEY_PATTERN.test(String(key).replace(/[^a-z0-9]/gi, ''));
}

export function sanitizeAuditPayload(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditPayload);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        shouldRedactKey(key) ? REDACTED : sanitizeAuditPayload(entryValue),
      ]),
    );
  }

  return value;
}

export async function createAuditEntry({
  tx,
  actorUserId = null,
  action,
  resourceType,
  resourceId,
  before = null,
  after = null,
  requestId = null,
  metadata = null,
}) {
  if (!tx?.auditLog?.create) {
    throw new TypeError('createAuditEntry requires a Prisma transaction with auditLog.create().');
  }

  return tx.auditLog.create({
    data: {
      actorUserId,
      action,
      resourceType,
      resourceId,
      before: before == null ? null : sanitizeAuditPayload(before),
      after: after == null ? null : sanitizeAuditPayload(after),
      requestId,
      metadata: metadata == null ? null : sanitizeAuditPayload(metadata),
    },
  });
}
