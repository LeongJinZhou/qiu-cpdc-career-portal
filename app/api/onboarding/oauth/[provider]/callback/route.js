import { NextResponse } from 'next/server';

import { resolveActor } from '@/lib/auth/actor';
import { getRequestId } from '@/lib/auth/identity';
import { OAUTH_PROVIDERS, fetchOAuthProfile, isConfigured, verifyState } from '@/lib/onboarding/oauth';
import { connectAccountByOAuth } from '@/lib/onboarding/service';
import { fetchProfilePhotoDataUrl } from '@/lib/onboarding/profile-photo';
import { prisma } from '@/lib/prisma';
import { createAuditEntry } from '@/lib/audit/index.js';

/**
 * GET /api/onboarding/oauth/:provider/callback
 *
 * Always redirects back to /onboarding with a readable status in the query
 * string — a student who declines consent, or hits a provider outage, must land
 * back in the flow with an explanation, never on a JSON error page.
 */
function back(request, params) {
  const url = new URL('/onboarding', new URL(request.url).origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, String(value));
  });
  return NextResponse.redirect(url);
}

export async function GET(request, { params }) {
  const providerId = String((await params).provider ?? '').toUpperCase();
  const query = new URL(request.url).searchParams;

  try {
    if (!OAUTH_PROVIDERS[providerId] || !isConfigured(providerId)) {
      return back(request, { connectError: 'That sign-in method is not available.' });
    }

    // The student pressed "Cancel" on the provider's consent screen. The
    // provider's error_description is never echoed: anyone can craft this URL,
    // so reflecting it would let a phishing link put their text on our page.
    if (query.get('error')) {
      console.warn(`[oauth:${providerId}] provider returned error`, query.get('error'));
      return back(request, { connectError: 'You cancelled the connection.' });
    }

    const actor = await resolveActor(request);
    const code = query.get('code');
    const state = query.get('state');

    // State is bound to this student and signed, so a callback captured from
    // another session cannot attach that account here.
    if (!code || !verifyState(state, actor.student.id)) {
      return back(request, {
        connectError: 'That connection link expired or did not match your session. Please try again.',
      });
    }

    const profile = await fetchOAuthProfile(providerId, code, request);

    if (!profile.providerUserId) {
      return back(request, { connectError: `${providerId} did not return an account id.` });
    }

    try {
      await connectAccountByOAuth(actor.student.id, providerId, {
        profileUrl: profile.profileUrl,
        handle: profile.handle,
        providerUserId: profile.providerUserId,
        rawProfile: profile.raw,
        actorUserId: actor.user.id,
        requestId: getRequestId(request),
      });
    } catch (connectError) {
      if (connectError?.code === 'OAUTH_RETRY') {
        return back(request, { connectError: 'That took two tries at once. Please sign in again.' });
      }
      if (connectError?.code === 'OAUTH_ACCOUNT_IN_USE') {
        return back(request, { connectError: `That ${providerId === 'LINKEDIN' ? 'LinkedIn' : 'GitHub'} account is already linked to another QIU student. Sign in with your own account.` });
      }
      throw connectError;
    }

    // Alumni contact: the address LinkedIn verified, kept after the QIU email closes.
    if (providerId === 'LINKEDIN') {
      await prisma.$transaction(async (tx) => {
        const before = await tx.user.findUnique({ where: { id: actor.user.id }, select: { personalEmail: true } });
        await tx.user.update({
          where: { id: actor.user.id },
          data: {
            linkedinLastSeenAt: new Date(),
            ...(profile.verifiedEmail ? { personalEmail: profile.verifiedEmail } : {}),
          },
        });
        if (profile.verifiedEmail && profile.verifiedEmail !== before?.personalEmail) {
          // Audit that it changed, never the address itself.
          await createAuditEntry({
            tx,
            actorUserId: actor.user.id,
            action: 'PERSONAL_EMAIL_UPDATED',
            resourceType: 'User',
            resourceId: actor.user.id,
            metadata: { source: 'LINKEDIN', hadPrevious: Boolean(before?.personalEmail) },
            requestId: getRequestId(request),
          });
        }
      });
    }

    // The LinkedIn photo becomes the profile picture, stored as our own copy
    // (LinkedIn's links expire). A photo the student uploaded themselves is
    // never replaced, and a failed copy never fails the connection.
    // The connection is already saved: a photo failure is logged, never shown
    // to the student as a failed connection.
    if (providerId === 'LINKEDIN' && profile.pictureUrl) {
      try {
        const current = await prisma.user.findUnique({
          where: { id: actor.user.id },
          select: { avatarSource: true },
        });
        const photo = current?.avatarSource === 'CUSTOM' ? null : await fetchProfilePhotoDataUrl(profile.pictureUrl);
        if (photo) {
          // Guarded write: a photo uploaded while LinkedIn was being fetched wins.
          await prisma.user.updateMany({
            where: { id: actor.user.id, avatarSource: { not: 'CUSTOM' } },
            data: { avatarUrl: photo, avatarSource: 'LINKEDIN' },
          });
        }
      } catch (photoError) {
        console.warn('[oauth:LINKEDIN] photo copy failed', photoError?.name ?? 'Error');
      }
    }

    // LinkedIn verifies the person but cannot hand over the public URL, so the
    // flow tells the student exactly what is still needed rather than showing a
    // green tick over an incomplete connection.
    return back(request, {
      connected: providerId,
      needsUrl: OAUTH_PROVIDERS[providerId].yieldsProfileUrl ? null : providerId,
    });
  } catch (error) {
    console.error(`[oauth:${providerId}] callback failed`, error);
    return back(request, {
      connectError: 'We could not complete that connection. Please try again, or paste your profile link.',
    });
  }
}
