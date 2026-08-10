import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

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

    const workSession = await prisma.workSession.findUnique({
      where: { id: workSessionId },
    });

    if (!workSession || workSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'WorkSession not found' }, { status: 404 });
    }

    const result = await prisma.allocation.updateMany({
      where: {
        workSessionId,
        confidenceLevel: 'high',
        status: { not: 'approved' },
      },
      data: {
        status: 'approved',
        isUserModified: true,
      },
    });

    return NextResponse.json({ approvedCount: result.count });
  } catch (error: any) {
    console.error('Error approving all allocations:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
