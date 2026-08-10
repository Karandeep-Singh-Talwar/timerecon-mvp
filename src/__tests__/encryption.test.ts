import { describe, it, expect, afterEach } from 'vitest';
import { encryptToken, decryptToken } from '@/lib/encryption';

describe('Token Encryption Utility', () => {
  const originalEnv = process.env.TOKEN_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TOKEN_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    }
  });

  it('requires an encryption key instead of using a hard-coded fallback key', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken('jira-oauth-secret-token-12345')).toThrow('TOKEN_ENCRYPTION_KEY');
  });

  it('encrypts and decrypts text correctly with valid env TOKEN_ENCRYPTION_KEY', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const plainText = 'github_pat_11AAAAAAA_bbbbbbbbbb';
    const encrypted = encryptToken(plainText);

    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(plainText);
  });

  it('rejects an invalid encryption key in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.TOKEN_ENCRYPTION_KEY = 'invalid-key';
    Reflect.set(process.env, 'NODE_ENV', 'production');
    expect(() => encryptToken('google-refresh-token')).toThrow('64-character hexadecimal key');
    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
    } else {
      Reflect.set(process.env, 'NODE_ENV', originalNodeEnv);
    }
  });

  it('throws an error when attempting to decrypt invalid format or corrupted ciphertext', () => {
    expect(() => decryptToken('invalid-encrypted-string')).toThrow('Invalid encrypted token format');
    expect(() => decryptToken('')).toThrow('Encrypted text cannot be empty');

    const validEncrypted = encryptToken('test-secret');
    const [iv, tag] = validEncrypted.split(':');
    const corrupted = `${iv}:${tag}:badcipherdata`;
    expect(() => decryptToken(corrupted)).toThrow();
  });
});
