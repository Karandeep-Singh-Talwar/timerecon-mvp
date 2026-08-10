import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { generateTimesheet } from '@/lib/export';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    const targetDate = new Date(`${date}T00:00:00.000Z`);
    let timesheet = await prisma.timesheet.findFirst({
      where: {
        userId: session.user.id,
        date: targetDate,
      },
      include: {
        entries: true,
      },
    });

    return NextResponse.json({ timesheet });
  } catch (error: any) {
    console.error('Error fetching timesheet:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { workSessionId } = body;

    if (!workSessionId) {
      return NextResponse.json({ error: 'Missing workSessionId' }, { status: 400 });
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
        { error: 'Approve or correct every allocation before generating a timesheet.' },
        { status: 409 }
      );
    }

    const timesheet = await generateTimesheet(workSessionId);
    return NextResponse.json({ timesheet });
  } catch (error: unknown) {
    console.error('Error generating timesheet:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
