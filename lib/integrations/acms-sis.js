import { z } from 'zod';

const DEFAULT_TIMEOUT_MS = 8000;

export class NotConfiguredIntegrationError extends Error {
  constructor(message = 'ACMS/SIS integration is not configured.') {
    super(message);
    this.name = 'NotConfiguredIntegrationError';
    this.code = 'NOT_CONFIGURED';
    this.status = 503;
  }
}

const identityRequestSchema = z.object({
  studentId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
}).refine((value) => value.studentId || value.email, {
  message: 'studentId or email is required.',
});

const identityResponseSchema = z.object({
  studentId: z.string().trim().min(1),
  name: z.string().trim().min(1).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  facultyId: z.string().trim().min(1).nullable().optional(),
  programmeId: z.string().trim().min(1).nullable().optional(),
  intakeYearMonth: z.number().int().nullable().optional(),
  source: z.string().trim().min(1).optional(),
  raw: z.unknown().optional(),
});

const syncRequestSchema = z.object({
  studentId: z.string().trim().min(1),
  records: z.array(z.object({
    type: z.string().trim().min(1),
    payload: z.unknown(),
  })),
});

const syncResponseSchema = z.object({
  accepted: z.boolean(),
  syncedCount: z.number().int().min(0),
  source: z.string().trim().min(1).optional(),
  raw: z.unknown().optional(),
});

function getConfig(env = process.env) {
  const provider = String(env.ACMS_SIS_PROVIDER ?? 'not-configured').trim() || 'not-configured';
  const endpoint = String(env.ACMS_SIS_ENDPOINT ?? '').trim();
  const enabled = String(env.ACMS_SIS_ENABLED ?? 'false').trim().toLowerCase() === 'true';
  const configured = enabled && provider !== 'not-configured' && endpoint.length > 0;

  return {
    provider,
    endpoint,
    enabled,
    configured,
  };
}

function notConfiguredResult(operation, config) {
  return {
    ok: false,
    error: {
      code: 'NOT_CONFIGURED',
      message: 'ACMS/SIS integration is not configured for this environment.',
      operation,
    },
    provider: config.provider,
  };
}

function normalizeConfiguredStatus(config) {
  if (!config.configured) {
    return {
      configured: false,
      enabled: config.enabled,
      provider: config.provider,
      endpoint: config.endpoint || null,
      code: 'NOT_CONFIGURED',
    };
  }

  return {
    configured: true,
    enabled: true,
    provider: config.provider,
    endpoint: config.endpoint,
    code: 'CONFIGURED',
  };
}

function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

async function postJson(path, payload, {
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const config = getConfig(env);
  if (!config.configured) {
    return notConfiguredResult(path, config);
  }

  const { signal, cleanup } = createAbortSignal(timeoutMs);

  try {
    const response = await fetchImpl(`${config.endpoint}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: 'UPSTREAM_ERROR',
          message: `ACMS/SIS returned HTTP ${response.status}.`,
          status: response.status,
        },
        provider: config.provider,
      };
    }

    const data = await response.json();
    return {
      ok: true,
      data,
      provider: config.provider,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        ok: false,
        error: {
          code: 'TIMEOUT',
          message: `ACMS/SIS did not respond within ${timeoutMs}ms.`,
        },
        provider: config.provider,
      };
    }

    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error?.message ?? 'ACMS/SIS request failed.',
      },
      provider: config.provider,
    };
  } finally {
    cleanup();
  }
}

export function getIntegrationStatus({ env = process.env } = {}) {
  return normalizeConfiguredStatus(getConfig(env));
}

export async function resolveStudentIdentity(input, options = {}) {
  const parsedInput = identityRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: parsedInput.error.issues?.[0]?.message ?? 'Invalid identity lookup request.',
      },
    };
  }

  const result = await postJson('/identity/resolve', parsedInput.data, options);
  if (!result.ok) {
    return result;
  }

  const parsedResponse = identityResponseSchema.safeParse(result.data);
  if (!parsedResponse.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: parsedResponse.error.issues?.[0]?.message ?? 'Invalid ACMS/SIS identity response.',
      },
      provider: result.provider,
    };
  }

  return {
    ok: true,
    provider: result.provider,
    data: {
      studentId: parsedResponse.data.studentId,
      name: parsedResponse.data.name ?? null,
      email: parsedResponse.data.email ?? null,
      facultyId: parsedResponse.data.facultyId ?? null,
      programmeId: parsedResponse.data.programmeId ?? null,
      intakeYearMonth: parsedResponse.data.intakeYearMonth ?? null,
      source: parsedResponse.data.source ?? result.provider,
      raw: parsedResponse.data.raw ?? null,
    },
  };
}

export async function syncCareerRecords(input, options = {}) {
  const parsedInput = syncRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: parsedInput.error.issues?.[0]?.message ?? 'Invalid career sync request.',
      },
    };
  }

  const result = await postJson('/career/sync', parsedInput.data, options);
  if (!result.ok) {
    return result;
  }

  const parsedResponse = syncResponseSchema.safeParse(result.data);
  if (!parsedResponse.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: parsedResponse.error.issues?.[0]?.message ?? 'Invalid ACMS/SIS sync response.',
      },
      provider: result.provider,
    };
  }

  return {
    ok: true,
    provider: result.provider,
    data: {
      accepted: parsedResponse.data.accepted,
      syncedCount: parsedResponse.data.syncedCount,
      source: parsedResponse.data.source ?? result.provider,
      raw: parsedResponse.data.raw ?? null,
    },
  };
}
