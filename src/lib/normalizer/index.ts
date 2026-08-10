import prisma from '@/lib/db';
import { RawEvent } from '@/lib/connectors/types';

/**
 * Normalizes raw events from connectors and saves them to the database.
 */
export async function normalizeAndSaveEvents(userId: string, rawEvents: RawEvent[]): Promise<number> {
  if (!rawEvents || rawEvents.length === 0) return 0;

  // 1. Fetch user's WorkItems to link events where possible
  const workItems = await prisma.workItem.findMany({
    where: { userId },
  });

  // Map by externalId or Jira key -> workItem.id
  const workItemMap = new Map<string, string>();
  for (const item of workItems) {
    workItemMap.set(item.externalId.toUpperCase(), item.id);
    if (item.provider === 'github' && item.metadata && typeof item.metadata === 'object') {
      const meta = item.metadata as Record<string, any>;
      if (meta.jiraKey) {
        workItemMap.set(meta.jiraKey.toUpperCase(), item.id);
      }
    }
  }

  let savedCount = 0;

  for (const rawEvent of rawEvents) {
    // Determine workItemId
    let workItemId: string | undefined;
    if (rawEvent.workItemExternalId) {
      workItemId = workItemMap.get(rawEvent.workItemExternalId.toUpperCase());
    }

    // Deduplication check: check if event with same provider, eventType, occurredAt, title exists
    const existing = await prisma.normalizedEvent.findFirst({
      where: {
        userId,
        provider: rawEvent.provider,
        eventType: rawEvent.eventType,
        occurredAt: rawEvent.occurredAt,
        title: rawEvent.title,
      },
    });

    if (existing) {
      // Update existing record if needed
      await prisma.normalizedEvent.update({
        where: { id: existing.id },
        data: {
          endedAt: rawEvent.endedAt,
          duration: rawEvent.duration,
          description: rawEvent.description,
          externalUrl: rawEvent.externalUrl,
          metadata: rawEvent.metadata ?? undefined,
          workItemId: workItemId || existing.workItemId,
        },
      });
      savedCount++;
    } else {
      // Create new NormalizedEvent
      await prisma.normalizedEvent.create({
        data: {
          userId,
          provider: rawEvent.provider,
          eventType: rawEvent.eventType,
          occurredAt: rawEvent.occurredAt,
          endedAt: rawEvent.endedAt,
          duration: rawEvent.duration,
          title: rawEvent.title,
          description: rawEvent.description,
          externalUrl: rawEvent.externalUrl,
          metadata: rawEvent.metadata ?? undefined,
          workItemId,
        },
      });
      savedCount++;
    }
  }

  return savedCount;
}
