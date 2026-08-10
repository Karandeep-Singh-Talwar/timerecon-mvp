import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { reconstructWorkday } from '@/lib/allocation';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    const targetDate = new Date(`${date}T00:00:00.000Z`);
    let workSession = await prisma.workSession.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date: targetDate,
        },
      },
      include: {
        allocations: {
          orderBy: { startTime: 'asc' },
          include: {
            workItem: true,
            evidence: {
              include: {
                normalizedEvent: true,
              },
            },
          },
        },
      },
    });

    if (!workSession) {
      workSession = await reconstructWorkday({
        userId: session.user.id,
        date,
      });
    }

    const workItems = await prisma.workItem.findMany({
      where: { userId: session.user.id },
      select: { id: true, externalId: true, title: true, project: true },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ workSession, workItems });
  } catch (error: any) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
