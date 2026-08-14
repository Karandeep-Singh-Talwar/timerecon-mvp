import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultMockPrisma } from './helpers/mock-db';

vi.mock('@/lib/db', () => ({
  default: defaultMockPrisma,
}));

import { normalizeAndSaveEvents } from '@/lib/normalizer';

describe('Normalizer providerEventId dedupe', () => {
  beforeEach(() => {
    defaultMockPrisma.reset();
  });

  it('upserts on stable providerEventId instead of creating duplicates', async () => {
    const user = await defaultMockPrisma.user.create({
      data: {
        id: 'user-norm-1',
        email: 'norm@timerecon.test',
        name: 'Norm',
        passwordHash: 'hash',
        timezone: 'UTC',
        workingHoursStart: '09:00',
        workingHoursEnd: '17:30',
      },
    });

    const raw = {
      provider: 'github' as const,
      eventType: 'commit' as const,
      occurredAt: new Date('2026-08-10T14:00:00Z'),
      title: 'feat: AUTH-231',
      externalId: 'sha-abc123',
      workItemExternalId: 'AUTH-231',
      metadata: { sha: 'sha-abc123', repo: 'auth-service' },
    };

    const first = await normalizeAndSaveEvents(user.id, [raw]);
    const second = await normalizeAndSaveEvents(user.id, [
      { ...raw, title: 'feat: AUTH-231 (amended message)' },
    ]);

    expect(first).toBe(1);
    expect(second).toBe(1);

    const events = await defaultMockPrisma.normalizedEvent.findMany({
      where: { userId: user.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0].providerEventId).toBe('sha-abc123');
    expect(events[0].title).toBe('feat: AUTH-231 (amended message)');
  });
});
