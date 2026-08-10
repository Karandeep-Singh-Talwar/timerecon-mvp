import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { recordUserCorrection } from '@/lib/learning';
import { z } from 'zod';

const splitSchema = z.object({
  splitTimestamp: z.string().datetime().optional(),
  durationFirstMinutes: z.number().int().positive().optional(),
}).refine((value) => !(value.splitTimestamp && value.durationFirstMinutes), {
  message: 'Specify a timestamp or duration, not both.',
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const parsed = splitSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid split request' }, { status: 400 });
    }
    const existing = await prisma.allocation.findUnique({
      where: { id },
      include: {
        workSession: true,
        evidence: {
          include: { normalizedEvent: true },
        },
      },
    });

    if (!existing || existing.workSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    const { splitTimestamp, durationFirstMinutes } = parsed.data;

    let splitTime: Date;
    if (splitTimestamp) {
      splitTime = new Date(splitTimestamp);
    } else if (durationFirstMinutes !== undefined) {
      splitTime = new Date(existing.startTime.getTime() + durationFirstMinutes * 60000);
    } else {
      // Default split at midpoint
      const midMs = (existing.startTime.getTime() + existing.endTime.getTime()) / 2;
      splitTime = new Date(midMs);
    }

    if (splitTime <= existing.startTime || splitTime >= existing.endTime) {
      return NextResponse.json({ error: 'Invalid split time range' }, { status: 400 });
    }

    const duration1 = Math.round((splitTime.getTime() - existing.startTime.getTime()) / 60000);
    const duration2 = Math.round((existing.endTime.getTime() - splitTime.getTime()) / 60000);

    const { firstPart, secondPart } = await prisma.$transaction(async (tx) => {
      const firstPart = await tx.allocation.update({
        where: { id },
        data: {
          endTime: splitTime,
          durationMinutes: duration1,
          status: 'split',
          isUserModified: true,
        },
      });
      const secondPart = await tx.allocation.create({
        data: {
          workSessionId: existing.workSessionId,
          startTime: splitTime,
          endTime: existing.endTime,
          durationMinutes: duration2,
          allocationType: existing.allocationType,
          workItemId: existing.workItemId,
          title: `${existing.title} (Part 2)`,
          description: existing.description,
          confidence: existing.confidence,
          confidenceLevel: existing.confidenceLevel,
          status: 'split',
          isUserModified: true,
          sortOrder: existing.sortOrder + 1,
        },
      });

      const evidenceToMove = existing.evidence
        .filter((evidence) => evidence.normalizedEvent.occurredAt >= splitTime)
        .map((evidence) => evidence.id);
      if (evidenceToMove.length > 0) {
        await tx.allocationEvidence.updateMany({
          where: { id: { in: evidenceToMove } },
          data: { allocationId: secondPart.id },
        });
      }
      return { firstPart, secondPart };
    });

    await recordUserCorrection({
      userId: session.user.id,
      allocationId: id,
      correctionType: 'split',
      originalData: existing,
      correctedData: { firstPart, secondPart },
    });

    return NextResponse.json({ firstPart, secondPart });
  } catch (error: unknown) {
    console.error('Error splitting allocation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
