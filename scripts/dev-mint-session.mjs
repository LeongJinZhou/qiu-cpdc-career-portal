// Local debugging only: mints a genuine signed session cookie by stubbing the
// Google ID-token verification step. Everything downstream (allowlist check,
// authorizeSessionUser, cookie signing with the real SESSION_SECRET) runs for
// real, so this exercises the true session path without a Google credential.

import { PrismaClient } from '@prisma/client';
import { createSessionCookie } from '../lib/auth/session.js';

const prisma = new PrismaClient();
const email = process.argv[2];

const cookie = await createSessionCookie('stub', {
  prisma,
  verifyGoogleIdToken: async () => ({
    email,
    emailVerified: true,
    name: email.split('@')[0],
    uid: 'local-debug-' + email,
    firebaseUid: 'local-debug-' + email,
    picture: null,
    signInProvider: 'google.com',
  }),
});
console.log(`${cookie.name}=${cookie.value}`);
await prisma.$disconnect();
