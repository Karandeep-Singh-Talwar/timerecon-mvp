import prisma from '@/lib/db';
import { encryptToken } from '@/lib/encryption';
import { Connector, IntegrationProvider } from './types';
import { JiraConnector } from './jira';
import { GithubConnector } from './github';
import { GoogleCalendarConnector } from './calendar';
import { MockJiraConnector, MockGithubConnector, MockCalendarConnector } from './mock';
import { normalizeAndSaveEvents } from '@/lib/normalizer';

export class IntegrationService {
  /**
   * Retrieves user integrations with tokens redacted for safety.
   */
  static async getUserIntegrations(userId: string) {
    const integrations = await prisma.integration.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        status: true,
        externalAccountId: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
      },
    });
    return integrations;
  }

  /**
   * Saves or updates integration tokens (encrypted) for a user.
   */
  static async saveIntegration(
    userId: string,
    provider: IntegrationProvider,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: Date;
    },
    externalAccountId?: string,
    metadata?: any
  ) {
    const encryptedAccess = encryptToken(tokens.accessToken);
    const encryptedRefresh = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

    return await prisma.integration.upsert({
      where: {
        userId_provider: { userId, provider },
      },
      create: {
        userId,
        provider,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: tokens.expiresAt,
        externalAccountId,
        metadata: metadata ?? undefined,
        status: 'active',
      },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: tokens.expiresAt,
        externalAccountId,
        metadata: metadata ?? undefined,
        status: 'active',
      },
    });
  }

  /**
   * Disconnects an integration for a user.
   */
  static async disconnectIntegration(userId: string, provider: IntegrationProvider) {
    return await prisma.integration.deleteMany({
      where: { userId, provider },
    });
  }

  /**
   * Gets appropriate connector instance (real or mock).
   */
  static getConnector(provider: IntegrationProvider, useMock: boolean = false): Connector {
    if (useMock || process.env.USE_MOCK_CONNECTORS === 'true') {
      switch (provider) {
        case 'jira':
          return new MockJiraConnector();
        case 'github':
          return new MockGithubConnector();
        case 'google_calendar':
          return new MockCalendarConnector();
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    }

    switch (provider) {
      case 'jira':
        return new JiraConnector();
      case 'github':
        return new GithubConnector();
      case 'google_calendar':
        return new GoogleCalendarConnector();
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Triggers sync for a provider: fetches work items & raw events,
   * saves/upserts WorkItem records in DB, and passes raw events to normalizer.
   */
  static async syncIntegration(
    userId: string,
    provider: IntegrationProvider,
    options?: { useMock?: boolean; since?: Date }
  ) {
    const useMock = options?.useMock ?? (process.env.USE_MOCK_CONNECTORS === 'true');
    const since = options?.since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days ago

    // Check if integration exists unless mock mode is requested
    if (!useMock) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: { include: { privacySettings: true } } }
      });
      if (user?.organization?.privacySettings) {
        if (!user.organization.privacySettings.enabledIntegrations.includes(provider)) {
          throw new Error(`Organization privacy settings disable the ${provider} integration.`);
        }
      }

      const integration = await prisma.integration.findUnique({
        where: { userId_provider: { userId, provider } },
      });
      if (!integration || integration.status !== 'active') {
        throw new Error(`Integration for ${provider} is not connected or active.`);
      }
    }

    const connector = this.getConnector(provider, useMock);

    // 1. Fetch & save WorkItems
    const rawWorkItems = await connector.fetchWorkItems(userId, since);
    for (const item of rawWorkItems) {
      await prisma.workItem.upsert({
        where: {
          userId_provider_externalId: {
            userId,
            provider: item.provider,
            externalId: item.externalId,
          },
        },
        create: {
          userId,
          provider: item.provider,
          externalId: item.externalId,
          externalUrl: item.externalUrl,
          title: item.title,
          description: item.description,
          status: item.status,
          project: item.project,
          itemType: item.itemType,
          metadata: item.metadata ?? undefined,
          lastSyncAt: new Date(),
        },
        update: {
          title: item.title,
          description: item.description,
          status: item.status,
          project: item.project,
          itemType: item.itemType,
          metadata: item.metadata ?? undefined,
          lastSyncAt: new Date(),
        },
      });
    }

    // 2. Fetch & normalize raw events
    const rawEvents = await connector.fetchEvents(userId, since);
    const eventsSaved = await normalizeAndSaveEvents(userId, rawEvents);

    // 3. Update lastSyncAt on integration if record exists
    const lastSyncAt = new Date();
    await prisma.integration.updateMany({
      where: { userId, provider },
      data: { lastSyncAt },
    });

    return {
      provider,
      workItemsCount: rawWorkItems.length,
      eventsCount: rawEvents.length,
      eventsSaved,
      lastSyncAt,
    };
  }
}
