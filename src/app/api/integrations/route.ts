import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { IntegrationService } from '@/lib/connectors/service';
import { IntegrationProvider } from '@/lib/connectors/types';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const integrations = await IntegrationService.getUserIntegrations(session.user.id);
    return NextResponse.json({ integrations });
  } catch (error: any) {
    console.error('Error fetching integrations:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const provider = body.provider as IntegrationProvider;

    if (!provider || !['jira', 'github', 'google_calendar'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    await IntegrationService.disconnectIntegration(session.user.id, provider);
    return NextResponse.json({ success: true, provider });
  } catch (error: any) {
    console.error('Error disconnecting integration:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
