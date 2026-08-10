import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { IntegrationService } from '@/lib/connectors/service';
import { JiraConnector } from '@/lib/connectors/jira';
import { GithubConnector } from '@/lib/connectors/github';
import { GoogleCalendarConnector } from '@/lib/connectors/calendar';
import { IntegrationProvider } from '@/lib/connectors/types';
import { verifyOAuthState } from '@/lib/auth/oauth-state';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> | { provider: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const provider = params.provider as IntegrationProvider;
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  if (!state) {
    return NextResponse.json({ error: 'Missing OAuth state' }, { status: 400 });
  }

  const statePayload = verifyOAuthState(state);
  if (
    !statePayload ||
    statePayload.userId !== session.user.id ||
    statePayload.provider !== provider
  ) {
    return NextResponse.json({ error: 'Invalid or expired OAuth state' }, { status: 400 });
  }

  if (error) {
    const redirectUrl = new URL('/settings/integrations', req.nextUrl.origin);
    redirectUrl.searchParams.set('error', 'oauth_cancelled');
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  try {
    let tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date };
    let externalAccountId: string | undefined;
    let metadata: any = {};

    if (provider === 'jira') {
      const res = await JiraConnector.exchangeCodeForTokens(code);
      tokens = { accessToken: res.accessToken, refreshToken: res.refreshToken, expiresAt: res.expiresAt };
      externalAccountId = res.cloudIds?.[0];
      metadata = { cloudIds: res.cloudIds };
    } else if (provider === 'github') {
      const res = await GithubConnector.exchangeCodeForTokens(code);
      tokens = { accessToken: res.accessToken };
      externalAccountId = res.username;
      metadata = { username: res.username };
    } else if (provider === 'google_calendar') {
      const res = await GoogleCalendarConnector.exchangeCodeForTokens(code);
      tokens = { accessToken: res.accessToken, refreshToken: res.refreshToken, expiresAt: res.expiresAt };
      externalAccountId = res.email;
      metadata = { email: res.email };
    } else {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    await IntegrationService.saveIntegration(
      session.user.id,
      provider,
      tokens,
      externalAccountId,
      metadata
    );

    const redirectUrl = new URL('/settings/integrations', req.nextUrl.origin);
    redirectUrl.searchParams.set('connected', provider);
    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error(`Error in ${provider} OAuth callback:`, err);
    const redirectUrl = new URL('/settings/integrations', req.nextUrl.origin);
    redirectUrl.searchParams.set('error', err.message || 'OAuth failure');
    return NextResponse.redirect(redirectUrl);
  }
}
