import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { IntegrationService } from '@/lib/connectors/service';
import { IntegrationProvider } from '@/lib/connectors/types';
import { enqueueSyncJob } from '@/workers/syncQueue';

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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const searchParams = req.nextUrl.searchParams;
  const useMock =
    body.useMock ??
    (searchParams.get('mock') === 'true' || process.env.USE_MOCK_CONNECTORS === 'true');

  const sinceStr = body.since || searchParams.get('since');
  const since = sinceStr ? new Date(sinceStr) : undefined;

  try {
    if (process.env.USE_BULLMQ === 'true') {
      await enqueueSyncJob(session.user.id, provider, { useMock, since });
      return NextResponse.json({ success: true, message: 'Sync enqueued' });
    }

    const result = await IntegrationService.syncIntegration(session.user.id, provider, {
      useMock,
      since,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error(`Error syncing integration ${provider}:`, error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
