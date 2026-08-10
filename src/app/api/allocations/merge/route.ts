import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { recordUserCorrection } from '@/lib/learning';
import { z } from 'zod';

const mergeSchema = z.object({
  allocationId1: z.string().cuid(),
  allocationId2: z.string().cuid(),
}).refine((value) => value.allocationId1 !== value.allocationId2, 'Allocations must be different');

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = mergeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid allocation merge request' }, { status: 400 });
    }
    const { allocationId1, allocationId2 } = parsed.data;

    const alloc1 = await prisma.allocation.findUnique({
      where: { id: allocationId1 },
      include: { workSession: true },
    });

    const alloc2 = await prisma.allocation.findUnique({
      where: { id: allocationId2 },
      include: { workSession: true },
    });

    if (
      !alloc1 ||
      !alloc2 ||
      alloc1.workSession.userId !== session.user.id ||
      alloc2.workSession.userId !== session.user.id ||
      alloc1.workSessionId !== alloc2.workSessionId
    ) {
      return NextResponse.json({ error: 'Allocations not found or not in same session' }, { status: 404 });
    }

    const [first, second] = alloc1.startTime <= alloc2.startTime ? [alloc1, alloc2] : [alloc2, alloc1];
    if (first.endTime.getTime() !== second.startTime.getTime()) {
      return NextResponse.json({ error: 'Only adjacent allocations can be merged.' }, { status: 400 });
    }
    if (first.allocationType !== second.allocationType || first.workItemId !== second.workItemId) {
      return NextResponse.json({ error: 'Reassign allocations to the same category before merging.' }, { status: 400 });
    }

    const merged = await prisma.$transaction(async (tx) => {
      const updated = await tx.allocation.update({
        where: { id: alloc1.id },
        data: {
          startTime: first.startTime,
          endTime: second.endTime,
          durationMinutes: first.durationMinutes + second.durationMinutes,
          status: 'merged',
          isUserModified: true,
        },
        include: {
          workItem: true,
          evidence: true,
        },
      });
      await tx.allocationEvidence.updateMany({
        where: { allocationId: alloc2.id },
        data: { allocationId: alloc1.id },
      });
      await tx.allocation.delete({ where: { id: alloc2.id } });
      return updated;
    });

    await recordUserCorrection({
      userId: session.user.id,
      allocationId: alloc1.id,
      correctionType: 'merge',
      originalData: { alloc1, alloc2 },
      correctedData: merged,
    });

    return NextResponse.json({ allocation: merged });
  } catch (error: unknown) {
    console.error('Error merging allocations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
