'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  CAPABILITIES,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  withDefaults,
} from './settings/shared.js';

const INITIAL_SCOPE = {
  type: 'PLATFORM',
  value: 'GLOBAL',
};

let settingsState = {
  settings: structuredClone(DEFAULT_SETTINGS),
  scope: INITIAL_SCOPE,
  version: 0,
  updatedAt: null,
  loading: true,
  saving: false,
  error: null,
  conflict: null,
  source: 'fallback',
};

let activeLoadPromise = null;
const listeners = new Set();

function emit(nextState) {
  settingsState = nextState;
  for (const listener of listeners) {
    listener(settingsState);
  }
}

function updateState(patch) {
  emit({
    ...settingsState,
    ...patch,
  });
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalizePayload(payload) {
  return {
    settings: withDefaults(payload?.settings ?? DEFAULT_SETTINGS),
    scope: payload?.scope ?? INITIAL_SCOPE,
    version: Number(payload?.version ?? 0) || 0,
    updatedAt: payload?.updatedAt ?? null,
  };
}

function makeRouteError(message, status, current = null) {
  const error = new Error(message);
  error.status = status;
  error.current = current;
  return error;
}

async function fetchSettings() {
  const response = await fetch('/api/admin/settings', {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
    credentials: 'same-origin',
    cache: 'no-store',
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw makeRouteError(
      payload?.error ?? 'Unable to load platform settings.',
      response.status,
      payload?.current ?? null,
    );
  }

  return normalizePayload(payload);
}

export async function reloadSettings() {
  if (activeLoadPromise) {
    return activeLoadPromise;
  }

  updateState({
    loading: true,
    error: null,
    conflict: null,
  });

  activeLoadPromise = (async () => {
    try {
      const payload = await fetchSettings();
      updateState({
        ...payload,
        loading: false,
        saving: false,
        error: null,
        conflict: null,
        source: 'server',
      });
      return payload.settings;
    } catch (error) {
      updateState({
        loading: false,
        saving: false,
        error: error.message ?? 'Unable to load platform settings.',
        conflict: null,
        source: 'fallback',
      });
      throw error;
    } finally {
      activeLoadPromise = null;
    }
  })();

  return activeLoadPromise;
}

async function ensureLoaded() {
  if (!settingsState.loading && settingsState.source === 'server') {
    return settingsState.settings;
  }

  try {
    return await reloadSettings();
  } catch {
    return settingsState.settings;
  }
}

async function persistSettings(nextSettings) {
  updateState({
    saving: true,
    error: null,
    conflict: null,
  });

  const response = await fetch('/api/admin/settings', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      scope: settingsState.scope,
      expectedVersion: settingsState.version,
      expectedUpdatedAt: settingsState.updatedAt,
      settings: nextSettings,
    }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    const current = payload?.current ? normalizePayload(payload.current) : null;

    if (response.status === 409 && current) {
      updateState({
        ...current,
        loading: false,
        saving: false,
        error: null,
        conflict: payload?.error ?? 'Settings changed elsewhere. The latest server version has been loaded.',
        source: 'server',
      });
    } else {
      updateState({
        loading: false,
        saving: false,
        error: payload?.error ?? 'Unable to save platform settings.',
      });
    }

    throw makeRouteError(
      payload?.error ?? 'Unable to save platform settings.',
      response.status,
      current,
    );
  }

  const normalized = normalizePayload(payload);
  updateState({
    ...normalized,
    loading: false,
    saving: false,
    error: null,
    conflict: null,
    source: 'server',
  });

  return normalized.settings;
}

export function useSettings() {
  const [localState, setLocalState] = useState(settingsState);

  useEffect(() => subscribe(setLocalState), []);
  useEffect(() => {
    void ensureLoaded();
  }, []);

  const updateSettings = useCallback(async (patchFn) => {
    const base = await ensureLoaded();
    const next = withDefaults(
      typeof patchFn === 'function' ? patchFn(base) : patchFn,
    );
    return persistSettings(next);
  }, []);

  return [localState.settings, updateSettings];
}

export function useSettingsState() {
  const [localState, setLocalState] = useState(settingsState);

  useEffect(() => subscribe(setLocalState), []);
  useEffect(() => {
    void ensureLoaded();
  }, []);

  return {
    ...localState,
    reloadSettings,
  };
}

export {
  CAPABILITIES,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
};
