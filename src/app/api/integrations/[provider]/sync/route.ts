import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { IntegrationService } from '@/lib/connectors/service';
import { IntegrationProvider } from '@/lib/connectors/types';
import { useTemporalJobs } from '@/temporal/config';
import { startIntegrationSync } from '@/temporal/client';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> | { provider: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const provider = params.provider as IntegrationProvider;

  if (!['jira', 'github', 'google_calendar'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const searchParams = req.nextUrl.searchParams;
  const useMock =
    (body.useMock as boolean | undefined) ??
    (searchParams.get('mock') === 'true' || process.env.USE_MOCK_CONNECTORS === 'true');

  const sinceStr = (body.since as string | undefined) || searchParams.get('since');
  const since = sinceStr ? new Date(sinceStr) : undefined;

  try {
    if (useTemporalJobs()) {
      const handle = await startIntegrationSync({
        userId: session.user.id,
        provider,
        useMock,
        since,
      });
      return NextResponse.json({
        success: true,
        queued: true,
        workflowId: handle.workflowId,
        message: 'Sync workflow started',
      });
    }

    const result = await IntegrationService.syncIntegration(session.user.id, provider, {
      useMock,
      since,
    });

    return NextResponse.json({ success: true, queued: false, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    console.error(`Error syncing integration ${provider}:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
