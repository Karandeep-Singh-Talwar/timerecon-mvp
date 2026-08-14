import prisma from '@/lib/db';
import { RawEvent } from '@/lib/connectors/types';

function resolveProviderEventId(rawEvent: RawEvent): string | null {
  if (rawEvent.externalId && rawEvent.externalId.trim()) {
    return rawEvent.externalId.trim();
  }

  const meta = rawEvent.metadata;
  if (meta && typeof meta === 'object') {
    const record = meta as Record<string, unknown>;
    const candidates = [record.id, record.eventId, record.sha, record.commitSha, record.prNumber];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
  }

  return null;
}

/**
 * Normalizes raw events from connectors and saves them to the database.
 * Prefers stable providerEventId match; falls back to heuristic dedupe.
 */
export async function normalizeAndSaveEvents(userId: string, rawEvents: RawEvent[]): Promise<number> {
  if (!rawEvents || rawEvents.length === 0) return 0;

  const workItems = await prisma.workItem.findMany({
    where: { userId },
  });

  const workItemMap = new Map<string, string>();
  for (const item of workItems) {
    workItemMap.set(item.externalId.toUpperCase(), item.id);
    if (item.provider === 'github' && item.metadata && typeof item.metadata === 'object') {
      const meta = item.metadata as Record<string, unknown>;
      if (typeof meta.jiraKey === 'string') {
        workItemMap.set(meta.jiraKey.toUpperCase(), item.id);
      }
    }
  }

  let savedCount = 0;

  for (const rawEvent of rawEvents) {
    let workItemId: string | undefined;
    if (rawEvent.workItemExternalId) {
      workItemId = workItemMap.get(rawEvent.workItemExternalId.toUpperCase());
    }

    const providerEventId = resolveProviderEventId(rawEvent);

    let existing = null;
    if (providerEventId) {
      existing = await prisma.normalizedEvent.findFirst({
        where: {
          userId,
          provider: rawEvent.provider,
          providerEventId,
        },
      });
    }

    if (!existing) {
      existing = await prisma.normalizedEvent.findFirst({
        where: {
          userId,
          provider: rawEvent.provider,
          eventType: rawEvent.eventType,
          occurredAt: rawEvent.occurredAt,
          title: rawEvent.title,
        },
      });
    }

    if (existing) {
      await prisma.normalizedEvent.update({
        where: { id: existing.id },
        data: {
          endedAt: rawEvent.endedAt,
          duration: rawEvent.duration,
          description: rawEvent.description,
          externalUrl: rawEvent.externalUrl,
          metadata: rawEvent.metadata ?? undefined,
          workItemId: workItemId || existing.workItemId,
          providerEventId: providerEventId || existing.providerEventId,
          title: rawEvent.title,
          eventType: rawEvent.eventType,
          occurredAt: rawEvent.occurredAt,
        },
      });
    } else {
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
          providerEventId,
        },
      });
    }
    savedCount++;
  }

  return savedCount;
}
