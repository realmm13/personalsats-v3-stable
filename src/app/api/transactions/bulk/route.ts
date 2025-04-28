import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { auth } from "@/server/auth";
import { Prisma } from "@/generated/prisma";
// Note: No encryption utils needed here, happens on client

// Define the expected payload structure from the client
interface BulkApiPayloadItem {
    timestamp: string; // ISO string
    tags?: string[];
    asset: string;
    priceAsset?: string;
    feeAsset?: string;
    exchangeTxId?: string | null;
    encryptedData: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const incomingPayload: unknown = await req.json();

    // --- Input Validation ---
    if (!Array.isArray(incomingPayload)) {
      return NextResponse.json({ error: 'Invalid payload: Expected an array.' }, { status: 400 });
    }
    // Add more specific validation if needed (e.g., using Zod)
    // For now, basic check and rely on database constraints/types
    const transactionsToCreate: BulkApiPayloadItem[] = incomingPayload as BulkApiPayloadItem[];
    if (transactionsToCreate.length === 0) {
        return NextResponse.json({ message: 'No transactions provided in payload.' }, { status: 200 });
    }
    // -----------------------

    console.log(`Received bulk import request for user ${userId} with ${transactionsToCreate.length} transactions.`);

    // Prepare data for createMany
    const dataToInsert = transactionsToCreate.map(tx => ({
      userId: userId,
      timestamp: new Date(tx.timestamp), // Convert ISO string back to Date
      tags: tx.tags ?? [],
      asset: tx.asset, // Should be present
      priceAsset: tx.priceAsset, // Optional
      feeAsset: tx.feeAsset, // Optional
      exchangeTxId: tx.exchangeTxId, // Optional
      encryptedData: tx.encryptedData, // Already encrypted
      // Explicitly set other direct-mapped optional fields to null/undefined if not in payload
      // to match schema (Prisma handles defaults like asset/priceAsset if they aren't sent)
      type: null,
      amount: null,
      price: null,
      fee: null,
      wallet: null,
      notes: null,
      counterparty: null, 
    }));

    // Insert into database
    const result = await db.bitcoinTransaction.createMany({
      data: dataToInsert,
      skipDuplicates: false, // Decide on duplicate handling - fail or skip? Let's fail for now.
    });

    console.log(`Successfully created ${result.count} transactions via bulk import for user ${userId}.`);

    return NextResponse.json({ success: true, count: result.count });

  } catch (error: unknown) {
    console.error("[BULK_IMPORT_ERROR]", error);
    // Check error type before accessing properties
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') { 
             return NextResponse.json({ error: 'Duplicate transaction detected based on ID or other unique constraints.' }, { status: 409 }); 
        }
        // Handle other known Prisma errors if needed
    }
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    // Generic error
    return NextResponse.json({ error: 'Internal Server Error during bulk import' }, { status: 500 });
  }
} 