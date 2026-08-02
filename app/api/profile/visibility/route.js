import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { resolveActor, requireStudentActor } from '@/lib/auth/actor';
import { toIdentityRouteError, parseJsonBody } from '@/lib/auth/identity';

const schema = z.object({ searchable: z.boolean() });

/** The acting student's employer-search visibility (Module 11 privacy control). */
export async function GET(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    return NextResponse.json({ searchable: Boolean(actor.student.searchable) });
  } catch (error) {
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}

/** Opt in/out of the public employer talent search. Defaults to hidden. */
export async function PATCH(request) {
  try {
    const actor = requireStudentActor(await resolveActor(request));
    const { searchable } = schema.parse(await parseJsonBody(request));
    await prisma.student.update({ where: { id: actor.student.id }, data: { searchable } });
    return NextResponse.json({ searchable });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'searchable must be a boolean.' }, { status: 400 });
    }
    const e = toIdentityRouteError(error);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}
