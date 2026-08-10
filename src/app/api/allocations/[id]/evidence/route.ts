import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const allocation = await prisma.allocation.findUnique({
      where: { id },
      include: {
        workSession: true,
        evidence: {
          include: {
            normalizedEvent: true,
          },
        },
      },
    });

    if (!allocation || allocation.workSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    return NextResponse.json({ evidence: allocation.evidence });
  } catch (error: any) {
    console.error('Error fetching allocation evidence:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
