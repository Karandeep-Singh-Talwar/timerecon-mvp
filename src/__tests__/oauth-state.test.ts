import { afterEach, describe, expect, it } from 'vitest';
import { createOAuthState, verifyOAuthState } from '@/lib/auth/oauth-state';

describe('OAuth state', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = originalSecret;
  });

  it('binds a signed state to its user and provider', () => {
    process.env.NEXTAUTH_SECRET = 'test-nextauth-secret';
    const state = createOAuthState('user-1', 'github');
    expect(verifyOAuthState(state)).toMatchObject({ userId: 'user-1', provider: 'github' });
  });

  it('rejects a tampered OAuth state', () => {
    process.env.NEXTAUTH_SECRET = 'test-nextauth-secret';
    const state = createOAuthState('user-1', 'jira');
    expect(verifyOAuthState(`${state}x`)).toBeNull();
  });
});
