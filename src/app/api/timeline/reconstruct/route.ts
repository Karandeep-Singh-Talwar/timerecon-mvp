import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { reconstructWorkday } from '@/lib/allocation';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const date = body.date || new Date().toISOString().split('T')[0];

    const workSession = await reconstructWorkday({
      userId: session.user.id,
      date,
      force: true,
    });

    return NextResponse.json({ workSession });
  } catch (error: any) {
    console.error('Error reconstructing timeline:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
