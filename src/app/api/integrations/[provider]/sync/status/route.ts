import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { useTemporalJobs } from '@/temporal/config';
import { getWorkflowStatus } from '@/temporal/client';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> | { provider: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const provider = params.provider;
  const workflowId = req.nextUrl.searchParams.get('workflowId');

  if (!workflowId) {
    return NextResponse.json({ error: 'workflowId required' }, { status: 400 });
  }

  // Only allow reading own sync/reconstruct workflows
  const allowedPrefix = `sync:${session.user.id}:${provider}`;
  const reconstructPrefix = `reconstruct:${session.user.id}:`;
  if (workflowId !== allowedPrefix && !workflowId.startsWith(reconstructPrefix)) {
    return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }

  if (!useTemporalJobs()) {
    return NextResponse.json({
      workflowId,
      status: 'COMPLETED',
      result: null,
      note: 'Temporal disabled; jobs run inline',
    });
  }

  try {
    const status = await getWorkflowStatus(workflowId);
    return NextResponse.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Status lookup failed';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
