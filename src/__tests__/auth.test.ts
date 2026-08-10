import { describe, it, expect } from 'vitest';
import { authConfig } from '@/lib/auth/auth.config';

describe('Auth Configuration', () => {
  it('defines custom sign-in and new-user pages', () => {
    expect(authConfig.pages?.signIn).toBe('/login');
    expect(authConfig.pages?.newUser).toBe('/register');
  });

  it('correctly handles authorized callback logic for unauthenticated user on protected route', () => {
    const authorized = authConfig.callbacks?.authorized;
    expect(authorized).toBeDefined();

    if (authorized) {
      const reqMock = {
        nextUrl: new URL('http://localhost:3000/dashboard'),
      } as any;

      const result = (authorized as any)({ auth: null, request: reqMock });
      expect(result).toBe(false);
    }
  });

  it('correctly handles authorized callback logic for unauthenticated user on auth route', () => {
    const authorized = authConfig.callbacks?.authorized;

    if (authorized) {
      const reqMock = {
        nextUrl: new URL('http://localhost:3000/login'),
      } as any;

      const result = (authorized as any)({ auth: null, request: reqMock });
      expect(result).toBe(true);
    }
  });
});
