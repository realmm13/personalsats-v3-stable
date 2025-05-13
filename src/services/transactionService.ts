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

// Update: Return the full API response so the frontend can access imported/processed counts
export async function submitTransactions(
  txs: TransactionPayload[],
  encryptionPhrase: string,
  encryptionSalt: string
): Promise<any> {
  // Send all rows in one request to the bulk API, including encryption fields
  const response = await api.post(
    '/api/transactions/bulk',
    { rows: txs, encryptionPhrase, encryptionSalt }
  );
  return response;
} 