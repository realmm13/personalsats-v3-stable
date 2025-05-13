import type { Transaction } from '@/lib/types';
import { useEncryption } from '@/context/EncryptionContext';
import { generateEncryptionKey } from '@/lib/encryption';

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
  // strip version prefix if present
  let dataStr = blob;
  if (dataStr.startsWith('v1:')) dataStr = dataStr.slice(3);

  // decode hex or Base64
  let combined: Uint8Array;
  if (/^[0-9a-fA-F]+$/.test(dataStr)) {
    combined = fromHex(dataStr);
  } else {
    const bin = atob(dataStr);
    combined = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) combined[i] = bin.charCodeAt(i);
  }

  const iv = combined.slice(0, IV_LENGTH);
  const data = combined.slice(IV_LENGTH);

  const key = encryptionKey;
  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
  } catch (err) {
    console.error('[decryptTx] decryption error:', err);
    throw err;
  }
  const text = new TextDecoder().decode(decrypted);
  return JSON.parse(text);
}

// expose for manual testing in console
declare global {
  interface Window {
    encryptTx: typeof encryptTx;
    decryptTx: typeof decryptTx;
    generateEncryptionKey: typeof generateEncryptionKey;
  }
}
if (typeof window !== 'undefined') {
  window.encryptTx = encryptTx;
  window.decryptTx = decryptTx;
  window.generateEncryptionKey = generateEncryptionKey;
} 