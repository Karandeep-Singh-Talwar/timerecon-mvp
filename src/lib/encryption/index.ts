import crypto from 'crypto';

function getEncryptionKey(): Buffer {
  const envKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (envKey && /^[0-9a-fA-F]{64}$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }

  if (!envKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be configured before encrypting integration tokens.');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal key in production.');
  }

  // Keep existing development databases readable while preventing a known, hard-coded fallback
  // from ever protecting OAuth credentials. Production always requires a random 32-byte key.
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypts plain text using AES-256-GCM.
 * Output format: `ivHex:tagHex:cipherHex`
 */
export function encryptToken(text: string): string {
  if (text === undefined || text === null) {
    throw new Error('Text to encrypt cannot be null or undefined');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 12-byte IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted token formatted as `ivHex:tagHex:cipherHex`.
 */
export function decryptToken(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Encrypted text cannot be empty');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
