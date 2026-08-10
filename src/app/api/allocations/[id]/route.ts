import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { recordUserCorrection } from '@/lib/learning';
import { refreshWorkSessionTotals } from '@/lib/work-sessions';
import { z } from 'zod';

const allocationTypes = [
  'work_item',
  'meeting',
  'pr_review',
  'general_engineering',
  'admin',
  'unallocated',
] as const;

const allocationPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    workItemId: z.string().cuid().nullable().optional(),
    allocationType: z.enum(allocationTypes).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const parsed = allocationPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid allocation update' }, { status: 400 });
    }
    const existing = await prisma.allocation.findUnique({
      where: { id },
      include: { workSession: true },
    });

    if (!existing || existing.workSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    const { title, workItemId, allocationType } = parsed.data;
    const nextAllocationType = allocationType ?? existing.allocationType;
    let nextWorkItemId = workItemId === undefined ? existing.workItemId : workItemId;

    if (nextAllocationType === 'unallocated') {
      nextWorkItemId = null;
    } else if (nextWorkItemId) {
      const workItem = await prisma.workItem.findUnique({ where: { id: nextWorkItemId } });
      if (!workItem || workItem.userId !== session.user.id) {
        return NextResponse.json({ error: 'Work item not found' }, { status: 404 });
      }
    }

    const updated = await prisma.allocation.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        workItemId: nextWorkItemId,
        allocationType: nextAllocationType,
        isUserModified: true,
        status: 'edited',
      },
      include: {
        workItem: true,
        evidence: true,
      },
    });

    // Record user correction for learning system
    await recordUserCorrection({
      userId: session.user.id,
      allocationId: id,
      correctionType: 'reassign',
      originalData: existing,
      correctedData: updated,
    });

    await refreshWorkSessionTotals(existing.workSessionId);

    return NextResponse.json({ allocation: updated });
  } catch (error: unknown) {
    console.error('Error updating allocation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.allocation.findUnique({
      where: { id },
      include: { workSession: true },
    });
    if (!existing || existing.workSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    // Deletion must not create a hole in the workday. Retain the interval as explicit unknown time.
    const updated = await prisma.allocation.update({
      where: { id },
      data: {
        allocationType: 'unallocated',
        workItemId: null,
        title: 'Unallocated Time',
        description: 'Marked unallocated by the user.',
        confidence: 0,
        confidenceLevel: 'needs_review',
        status: 'edited',
        isUserModified: true,
      },
    });

    await recordUserCorrection({
      userId: session.user.id,
      allocationId: id,
      correctionType: 'delete',
      originalData: existing,
      correctedData: updated,
    });
    await refreshWorkSessionTotals(existing.workSessionId);

    return NextResponse.json({ allocation: updated });
  } catch (error: unknown) {
    console.error('Error leaving allocation unallocated:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
