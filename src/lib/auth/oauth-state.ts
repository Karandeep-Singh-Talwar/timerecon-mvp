import crypto from 'crypto';
import type { IntegrationProvider } from '@/lib/connectors/types';

const STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  userId: string;
  provider: IntegrationProvider;
  expiresAt: number;
  nonce: string;
}

function getSigningKey(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required to create OAuth state.');
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSigningKey()).update(payload).digest('base64url');
}

export function createOAuthState(userId: string, provider: IntegrationProvider): string {
  const payload: OAuthStatePayload = {
    userId,
    provider,
    expiresAt: Date.now() + STATE_TTL_MS,
    nonce: crypto.randomBytes(16).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [encodedPayload, signature, ...extra] = state.split('.');
  if (!encodedPayload || !signature || extra.length > 0) return null;

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as OAuthStatePayload;
    const providers: IntegrationProvider[] = ['jira', 'github', 'google_calendar'];
    if (
      !payload.userId ||
      !providers.includes(payload.provider) ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt < Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
