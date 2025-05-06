import type { Transaction } from '@/lib/types';
import { z } from 'zod';

const TxSchema = z.object({
  id: z.string(),
  amount: z.number().nonnegative(),
  date: z.string().transform(d => new Date(d)),
  description: z.string().optional(),
  // add other fields here as needed
});

export function validateTransaction(tx: Transaction): { ok: boolean; errors: string[] } {
  const result = TxSchema.safeParse(tx);
  return result.success
    ? { ok: true, errors: [] }
    : { ok: false, errors: result.error.errors.map(e => e.message) };
} 