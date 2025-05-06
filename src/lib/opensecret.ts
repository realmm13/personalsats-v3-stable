import type { Transaction } from '@/lib/types';

const IV_LENGTH = 12;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export async function encryptTx(tx: Transaction, encryptionKey: CryptoKey): Promise<string> {
  if (!encryptionKey) throw new Error('Encryption key not set');
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const data = new TextEncoder().encode(JSON.stringify(tx));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, data)
  );
  // prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + encrypted.length);
  combined.set(iv, 0);
  combined.set(encrypted, iv.length);
  return toHex(combined);
}

export async function decryptTx(blob: string, encryptionKey: CryptoKey): Promise<Transaction> {
  if (!encryptionKey) throw new Error('Encryption key not set');
  const combined = fromHex(blob);
  const iv = combined.slice(0, IV_LENGTH);
  const data = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    data
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
} 