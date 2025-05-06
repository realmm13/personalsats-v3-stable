import { describe, it, expect, beforeEach } from 'vitest';
import { generateEncryptionKey, encryptString, decryptString } from '@/lib/encryption';

describe('Encryption Context', () => {
  const testPassphrase = 'test-passphrase';
  const testSalt = 'test-salt';
  const testData = { sensitive: 'data' };

  it('should generate a valid encryption key', async () => {
    const key = await generateEncryptionKey(testPassphrase, testSalt);
    expect(key).toBeDefined();
    expect(key instanceof CryptoKey).toBe(true);
  });

  it('should encrypt and decrypt data correctly', async () => {
    const key = await generateEncryptionKey(testPassphrase, testSalt);
    const encrypted = await encryptString(JSON.stringify(testData), key);
    const decrypted = await decryptString(encrypted, key);
    expect(JSON.parse(decrypted)).toEqual(testData);
  });

  it('should fail to decrypt with wrong key', async () => {
    const key1 = await generateEncryptionKey(testPassphrase, testSalt);
    const key2 = await generateEncryptionKey('wrong-passphrase', testSalt);
    const encrypted = await encryptString(JSON.stringify(testData), key1);
    await expect(decryptString(encrypted, key2)).rejects.toThrow();
  });
}); 