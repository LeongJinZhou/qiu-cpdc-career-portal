import { z } from 'zod';

export const SETTINGS_STORAGE_KEY = 'qiu.settings';
export const PLATFORM_SETTINGS_KEY = 'platform.settings';

export const DEFAULT_SETTINGS = {
  featureToggles: {
    dashboard: true,
    fyp: true,
    logbook: true,
    workshops: true,
    learning: true,
    diagnostics: true,
    cv: true,
    'ai-suite': true,
    network: true,
    employers: true,
    admin: true,
    'career-path': true,
    talent: true,
    help: true,
    settings: true,
  },

  gamification: {
    xpValues: {
      WORKSHOP: 150,
      COURSE: 300,
      FYP: 250,
      LOGBOOK: 50,
      DIAGNOSTIC: 150,
    },
    tiers: [
      { name: 'Novice', min: 0 },
      { name: 'Bronze', min: 500 },
      { name: 'Silver', min: 1500 },
      { name: 'Gold', min: 3500 },
      { name: 'Platinum', min: 7000 },
      { name: 'Diamond', min: 12000 },
    ],
    leaderboard: 'optin',
  },

  matchWeights: {
    faculty: 40,
    programme: 30,
    year: 20,
    interest: 10,
  },

  approvals: {
    fyp: 'manual',
    course: 'auto',
    logbook: 'manual',
  },

  visibility: {
    resume: 'private',
    fyp: 'public',
    logbook: 'private',
  },

  customRoles: [],
};

export const CAPABILITIES = [
  { id: 'publish_events', label: 'Publish events' },
  { id: 'view_analytics', label: 'View analytics' },
  { id: 'approve_fyp', label: 'Approve FYP' },
  { id: 'approve_logbook', label: 'Approve logbook hours' },
  { id: 'manage_employers', label: 'Manage employer accounts' },
  { id: 'override_records', label: 'Override student records' },
  { id: 'issue_badges', label: 'Issue badges & XP' },
  { id: 'export_data', label: 'Export platform data' },
];

const tiersSchema = z.array(z.object({
  name: z.string().trim().min(1, 'gamification.tiers.name is required'),
  min: z.coerce.number().int('gamification.tiers.min must be an integer').min(0, 'gamification.tiers.min must be non-negative'),
}));

const customRoleSchema = z.object({
  name: z.string().trim().min(1, 'customRoles.name is required'),
  capabilities: z.array(z.string().trim().min(1, 'customRoles.capabilities entry is required')),
});

export const settingsSchema = z.object({
  featureToggles: z.record(z.string(), z.boolean()),
  gamification: z.object({
    xpValues: z.record(
      z.string(),
      z.coerce.number().int('gamification.xpValues must contain integers').min(0, 'gamification.xpValues must be non-negative'),
    ),
    tiers: tiersSchema,
    leaderboard: z.enum(['off', 'optin', 'on']),
  }),
  matchWeights: z.object({
    faculty: z.coerce.number().min(0, 'matchWeights.faculty must be non-negative'),
    programme: z.coerce.number().min(0, 'matchWeights.programme must be non-negative'),
    year: z.coerce.number().min(0, 'matchWeights.year must be non-negative'),
    interest: z.coerce.number().min(0, 'matchWeights.interest must be non-negative'),
  }),
  approvals: z.object({
    fyp: z.enum(['auto', 'manual']),
    course: z.enum(['auto', 'manual']),
    logbook: z.enum(['auto', 'manual']),
  }),
  visibility: z.object({
    resume: z.enum(['public', 'optin', 'private']),
    fyp: z.enum(['public', 'optin', 'private']),
    logbook: z.enum(['public', 'optin', 'private']),
  }),
  customRoles: z.array(customRoleSchema),
});

export function withDefaults(stored) {
  if (!stored || typeof stored !== 'object') return structuredClone(DEFAULT_SETTINGS);
  return {
    featureToggles: { ...DEFAULT_SETTINGS.featureToggles, ...(stored.featureToggles ?? {}) },
    gamification: {
      ...DEFAULT_SETTINGS.gamification,
      ...(stored.gamification ?? {}),
      xpValues: {
        ...DEFAULT_SETTINGS.gamification.xpValues,
        ...(stored.gamification?.xpValues ?? {}),
      },
      tiers: Array.isArray(stored.gamification?.tiers)
        ? stored.gamification.tiers
        : DEFAULT_SETTINGS.gamification.tiers,
    },
    matchWeights: { ...DEFAULT_SETTINGS.matchWeights, ...(stored.matchWeights ?? {}) },
    approvals: { ...DEFAULT_SETTINGS.approvals, ...(stored.approvals ?? {}) },
    visibility: { ...DEFAULT_SETTINGS.visibility, ...(stored.visibility ?? {}) },
    customRoles: Array.isArray(stored.customRoles) ? stored.customRoles : [],
  };
}

export function validateSettings(input) {
  try {
    return settingsSchema.parse(withDefaults(input));
  } catch (error) {
    if (error?.name === 'ZodError') {
      const firstIssue = error.issues?.[0];
      const fieldPath = firstIssue?.path?.join('.') ?? 'settings';
      const message = firstIssue?.message
        ? `${fieldPath}: ${firstIssue.message}`
        : 'Invalid settings payload.';
      const typedError = new Error(message);
      typedError.status = 400;
      typedError.code = 'INVALID_SETTINGS_PAYLOAD';
      typedError.details = error.issues;
      throw typedError;
    }

    throw error;
  }
}
