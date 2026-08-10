import { Connector, BaseWorkItem, RawEvent } from './types';
import prisma from '@/lib/db';
import { decryptToken } from '@/lib/encryption';

export class GithubConnector implements Connector {
  readonly provider = 'github' as const;

  /**
   * Generates GitHub OAuth authorization URL.
   */
  static getAuthUrl(state: string): string {
    const clientId = process.env.GITHUB_CLIENT_ID || '';
    const redirectUri =
      process.env.GITHUB_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/github/callback`;
    const scopes = 'repo read:user';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchanges OAuth authorization code for access token.
   */
  static async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    username?: string;
  }> {
    const clientId = process.env.GITHUB_CLIENT_ID || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
    const redirectUri =
      process.env.GITHUB_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/github/callback`;

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(`GitHub OAuth token exchange failed: ${tokenRes.status} ${errorText}`);
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    const accessToken = tokenData.access_token;

    // Fetch GitHub username
    let username: string | undefined;
    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${accessToken}`,
          'User-Agent': 'TimeRecon-App',
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        username = userData.login;
      }
    } catch (err) {
      console.warn('Failed to fetch GitHub user info:', err);
    }

    return { accessToken, username };
  }

  /**
   * Helper to extract Jira key (e.g. AUTH-231) from text strings.
   */
  static extractJiraKey(text: string): string | undefined {
    if (!text) return undefined;
    const match = text.match(/([A-Z]{2,10}-\d+)/i);
    return match ? match[1].toUpperCase() : undefined;
  }

  private async getValidAccessToken(userId: string): Promise<{ accessToken: string; username?: string } | null> {
    const integration = await prisma.integration.findUnique({
      where: { userId_provider: { userId, provider: 'github' } },
    });

    if (!integration || integration.status !== 'active') {
      return null;
    }

    const accessToken = decryptToken(integration.accessToken);
    const username = integration.externalAccountId || undefined;

    return { accessToken, username };
  }

  async fetchWorkItems(userId: string, since: Date): Promise<BaseWorkItem[]> {
    const authInfo = await this.getValidAccessToken(userId);
    if (!authInfo || !authInfo.accessToken) {
      return [];
    }

    const { accessToken, username } = authInfo;
    if (!username) return [];

    const sinceIso = since.toISOString().split('T')[0];
    const query = `author:${username} updated:>=${sinceIso}`;

    try {
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc`;
      const res = await fetch(url, {
        headers: {
          Authorization: `token ${accessToken}`,
          'User-Agent': 'TimeRecon-App',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) {
        console.error(`GitHub Search API error ${res.status}: ${await res.text()}`);
        return [];
      }

      const data = await res.json();
      const items = data.items || [];

      return items.map((item: any) => {
        const isPr = !!item.pull_request;
        const repoFullName = item.repository_url ? item.repository_url.replace('https://api.github.com/repos/', '') : undefined;
        const jiraKey = GithubConnector.extractJiraKey(item.title) || GithubConnector.extractJiraKey(item.body || '');

        return {
          externalId: item.number.toString(),
          provider: 'github' as const,
          title: item.title,
          description: item.body,
          status: item.state,
          project: repoFullName,
          itemType: isPr ? 'pr' : 'issue',
          externalUrl: item.html_url,
          metadata: {
            author: item.user?.login,
            jiraKey,
            commentsCount: item.comments,
            labels: item.labels?.map((l: any) => l.name),
          },
          createdAt: item.created_at ? new Date(item.created_at) : undefined,
          updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
        };
      });
    } catch (err) {
      console.error('Error fetching GitHub work items:', err);
      return [];
    }
  }

  async fetchEvents(userId: string, since: Date): Promise<RawEvent[]> {
    const authInfo = await this.getValidAccessToken(userId);
    if (!authInfo || !authInfo.accessToken || !authInfo.username) {
      return [];
    }

    const { accessToken, username } = authInfo;
    const events: RawEvent[] = [];

    try {
      const url = `https://api.github.com/users/${username}/events`;
      const res = await fetch(url, {
        headers: {
          Authorization: `token ${accessToken}`,
          'User-Agent': 'TimeRecon-App',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) {
        console.error(`GitHub Events API error ${res.status}: ${await res.text()}`);
        return [];
      }

      const rawEventsData = await res.json();
      if (!Array.isArray(rawEventsData)) return [];

      for (const ev of rawEventsData) {
        const occurredAt = new Date(ev.created_at);
        if (occurredAt < since) continue;

        const repoName = ev.repo?.name;

        if (ev.type === 'PushEvent') {
          const commits = ev.payload?.commits || [];
          const branch = ev.payload?.ref?.replace('refs/heads/', '');
          const branchJiraKey = GithubConnector.extractJiraKey(branch || '');

          for (const c of commits) {
            const jiraKey = GithubConnector.extractJiraKey(c.message) || branchJiraKey;
            events.push({
              provider: 'github',
              eventType: 'commit',
              occurredAt,
              title: `Commit: ${c.message.split('\n')[0]}`,
              description: c.message,
              externalId: c.sha?.substring(0, 7),
              externalUrl: `https://github.com/${repoName}/commit/${c.sha}`,
              workItemExternalId: jiraKey,
              metadata: { repo: repoName, branch, sha: c.sha, author: c.author?.name },
            });
          }
        } else if (ev.type === 'PullRequestEvent') {
          const pr = ev.payload?.action;
          const prData = ev.payload?.pull_request;
          if (prData) {
            const jiraKey = GithubConnector.extractJiraKey(prData.title) || GithubConnector.extractJiraKey(prData.head?.ref || '');
            events.push({
              provider: 'github',
              eventType: pr === 'closed' && prData.merged ? 'pr_merged' : 'pr_opened',
              occurredAt,
              title: `PR #${prData.number} ${pr}: ${prData.title}`,
              description: prData.body,
              externalId: prData.number.toString(),
              externalUrl: prData.html_url,
              workItemExternalId: jiraKey || prData.number.toString(),
              metadata: { prNumber: prData.number, repo: repoName, action: pr },
            });
          }
        } else if (ev.type === 'PullRequestReviewEvent') {
          const prData = ev.payload?.pull_request;
          const review = ev.payload?.review;
          if (prData && review) {
            const jiraKey = GithubConnector.extractJiraKey(prData.title);
            events.push({
              provider: 'github',
              eventType: 'pr_review',
              occurredAt,
              title: `Reviewed PR #${prData.number}: ${prData.title}`,
              description: review.body,
              externalId: review.id?.toString(),
              externalUrl: review.html_url,
              workItemExternalId: jiraKey || prData.number.toString(),
              metadata: { prNumber: prData.number, repo: repoName, reviewState: review.state },
            });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching GitHub events:', err);
    }

    return events;
  }
}
