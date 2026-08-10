import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { generateTimesheet } from '@/lib/export';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    let workSessionId = body.workSessionId;

    if (!workSessionId && body.date) {
      const targetDate = new Date(`${body.date}T00:00:00.000Z`);
      const foundSession = await prisma.workSession.findUnique({
        where: {
          userId_date: {
            userId: session.user.id,
            date: targetDate,
          },
        },
      });
      if (foundSession) {
        workSessionId = foundSession.id;
      }
    }

    if (!workSessionId) {
      return NextResponse.json({ error: 'WorkSession not found' }, { status: 404 });
    }

    const workSession = await prisma.workSession.findUnique({ where: { id: workSessionId } });
    if (!workSession || workSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'WorkSession not found' }, { status: 404 });
    }

    const unapprovedAllocations = await prisma.allocation.findMany({
      where: { workSessionId, status: { not: 'approved' } },
      select: { id: true },
    });
    if (unapprovedAllocations.length > 0) {
      return NextResponse.json(
        { error: 'Approve or correct every allocation before submitting.', pendingAllocations: unapprovedAllocations.length },
        { status: 409 }
      );
    }

    const timesheet = await generateTimesheet(workSessionId);
    return NextResponse.json({ timesheet });
  } catch (error: unknown) {
    console.error('Error submitting review:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
