import { hexToBytes } from './encryption';

export async function decryptTxPayload(blob: string, key: CryptoKey) {
  const data = hexToBytes(blob);
  const iv = data.slice(0, 12);
  const ct = data.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(decrypted));
} 