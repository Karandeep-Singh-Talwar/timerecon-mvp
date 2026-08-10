import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const updated = await prisma.allocation.update({
      where: { id },
      data: {
        status: 'approved',
        isUserModified: true,
      },
      include: {
        workItem: true,
        evidence: true,
      },
    });

    return NextResponse.json({ allocation: updated });
  } catch (error: any) {
    console.error('Error approving allocation:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
