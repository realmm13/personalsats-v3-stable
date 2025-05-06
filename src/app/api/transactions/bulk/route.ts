// @ts-nocheck
import { db } from '@/lib/db';
import { auth } from '@/lib/auth'; // direct Better Auth import
import { NextResponse, type NextRequest } from 'next/server';

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

  // Accept an array of transactions with encryptedData and decrypted fields
  const { rows } = payload;

  // 3. Insert transactions
  const created = await db.$transaction(tx =>
    Promise.all(
      rows.map(r =>
        tx.bitcoinTransaction.create({
          data: {
            ...r,
            userId,
          },
        })
      )
    )
  );
  const txIds = created.map(c => c.id);

  // 4. Return summary
  return NextResponse.json({
    imported: txIds.length,
    txIds,
  });
} 