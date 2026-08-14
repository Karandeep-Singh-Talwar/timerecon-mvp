import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const patchSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
    workingHoursStart: z.string().regex(TIME_RE, 'Invalid start time').optional(),
    workingHoursEnd: z.string().regex(TIME_RE, 'Invalid end time').optional(),
  })
  .strict();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      timezone: true,
      workingHoursStart: true,
      workingHoursEnd: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ profile: user });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid profile update' },
      { status: 400 }
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      email: true,
      timezone: true,
      workingHoursStart: true,
      workingHoursEnd: true,
    },
  });

  return NextResponse.json({ profile: updated });
}
