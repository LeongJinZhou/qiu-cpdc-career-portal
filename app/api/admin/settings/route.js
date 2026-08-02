import { NextResponse } from 'next/server';

import {
  getAuthenticatedIdentity,
  getRequestId,
  parseJsonBody,
} from '@/lib/auth/identity';
import { resolveActor } from '@/lib/auth/actor';
import {
  getAdminSettings,
  parseSettingsScopeFromSearchParams,
  toSettingsRouteError,
  updateAdminSettings,
} from '@/lib/settings/policy';

export async function GET(request) {
  try {
    // Every signed-in user (and the seeded student in demo) may READ platform
    // settings — the client needs feature toggles to enforce module visibility
    // (Module 15). Writes stay admin-gated in PATCH/PUT below. For PLATFORM
    // scope getAdminSettings only requires an identity with a user id, so a
    // demo actor's synthesized identity is sufficient and safe.
    const actor = await resolveActor(request, { allowNonStudent: true });
    const identity = actor.identity ?? {
      user: { id: actor.user.id, role: actor.role },
      role: actor.role,
      assignments: [],
    };
    const scope = parseSettingsScopeFromSearchParams(new URL(request.url).searchParams);
    const result = await getAdminSettings({ identity, scope });
    return NextResponse.json(result);
  } catch (error) {
    const routeError = toSettingsRouteError(error);
    return NextResponse.json(
      {
        error: routeError.message,
        code: routeError.code,
        current: routeError.current,
      },
      { status: routeError.status },
    );
  }
}

async function writeSettings(request) {
  const identity = await getAuthenticatedIdentity(request);
  const url = new URL(request.url);
  const queryScope = parseSettingsScopeFromSearchParams(url.searchParams);
  const body = await parseJsonBody(request);
  const scope = body?.scope ? {
    type: body.scope.type ?? queryScope.type,
    value: body.scope.value ?? queryScope.value,
  } : queryScope;

  const result = await updateAdminSettings({
    identity,
    scope,
    input: body,
    requestId: getRequestId(request),
  });

  return NextResponse.json(result);
}

export async function PATCH(request) {
  try {
    return await writeSettings(request);
  } catch (error) {
    const routeError = toSettingsRouteError(error);
    return NextResponse.json(
      {
        error: routeError.message,
        code: routeError.code,
        current: routeError.current,
      },
      { status: routeError.status },
    );
  }
}

export async function PUT(request) {
  try {
    return await writeSettings(request);
  } catch (error) {
    const routeError = toSettingsRouteError(error);
    return NextResponse.json(
      {
        error: routeError.message,
        code: routeError.code,
        current: routeError.current,
      },
      { status: routeError.status },
    );
  }
}
