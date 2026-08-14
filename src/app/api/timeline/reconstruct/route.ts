import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { reconstructWorkday } from '@/lib/allocation';
import { useTemporalJobs } from '@/temporal/config';
import { startWorkdayReconstruct } from '@/temporal/client';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const date = body.date || new Date().toISOString().split('T')[0];

    if (useTemporalJobs() && body.async === true) {
      const handle = await startWorkdayReconstruct({
        userId: session.user.id,
        date,
        force: true,
      });
      return NextResponse.json({
        success: true,
        queued: true,
        workflowId: handle.workflowId,
        message: 'Reconstruction workflow started',
      });
    }

    const workSession = await reconstructWorkday({
      userId: session.user.id,
      date,
      force: true,
    });

    return NextResponse.json({ workSession, queued: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error reconstructing timeline:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
