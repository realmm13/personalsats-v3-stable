// @ts-nocheck
import { db } from '@/lib/db';
import { auth } from '@/lib/auth'; // direct Better Auth import
import { NextResponse, type NextRequest } from 'next/server';
import { processBulkImportedTransactions } from '@/lib/transactions/process';
import { getDailyBtcUsdPrice } from '@/lib/price';

export async function POST(req: NextRequest) {
  // 1. Auth the user and get userId
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  // Debug log the incoming payload
  const payload = await req.json();
  console.log('🟢 Bulk import payload:', JSON.stringify(payload, null, 2));

  // Accept an array of transactions with encryptedData and clear fields
  const { rows } = payload;

  // Enrich interest transactions with missing price
  for (const r of rows) {
    if (r.type === 'deposit' && Array.isArray(r.tags)) {
      console.log('[API] Deposit with tags:', r.tags, r);
    }
    if (
      r.type === 'deposit' &&
      Array.isArray(r.tags) &&
      r.tags.some(tag => String(tag).toLowerCase().trim() === 'interest') &&
      (typeof r.price !== 'number' || !r.price)
    ) {
      const txDate = new Date(r.timestamp);
      const lookupDay = new Date(Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth(), txDate.getUTCDate()));
      const lookedUpPrice = await getDailyBtcUsdPrice(txDate);
      console.log('[API] Interest TX:', {
        txDate: r.timestamp,
        lookupDay: lookupDay.toISOString(),
        lookedUpPrice,
      });
      if (lookedUpPrice) {
        r.price = lookedUpPrice;
        r.priceAsset = 'USD';
      }
    }
  }

  // 3. Insert transactions
  const created = await db.$transaction(tx =>
    Promise.all(
      rows.map(r =>
        tx.bitcoinTransaction.create({
          data: {
            encryptedData: r.encryptedData,
            type: r.type,
            amount: r.amount,
            price: r.price,
            fee: r.fee,
            timestamp: new Date(r.timestamp),
            wallet: r.wallet,
            tags: r.tags,
            notes: r.notes,
            userId,
          },
        })
      )
    )
  );
  const txIds = created.map(c => c.id);

  // 4. Process the transactions to create lots and allocations
  const bulkResult = await processBulkImportedTransactions(
    userId,
    txIds
  );

  // 5. Return summary with processing results
  return NextResponse.json({ 
    imported: txIds.length, 
    txIds,
    bulkResult 
  });
} 