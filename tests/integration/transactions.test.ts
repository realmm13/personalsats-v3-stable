import { describe, it, expect, beforeEach } from 'vitest';
import { processTransaction } from '@/lib/transactions/process';
import { generateEncryptionKey, encryptString } from '@/lib/encryption';

describe('Transaction API', () => {
  const testUser = {
    id: 'test-user-id',
    encryptionPhrase: 'test-passphrase',
    encryptionSalt: 'test-salt',
  };

  const testTransaction = {
    type: 'buy',
    amount: 0.5,
    price: 50000,
    date: new Date().toISOString(),
  };

  it('should process a valid transaction', async () => {
    const key = await generateEncryptionKey(testUser.encryptionPhrase, testUser.encryptionSalt);
    const encryptedData = await encryptString(JSON.stringify(testTransaction), key);

    const result = await processTransaction(
      {
        timestamp: new Date().toISOString(),
        encryptedData,
      },
      { user: testUser }
    );

    expect(result).toHaveProperty('id');
  });

  it('should reject invalid transaction data', async () => {
    const key = await generateEncryptionKey(testUser.encryptionPhrase, testUser.encryptionSalt);
    const encryptedData = await encryptString(JSON.stringify({ invalid: 'data' }), key);

    await expect(
      processTransaction(
        {
          timestamp: new Date().toISOString(),
          encryptedData,
        },
        { user: testUser }
      )
    ).rejects.toThrow();
  });
}); 