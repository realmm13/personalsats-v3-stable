import api from '@/api';
import type { TransactionPayload, BulkResult } from '@/lib/types';

// single-transaction
export async function submitTransaction(payload: TransactionPayload): Promise<void> {
  await api.post('/api/transactions', payload);
}

// bulk-import
export interface BulkImportResponse {
  inserted: number;
  errors: { id: string; message: string }[];
}

export async function submitTransactions(txs: TransactionPayload[]): Promise<BulkResult[]> {
  // Send all rows in one request to the bulk API
  const { inserted, errors = [] }: BulkImportResponse = await api.post(
    '/api/transactions/bulk',
    { rows: txs }
  );

  // Map successes and failures back to BulkResult[]
  const successes: BulkResult[] = txs
    .filter(tx => errors.every(e => e.id !== tx.id))
    .map(tx => ({ id: tx.id, status: 'ok' as const }));

  const failures: BulkResult[] = errors.map(e => ({
    id: e.id,
    status: 'error' as const,
    message: e.message,
  }));

  return [...successes, ...failures];
} 