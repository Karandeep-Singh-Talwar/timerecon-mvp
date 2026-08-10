import { Connector, BaseWorkItem, RawEvent } from './types';
import prisma from '@/lib/db';
import { decryptToken, encryptToken } from '@/lib/encryption';

export class GoogleCalendarConnector implements Connector {
  readonly provider = 'google_calendar' as const;

  /**
   * Generates Google Calendar OAuth authorization URL.
   */
  static getAuthUrl(state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/google_calendar/callback`;
    const scopes = 'https://www.googleapis.com/auth/calendar.events.readonly';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges OAuth authorization code for access & refresh tokens.
   */
  static async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    email?: string;
  }> {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/google_calendar/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(`Google Calendar OAuth token exchange failed: ${tokenRes.status} ${errorText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    let email: string | undefined;
    try {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userinfoRes.ok) {
        const userInfo = await userinfoRes.json();
        email = userInfo.email;
      }
    } catch (err) {
      console.warn('Failed to fetch Google user info:', err);
    }

    return { accessToken, refreshToken, expiresAt, email };
  }

  /**
   * Refreshes access token if expired.
   */
  static async refreshAccessToken(refreshTokenStr: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshTokenStr,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!res.ok) {
      throw new Error(`Failed to refresh Google Calendar token: ${res.statusText}`);
    }

    const data = await res.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  }

  private async getValidAccessToken(userId: string): Promise<{ accessToken: string; email?: string } | null> {
    const integration = await prisma.integration.findUnique({
      where: { userId_provider: { userId, provider: 'google_calendar' } },
    });

    if (!integration || integration.status !== 'active') {
      return null;
    }

    let accessToken = decryptToken(integration.accessToken);
    let refreshTokenStr = integration.refreshToken ? decryptToken(integration.refreshToken) : null;
    const email = integration.externalAccountId || undefined;

    if (integration.tokenExpiresAt && integration.tokenExpiresAt.getTime() <= Date.now() + 60000 && refreshTokenStr) {
      try {
        const refreshed = await GoogleCalendarConnector.refreshAccessToken(refreshTokenStr);
        accessToken = refreshed.accessToken;

        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            accessToken: encryptToken(accessToken),
            tokenExpiresAt: refreshed.expiresAt,
          },
        });
      } catch (err) {
        console.error('Error refreshing Google Calendar token:', err);
        return null;
      }
    }

    return { accessToken, email };
  }

  async fetchWorkItems(userId: string, since: Date): Promise<BaseWorkItem[]> {
    // Calendar events do not produce WorkItems
    return [];
  }

  async fetchEvents(userId: string, since: Date): Promise<RawEvent[]> {
    const authInfo = await this.getValidAccessToken(userId);
    if (!authInfo || !authInfo.accessToken) {
      return [];
    }

    const { accessToken, email } = authInfo;
    const events: RawEvent[] = [];

    try {
      const timeMin = since.toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&singleEvents=true&orderBy=startTime`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        console.error(`Google Calendar API error ${res.status}: ${await res.text()}`);
        return [];
      }

      const data = await res.json();
      const items = data.items || [];

      for (const item of items) {
        // Skip transparent (free) events
        if (item.transparency === 'transparent') continue;

        // Skip event if user declined it
        if (email && item.attendees) {
          const selfAttendee = item.attendees.find((a: any) => a.email === email || a.self);
          if (selfAttendee && selfAttendee.responseStatus === 'declined') {
            continue;
          }
        }

        // Handle start and end times (skip all-day events without dateTime if desired or parse start.date)
        const startStr = item.start?.dateTime || item.start?.date;
        const endStr = item.end?.dateTime || item.end?.date;

        if (!startStr) continue;

        const occurredAt = new Date(startStr);
        const endedAt = endStr ? new Date(endStr) : undefined;
        let duration: number | undefined;

        if (occurredAt && endedAt) {
          duration = Math.round((endedAt.getTime() - occurredAt.getTime()) / (1000 * 60));
        }

        // Filter out event if before `since`
        if (occurredAt < since) continue;

        events.push({
          provider: 'google_calendar',
          eventType: 'calendar_event',
          occurredAt,
          endedAt,
          duration,
          title: item.summary || 'Untitled Event',
          description: item.description,
          externalId: item.id,
          externalUrl: item.htmlLink,
          metadata: {
            status: item.status,
            location: item.location,
            attendees: item.attendees?.map((a: any) => a.email),
            organizer: item.organizer?.email,
          },
        });
      }
    } catch (err) {
      console.error('Error fetching Google Calendar events:', err);
    }

    return events;
  }
}
