import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultMockPrisma } from './helpers/mock-db';

vi.mock('@/lib/db', () => ({
  default: defaultMockPrisma,
}));

const authMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

import { GET, PATCH } from '@/app/api/user/profile/route';

describe('User profile API', () => {
  beforeEach(() => {
    defaultMockPrisma.reset();
    authMock.mockReset();
  });

  it('returns the authenticated user profile', async () => {
    const user = await defaultMockPrisma.user.create({
      data: {
        id: 'user-profile-1',
        email: 'dev@timerecon.test',
        name: 'Amarpreet',
        passwordHash: 'hash',
        timezone: 'Asia/Kolkata',
        workingHoursStart: '09:00',
        workingHoursEnd: '17:30',
      },
    });
    authMock.mockResolvedValue({ user: { id: user.id } });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.name).toBe('Amarpreet');
    expect(body.profile.email).toBe('dev@timerecon.test');
    expect(body.profile.timezone).toBe('Asia/Kolkata');
  });

  it('updates editable profile fields', async () => {
    const user = await defaultMockPrisma.user.create({
      data: {
        id: 'user-profile-2',
        email: 'dev2@timerecon.test',
        name: 'Old Name',
        passwordHash: 'hash',
        timezone: 'UTC',
        workingHoursStart: '09:00',
        workingHoursEnd: '17:30',
      },
    });
    authMock.mockResolvedValue({ user: { id: user.id } });

    const req = new Request('http://localhost/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Name',
        timezone: 'Asia/Kolkata',
        workingHoursStart: '10:00',
        workingHoursEnd: '18:00',
      }),
    });

    const res = await PATCH(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.name).toBe('New Name');
    expect(body.profile.timezone).toBe('Asia/Kolkata');
    expect(body.profile.workingHoursStart).toBe('10:00');
  });
});
