import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/integrations/[provider]/connect/route';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'test-user-123' } }),
}));

vi.mock('@/lib/connectors/service', () => ({
  IntegrationService: {
    saveIntegration: vi.fn().mockResolvedValue({}),
  },
}));

describe('GET /api/integrations/[provider]/connect', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.USE_MOCK_CONNECTORS;
    delete process.env.ALLOW_MOCK_CONNECTORS;
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it('redirects browser GET request to /settings/integrations when provider is unconfigured', async () => {
    const req = new NextRequest('http://localhost:3000/api/integrations/github/connect', {
      headers: { accept: 'text/html,application/xhtml+xml' },
    });

    const res = await GET(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/settings/integrations');
    expect(location).toContain('error=unconfigured_provider');
    expect(location).toContain('provider=github');
  });

  it('returns JSON 503 when API request (Accept: application/json) hits unconfigured provider', async () => {
    const req = new NextRequest('http://localhost:3000/api/integrations/github/connect', {
      headers: { accept: 'application/json' },
    });

    const res = await GET(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('github OAuth is not configured');
  });

  it('redirects to GitHub OAuth URL when provider is properly configured', async () => {
    process.env.GITHUB_CLIENT_ID = 'gh-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'gh-client-secret';

    const req = new NextRequest('http://localhost:3000/api/integrations/github/connect');
    const res = await GET(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('github.com/login/oauth/authorize');
    expect(location).toContain('client_id=gh-client-id');
  });

  it('allows mock connect in production when ALLOW_MOCK_CONNECTORS=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_MOCK_CONNECTORS = 'true';

    const req = new NextRequest('http://localhost:3000/api/integrations/github/connect?mock=true');
    const res = await GET(req, { params: Promise.resolve({ provider: 'github' }) });

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/settings/integrations');
    expect(location).toContain('connected=github');
    expect(location).toContain('mock=true');
  });
});
