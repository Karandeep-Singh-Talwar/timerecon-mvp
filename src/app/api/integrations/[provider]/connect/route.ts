import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { IntegrationService } from '@/lib/connectors/service';
import { JiraConnector } from '@/lib/connectors/jira';
import { GithubConnector } from '@/lib/connectors/github';
import { GoogleCalendarConnector } from '@/lib/connectors/calendar';
import { IntegrationProvider } from '@/lib/connectors/types';
import { createOAuthState } from '@/lib/auth/oauth-state';

function isProviderConfigured(provider: IntegrationProvider): boolean {
  switch (provider) {
    case 'jira':
      return Boolean(process.env.JIRA_CLIENT_ID && process.env.JIRA_CLIENT_SECRET);
    case 'github':
      return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    case 'google_calendar':
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> | { provider: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    const isJson = req.headers.get('accept')?.includes('application/json') && !req.headers.get('accept')?.includes('text/html');
    if (isJson) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const params = await context.params;
  const provider = params.provider as IntegrationProvider;

  if (!['jira', 'github', 'google_calendar'].includes(provider)) {
    const isJson = req.headers.get('accept')?.includes('application/json') && !req.headers.get('accept')?.includes('text/html');
    if (isJson) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
    const redirectUrl = new URL('/settings/integrations', req.nextUrl.origin);
    redirectUrl.searchParams.set('error', 'invalid_provider');
    return NextResponse.redirect(redirectUrl);
  }

  const searchParams = req.nextUrl.searchParams;
  const mockRequested = searchParams.get('mock') === 'true' || process.env.USE_MOCK_CONNECTORS === 'true';
  const allowMockInProd = process.env.ALLOW_MOCK_CONNECTORS === 'true' || process.env.USE_MOCK_CONNECTORS === 'true';
  const useMock = mockRequested && (process.env.NODE_ENV !== 'production' || allowMockInProd);

  if (mockRequested && !useMock) {
    const isJson = req.headers.get('accept')?.includes('application/json') && !req.headers.get('accept')?.includes('text/html');
    if (isJson) {
      return NextResponse.json({ error: 'Mock integrations are disabled in production.' }, { status: 403 });
    }
    const redirectUrl = new URL('/settings/integrations', req.nextUrl.origin);
    redirectUrl.searchParams.set('error', 'mock_disabled');
    redirectUrl.searchParams.set('provider', provider);
    return NextResponse.redirect(redirectUrl);
  }

  if (useMock) {
    // Fast path for development & offline testing
    await IntegrationService.saveIntegration(
      session.user.id,
      provider,
      {
        accessToken: `mock-access-token-${provider}`,
        refreshToken: `mock-refresh-token-${provider}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      `mock-${provider}-user`,
      { mock: true, mode: 'mock' }
    );

    const redirectUrl = new URL('/settings/integrations', req.nextUrl.origin);
    redirectUrl.searchParams.set('connected', provider);
    redirectUrl.searchParams.set('mock', 'true');
    return NextResponse.redirect(redirectUrl);
  }

  if (!isProviderConfigured(provider)) {
    // Automatically fall back to mock connection for demo deployments when live OAuth keys are unconfigured
    const disableMock = process.env.ALLOW_MOCK_CONNECTORS === 'false';
    if (!disableMock) {
      await IntegrationService.saveIntegration(
        session.user.id,
        provider,
        {
          accessToken: `mock-access-token-${provider}`,
          refreshToken: `mock-refresh-token-${provider}`,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        `mock-${provider}-user`,
        { mock: true, mode: 'mock' }
      );

      const redirectUrl = new URL('/settings/integrations', req.nextUrl.origin);
      redirectUrl.searchParams.set('connected', provider);
      redirectUrl.searchParams.set('mock', 'true');
      return NextResponse.redirect(redirectUrl);
    }

    const redirectUrl = new URL('/settings/integrations', req.nextUrl.origin);
    redirectUrl.searchParams.set('error', 'unconfigured_provider');
    redirectUrl.searchParams.set('provider', provider);
    return NextResponse.redirect(redirectUrl);
  }

  const state = createOAuthState(session.user.id, provider);
  let authUrl = '';

  switch (provider) {
    case 'jira':
      authUrl = JiraConnector.getAuthUrl(state);
      break;
    case 'github':
      authUrl = GithubConnector.getAuthUrl(state);
      break;
    case 'google_calendar':
      authUrl = GoogleCalendarConnector.getAuthUrl(state);
      break;
  }

  return NextResponse.redirect(authUrl);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> | { provider: string } }
) {
  return GET(req, context);
}
