import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultMockPrisma } from './helpers/mock-db';

vi.mock('@/lib/db', () => ({
  default: defaultMockPrisma,
}));

import { seedDogfoodData, getDogfoodDates } from '@/lib/dogfood/seed-dogfood';

describe('Dogfooding Setup & Seed Utility', () => {
  beforeEach(() => {
    defaultMockPrisma.reset();
  });

  it('getDogfoodDates should return 5 date strings (Monday to Friday)', () => {
    const dates = getDogfoodDates();
    expect(dates).toHaveLength(5);
    dates.forEach((d) => {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('seedDogfoodData should create user integrations, work items, events and 5 work sessions', async () => {
    // 1. Create mock test user
    const user = await defaultMockPrisma.user.create({
      data: {
        id: 'user-dogfood-1',
        email: 'dev@timerecon.test',
        name: 'Test Developer',
        passwordHash: 'hashedpassword',
        timezone: 'UTC',
        workingHoursStart: '09:00',
        workingHoursEnd: '17:30',
      },
    });

    const fixedDates = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14'];

    // 2. Seed dogfood data
    const result = await seedDogfoodData(user.id, fixedDates);

    expect(result.success).toBe(true);
    expect(result.userId).toBe('user-dogfood-1');
    expect(result.dates).toEqual(fixedDates);
    expect(result.workSessionsCount).toBe(5);

    // 3. Verify active integrations created
    const integrations = await defaultMockPrisma.integration.findMany({
      where: { userId: user.id },
    });
    expect(integrations).toHaveLength(3);
    const providers = integrations.map((i: any) => i.provider);
    expect(providers).toContain('jira');
    expect(providers).toContain('github');
    expect(providers).toContain('google_calendar');

    // 4. Verify WorkItems created
    const workItems = await defaultMockPrisma.workItem.findMany({
      where: { userId: user.id },
    });
    expect(workItems.length).toBeGreaterThan(0);
    const keys = workItems.map((w: any) => w.externalId);
    expect(keys).toContain('AUTH-231');
    expect(keys).toContain('BUG-442');
    expect(keys).toContain('FE-101');
    expect(keys).toContain('BE-201');

    // 5. Verify reconstructed sessions
    const sessions = await defaultMockPrisma.workSession.findMany({
      where: { userId: user.id },
    });
    expect(sessions).toHaveLength(5);
  });
});
