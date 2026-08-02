function normalizeEmail(email) {
  const trimmed = typeof email === 'string' ? email.trim() : '';
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizeClaims(claims) {
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
    return claims ?? null;
  }

  return Object.fromEntries(
    Object.entries(claims).filter(([, value]) => value !== undefined),
  );
}

export class IdentityProvider {
  constructor({
    source = 'MANUAL',
    provisioner = null,
    syncer = null,
  } = {}) {
    this.source = source;
    this.provisioner = provisioner;
    this.syncer = syncer;
  }

  resolveExternalIdentity(input = {}) {
    const providerSubject = input.providerSubject ?? input.subject ?? null;

    return {
      source: input.source ?? this.source,
      providerSubject,
      email: input.email?.trim?.() ?? null,
      normalizedEmail: normalizeEmail(input.email),
      displayName: input.displayName?.trim?.() ?? input.name?.trim?.() ?? null,
      metadata: normalizeClaims(input.metadata),
      claims: normalizeClaims(input.claims),
    };
  }

  async provisionOrLinkIdentity(input = {}) {
    const identity = this.resolveExternalIdentity(input);

    if (!this.provisioner) {
      return identity;
    }

    return this.provisioner(identity, input);
  }

  async syncIdentity(userId) {
    if (!this.syncer) {
      return { userId, source: this.source, synced: false };
    }

    return this.syncer(userId);
  }
}
