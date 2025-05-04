// @ts-nocheck
import { db } from '@/lib/db';
import { auth } from '@/lib/auth'; // direct Better Auth import
import { processBulkImportedTransactions } from '@/lib/transactions/process';
import { NextResponse, NextRequest } from 'next/server';

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

  // Destructure rows and encryptionPhrase from payload
  const { rows, encryptionPhrase } = payload;

  // 3. Insert transactions
  const created = await db.$transaction(tx =>
    Promise.all(
      rows.map(r =>
        tx.bitcoinTransaction.create({
          data: {
            userId,
            encryptedData: r.encryptedData,
            timestamp: new Date(r.timestamp),
            tags: r.tags ?? [],
            asset: r.asset,
            priceAsset: r.priceAsset,
            feeAsset: r.feeAsset,
            exchangeTxId: r.exchangeTxId,
          },
        })
      )
    )
  );
  const txIds = created.map(c => c.id);

  // 4. Process them
  const result = await processBulkImportedTransactions(
    userId,
    txIds,
    encryptionPhrase
  );

  // 5. Return summary
  return NextResponse.json({
    imported: txIds.length,
    processed: result.processed,
    errors: result.errors,
  });
} 