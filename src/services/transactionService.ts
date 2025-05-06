import api from '@/api';
import type { TransactionPayload, BulkResult } from '@/lib/types';

// single-transaction
export async function submitTransaction(payload: TransactionPayload): Promise<void> {
  await api.post('/api/transactions', payload);
}

// bulk-import
export async function submitTransactions(payloads: TransactionPayload[]): Promise<BulkResult[]> {
  const results = await Promise.all(
    payloads.map(async (payload) => {
      try {
        await submitTransaction(payload);
        return { id: payload.id, status: 'ok' as const };
      } catch (e) {
        return { id: payload.id, status: 'error' as const, message: (e as Error).message };
      }
    })
  );
  return results;
} 