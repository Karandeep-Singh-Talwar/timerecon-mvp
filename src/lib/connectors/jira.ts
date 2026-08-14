import { Connector, BaseWorkItem, RawEvent } from './types';
import prisma from '@/lib/db';
import { decryptToken, encryptToken } from '@/lib/encryption';

export class JiraConnector implements Connector {
  readonly provider = 'jira' as const;

  /**
   * Generates Jira OAuth 2.0 (3LO) authorization URL.
   */
  static getAuthUrl(state: string): string {
    const clientId = process.env.JIRA_CLIENT_ID || '';
    const redirectUri =
      process.env.JIRA_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/jira/callback`;
    const scopes = 'read:jira-work read:jira-user offline_access';

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  /**
   * Exchanges OAuth authorization code for access & refresh tokens.
   */
  static async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    cloudIds?: string[];
  }> {
    const clientId = process.env.JIRA_CLIENT_ID || '';
    const clientSecret = process.env.JIRA_CLIENT_SECRET || '';
    const redirectUri =
      process.env.JIRA_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/jira/callback`;

    const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(`Jira OAuth token exchange failed: ${tokenRes.status} ${errorText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Fetch cloudIds (accessible resources)
    let cloudIds: string[] = [];
    try {
      const resRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
      if (resRes.ok) {
        const resources = await resRes.json();
        if (Array.isArray(resources) && resources.length > 0) {
          cloudIds = resources.map((r: any) => r.id);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch Jira cloudId resources:', err);
    }

    return { accessToken, refreshToken, expiresAt, cloudIds };
  }

  /**
   * Refreshes access token if expired.
   */
  static async refreshAccessToken(refreshTokenStr: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const clientId = process.env.JIRA_CLIENT_ID || '';
    const clientSecret = process.env.JIRA_CLIENT_SECRET || '';

    const res = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshTokenStr,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to refresh Jira token: ${res.statusText}`);
    }

    const data = await res.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshTokenStr,
      expiresAt,
    };
  }

  /**
   * Retrieves active, decrypted tokens for user from DB and refreshes if necessary.
   */
  private async getValidAccessToken(userId: string): Promise<{ accessToken: string; cloudIds?: string[] } | null> {
    const integration = await prisma.integration.findUnique({
      where: { userId_provider: { userId, provider: 'jira' } },
    });

    if (!integration || integration.status !== 'active') {
      return null;
    }

    let accessToken = decryptToken(integration.accessToken);
    let refreshTokenStr = integration.refreshToken ? decryptToken(integration.refreshToken) : null;
    const metadata = (integration.metadata as any) || {};
    const cloudIds = metadata.cloudIds || (metadata.cloudId ? [metadata.cloudId] : integration.externalAccountId ? [integration.externalAccountId] : []);

    // Check if token is expired (or expires within 60s)
    if (integration.tokenExpiresAt && integration.tokenExpiresAt.getTime() <= Date.now() + 60000 && refreshTokenStr) {
      try {
        const refreshed = await JiraConnector.refreshAccessToken(refreshTokenStr);
        accessToken = refreshed.accessToken;
        refreshTokenStr = refreshed.refreshToken || refreshTokenStr;

        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            accessToken: encryptToken(accessToken),
            refreshToken: refreshTokenStr ? encryptToken(refreshTokenStr) : null,
            tokenExpiresAt: refreshed.expiresAt,
          },
        });
      } catch (err) {
        console.error('Error refreshing Jira token:', err);
        await prisma.integration.update({
          where: { id: integration.id },
          data: { status: 'expired' },
        });
        throw new Error('Jira connection expired. Reconnect in Settings.');
      }
    }

    return { accessToken, cloudIds };
  }

  async fetchWorkItems(userId: string, since: Date): Promise<BaseWorkItem[]> {
    const authInfo = await this.getValidAccessToken(userId);
    if (!authInfo || !authInfo.accessToken || !authInfo.cloudIds || authInfo.cloudIds.length === 0) {
      return [];
    }

    const { accessToken, cloudIds } = authInfo;
    const sinceDateStr = since.toISOString().split('T')[0];
    const jql = `updated >= "${sinceDateStr}" ORDER BY updated DESC`;

    const fetchPromises = cloudIds.map(async (cloudId) => {
      try {
        const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          console.error(`Jira Search API error ${res.status}: ${await res.text()}`);
          return [];
        }

        const data = await res.json();
        const issues = data.issues || [];

        return issues.map((issue: any) => {
          const fields = issue.fields || {};
          return {
            externalId: issue.key,
            provider: 'jira' as const,
            title: fields.summary || issue.key,
            description: typeof fields.description === 'string' ? fields.description : fields.summary,
            status: fields.status?.name || 'open',
            project: fields.project?.key || issue.key.split('-')[0],
            itemType: fields.issuetype?.name?.toLowerCase() || 'task',
            externalUrl: `https://${cloudId}.atlassian.net/browse/${issue.key}`,
            metadata: {
              priority: fields.priority?.name,
              assignee: fields.assignee?.displayName,
            },
            createdAt: fields.created ? new Date(fields.created) : undefined,
            updatedAt: fields.updated ? new Date(fields.updated) : undefined,
          };
        });
      } catch (err) {
        console.error('Error fetching Jira work items:', err);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    return results.flat();
  }

  async fetchEvents(userId: string, since: Date): Promise<RawEvent[]> {
    const authInfo = await this.getValidAccessToken(userId);
    if (!authInfo || !authInfo.accessToken || !authInfo.cloudIds || authInfo.cloudIds.length === 0) {
      return [];
    }

    const { accessToken, cloudIds } = authInfo;
    
    // 1. Fetch recently updated issues to check worklogs & comments
    const workItems = await this.fetchWorkItems(userId, since);

    const fetchPromises = cloudIds.map(async (cloudId) => {
      const events: RawEvent[] = [];
      for (const item of workItems) {
        try {
          // Fetch worklogs for issue
          const wlUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${item.externalId}/worklog`;
          const wlRes = await fetch(wlUrl, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          });

          if (wlRes.ok) {
            const wlData = await wlRes.json();
            const worklogs = wlData.worklogs || [];
            for (const wl of worklogs) {
              const started = new Date(wl.started);
              if (started >= since) {
                events.push({
                  provider: 'jira',
                  eventType: 'worklog',
                  occurredAt: started,
                  duration: Math.round((wl.timeSpentSeconds || 0) / 60),
                  title: `Worklog on ${item.externalId}: ${item.title}`,
                  description: wl.comment?.content?.[0]?.content?.[0]?.text || `Logged ${wl.timeSpent}`,
                  workItemExternalId: item.externalId,
                  externalId: wl.id ? `worklog-${wl.id}` : undefined,
                  externalUrl: `${item.externalUrl}#worklog-${wl.id}`,
                  metadata: {
                    timeSpentSeconds: wl.timeSpentSeconds,
                    author: wl.author?.displayName,
                    id: wl.id,
                  },
                });
              }
            }
          }
        } catch (err) {
          console.warn(`Error fetching worklog for ${item.externalId}:`, err);
        }
      }
      return events;
    });

    const results = await Promise.all(fetchPromises);
    return results.flat();
  }
}
