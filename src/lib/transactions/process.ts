// @ts-nocheck
import { db } from "@/lib/db";
import { z } from "zod";
import { transactionSchema, type TransactionFormData } from "@/schemas/transaction-schema";
import {
  generateEncryptionKey,
  decryptString,
} from "@/lib/encryption";
import { selectLotsForSale, CostBasisMethod, type AvailableLot, type SelectedLot, type SaleResult } from "@/lib/cost-basis";
import type { Lot, User, BitcoinTransaction } from "@prisma/client";
import { Prisma } from "@prisma/client";

// Custom error for request-related issues (validation, etc.)
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

// Schema for the incoming API request wrapper (copied from route.ts)
const wrapperSchema = z.object({
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date string"),
  encryptedData: z.string(),
});

// Define session structure expected by the function
interface ProcessTransactionSession {
   user: { 
     id: string; 
     encryptionPhrase: string; 
     accountingMethod?: CostBasisMethod | null;
   };
}

// Define body structure expected
interface ProcessTransactionBody {
    timestamp: string;
    encryptedData: string;
}

// --- Refactored Logic for applying Lot/Allocation rules ---
async function _applyTransactionLogic(
  userId: string,
  txId: string,
  txTimestamp: Date,
  transactionData: TransactionFormData,
  accountingMethod: CostBasisMethod
) {
  // 7. Handle BUY logic: Create a new Lot
  if (transactionData.type === "buy" && transactionData.amount && transactionData.price) {
    // Idempotency check: Check if Lot already exists for this transaction ID
    const existingLot = await db.lot.findFirst({ where: { txId: txId } });
    if (!existingLot) {
      try {
        await db.lot.create({
          data: {
            txId: txId,
            openedAt: txTimestamp,
            originalAmount: transactionData.amount,
            remainingQty: transactionData.amount,
            costBasisUsd: transactionData.amount * transactionData.price,
          },
        });
        console.log(`Logic: Created Lot for BUY transaction ${txId}`);
      } catch (lotError) {
        console.error(`Logic: Failed to create Lot for transaction ${txId}:`, lotError);
        // Propagate error upwards
        throw new Error(`Failed to create corresponding Lot for tx ${txId}`); 
      }
    } else {
      console.log(`Logic: Lot already exists for BUY transaction ${txId}, skipping creation.`);
    }
  }
  // 8. Handle SELL logic: Select lots, create Allocations, update Lots
  else if (transactionData.type === "sell" && transactionData.amount && transactionData.price) {
      // Idempotency check: Check if Allocations already exist for this transaction ID
      const existingAllocations = await db.allocation.count({ where: { txId: txId } });
      if (existingAllocations > 0) {
        console.log(`Logic: Allocations already exist for SELL transaction ${txId}, skipping processing.`);
        return; // Already processed
      }

      const openLots = await db.lot.findMany({
        where: {
          transaction: { userId: userId },
          remainingQty: { gt: 1e-9 },
        },
        orderBy: { openedAt: 'asc' },
      });
      
      if (openLots.length === 0) {
          // It's possible there are no lots, this shouldn't necessarily be a BadRequest
          // if the user simply hasn't bought anything yet. selectLotsForSale handles this.
          console.log(`Logic: No open lots available for user ${userId} to process SELL ${txId}.`);
          // Let selectLotsForSale handle the "Insufficient lots" error
      }
      
      const availableLots: AvailableLot[] = openLots.map((lot) => ({
        id: lot.id,
        date: lot.openedAt.getTime(),
        originalAmount: lot.originalAmount,
        remaining: lot.remainingQty,
        price: (lot.originalAmount > 1e-9) ? lot.costBasisUsd / lot.originalAmount : 0, 
      }));

      const saleDateMs = txTimestamp.getTime();
      let saleResult: SaleResult;
      try {
        saleResult = selectLotsForSale(
          availableLots,
          transactionData.amount,
          accountingMethod,
          transactionData.price,
          saleDateMs
        );
        if (saleResult.error) {
            throw new Error(saleResult.error);
        }
         if (!saleResult.selectedLots || saleResult.selectedLots.length === 0) {
             console.warn(`Logic: Lot selection for tx ${txId} resulted in no lots being selected.`);
             throw new Error('Lot selection process failed to return selected lots.');
        }

      } catch (e: any) {
         const errorMessage = e instanceof Error ? e.message : "Unknown error during lot selection";
         console.error(`Logic: Lot selection failed for sell tx ${txId}:`, errorMessage);
         if (errorMessage.includes("Insufficient available lots")) {
             throw new BadRequestError(errorMessage);
         }
         throw new Error(errorMessage); 
      }

      // Proceed with database transaction only if lot selection succeeded and returned lots
      try {
          await db.$transaction(async (prisma) => {
            for (const sel of saleResult.selectedLots) {
              if (sel.amountUsed <= 1e-9) continue; 
              
              await prisma.allocation.create({
                data: {
                  txId: txId,
                  lotId: sel.id,
                  qty: sel.amountUsed,
                  costUsd: sel.costBasis,
                  proceedsUsd: sel.proceeds,
                  gainUsd: sel.realizedGain,
                },
              });

              await prisma.lot.update({
                where: { id: sel.id },
                data: {
                  remainingQty: sel.remaining,
                  closedAt: sel.remaining < 1e-8 ? txTimestamp : null,
                  proceedsUsd: sel.remaining < 1e-8 ? sel.proceeds : undefined,
                  gainUsd: sel.remaining < 1e-8 ? sel.realizedGain : undefined,
                  term: sel.remaining < 1e-8 ? (sel.isLongTerm ? "Long" : "Short") : null,
                },
              });
            }
          });
          console.log(`Logic: Created Allocations and updated Lots for SELL transaction ${txId}`);
      } catch (dbError) {
           console.error(`Logic: Failed to save Allocations/update Lots for tx ${txId}:`, dbError);
           throw new Error(`Database update failed during allocation creation/update for tx ${txId}`);
      }
  }
}
// --- End Refactored Logic ---

// This function now handles API interaction, decryption, initial TX creation,
// and then calls the core logic function.
export async function processTransaction(
  body: ProcessTransactionBody, 
  session: ProcessTransactionSession 
): Promise<{ id: string }> {
  
  // 1. Validate session user ID and passphrase presence
  if (!session?.user?.id) {
    throw new Error("User ID missing from session"); // Internal server error
  }
  const userId = session.user.id;
  const passphrase = session.user.encryptionPhrase;
  if (!passphrase) {
    throw new BadRequestError("Encryption key setup incomplete.");
  }

  // 2. Parse and validate the incoming request body wrapper
  const wrapperParsed = wrapperSchema.safeParse(body);
  if (!wrapperParsed.success) {
     throw new BadRequestError(`Invalid API data format: ${wrapperParsed.error.flatten().fieldErrors}`);
  }
  const { timestamp: timestampString, encryptedData } = wrapperParsed.data;

  // 3. Derive key & decrypt data
  let plaintextJson: string;
  let key: CryptoKey;
  try {
    key = await generateEncryptionKey(passphrase);
    plaintextJson = await decryptString(encryptedData, key);
  } catch (decryptError) {
    console.error("Decryption failed:", decryptError);
    throw new BadRequestError("Decryption failed. Invalid key or data?");
  }

  // 4. Parse decrypted JSON
  let decryptedPayload;
  try {
      decryptedPayload = JSON.parse(plaintextJson);
  } catch (parseError) {
      console.error("Failed to parse decrypted JSON:", parseError);
      throw new BadRequestError("Decrypted data is not valid JSON");
  }

  // 5. Validate decrypted payload against transaction schema
  const txParsed = transactionSchema.safeParse(decryptedPayload);
  if (!txParsed.success) {
    console.error("Decrypted data validation failed:", txParsed.error.flatten());
    throw new BadRequestError(`Invalid transaction data after decryption: ${JSON.stringify(txParsed.error.flatten().fieldErrors)}`);
  }
  const transactionData = txParsed.data;

  // 6. Create the core BitcoinTransaction record
  const txTimestamp = new Date(timestampString);
  let tx;
  try {
      tx = await db.bitcoinTransaction.create({
    data: {
      userId: userId,
          timestamp: txTimestamp,
      encryptedData: encryptedData,
      type: transactionData.type,
      amount: transactionData.amount,
      price: transactionData.price,
      fee: transactionData.fee,
      wallet: transactionData.wallet,
      tags: transactionData.tags,
      notes: transactionData.notes,
    },
  });
  } catch (createError) {
       console.error(`Failed to create BitcoinTransaction record:`, createError);
       throw new Error(`Database error during transaction creation.`);
  }
  
  // 7. Call the refactored logic function
  try {
      const accountingMethod = (session.user.accountingMethod as CostBasisMethod | null) ?? CostBasisMethod.FIFO;
      await _applyTransactionLogic(userId, tx.id, tx.timestamp, transactionData, accountingMethod);
  } catch (logicError: any) {
      console.error(`Error applying transaction logic for ${tx.id} (Tx record created but Lot/Allocation failed):`, logicError.message);
      
      if (logicError instanceof BadRequestError) {
          throw logicError;
      }
      throw new Error(`Transaction created (ID: ${tx.id}) but failed during cost basis processing: ${logicError.message}`);
  }

  // 8. Return success with the created transaction ID
  console.log(`Successfully processed transaction ${tx.id}`);
  return { id: tx.id };
}

// --- Bulk Processing Logic Implementation ---

/**
 * Defines the structure for the result of the bulk processing operation.
 */
export type BulkResult = {
  processed: number;
  errors: { txId: string; message: string }[];
};

/**
 * Processes a batch of newly imported transactions by fetching them, decrypting,
 * and applying the core Lot/Allocation logic.
 * 
 * @param userId The ID of the user owning these transactions.
 * @param txIds An array of IDs for the BitcoinTransaction records already created.
 * @param encryptionPhrase The user's encryption passphrase.
 * @returns A Promise resolving to a BulkResult object.
 */
export async function processBulkImportedTransactions(
  userId: string,
  txIds: string[],
  encryptionPhrase: string,
): Promise<BulkResult> {
  if (!txIds || txIds.length === 0) {
    console.log("No transaction IDs provided for bulk processing.");
    return { processed: 0, errors: [] };
  }
  if (!encryptionPhrase) {
     console.error(`Bulk processing cannot proceed for user ${userId}: Encryption phrase is missing.`);
     // Return an error reflecting failure for all provided IDs
     return {
       processed: 0,
       errors: txIds.map(id => ({ txId: id, message: "Encryption phrase missing" }))
     };
  }

  console.log(`Starting bulk processing for ${txIds.length} transactions for user ${userId}...`);

  let key: CryptoKey;
  try {
     key = await generateEncryptionKey(encryptionPhrase);
  } catch (keyError) {
     console.error(`Bulk processing failed: Could not generate key for user ${userId}.`, keyError);
     return {
        processed: 0,
        errors: txIds.map(id => ({ txId: id, message: "Key generation failed" }))
     };
  }

  // Fetch the user's accounting method separately (if needed and not passed in)
  // Assuming it might be needed by _applyTransactionLogic
  const user = await db.user.findUnique({
      where: { id: userId },
      select: { accountingMethod: true }
  });
  const accountingMethod = (user?.accountingMethod as CostBasisMethod | null) ?? CostBasisMethod.FIFO;

  // Fetch all transactions at once
  const transactions = await db.bitcoinTransaction.findMany({
        where: {
      id: { in: txIds },
      userId: userId, // Ensure we only fetch transactions belonging to the user
        },
      });

  let processedCount = 0;
  const errorsResult: { txId: string; message: string }[] = [];

  // Process each transaction sequentially (could be parallelized with Promise.all if logic is safe)
  for (const tx of transactions) {
    try {
      if (!tx.encryptedData) {
        throw new Error("Transaction record is missing encryptedData.");
      }

      // 1. Decrypt
      const plaintextJson = await decryptString(tx.encryptedData, key);
      const decryptedPayload = JSON.parse(plaintextJson);

      // 2. Validate
      const txParsed = transactionSchema.safeParse(decryptedPayload);
      if (!txParsed.success) {
        throw new Error(`Invalid decrypted data: ${JSON.stringify(txParsed.error.flatten().fieldErrors)}`);
      }
      const transactionData = txParsed.data;
      
      // 3. Update the main transaction record with decrypted fields (idempotent)
      //    This avoids repeated decryption in the future.
       if (tx.type !== transactionData.type || 
           tx.amount !== transactionData.amount || 
           tx.price !== transactionData.price ||
           tx.fee !== transactionData.fee ||
           tx.wallet !== transactionData.wallet ||
           tx.notes !== transactionData.notes) { 
            await db.bitcoinTransaction.update({
                where: { id: tx.id },
            data: {
                    type: transactionData.type,
                    amount: transactionData.amount,
                    price: transactionData.price,
                    fee: transactionData.fee,
                    wallet: transactionData.wallet,
                    notes: transactionData.notes,
            },
          });
        }

      // 4. Apply the core logic (BUY/SELL -> Lot/Allocation)
      await _applyTransactionLogic(userId, tx.id, tx.timestamp, transactionData, accountingMethod);

      processedCount++;
    } catch (error: any) {
      console.error(`Bulk processing failed for transaction ${tx.id}:`, error.message);
      errorsResult.push({ txId: tx.id, message: error.message || "Unknown processing error" });
      // Continue to the next transaction
    }
  }

  console.log(`Bulk processing finished for user ${userId}. Processed: ${processedCount}, Errors: ${errorsResult.length}`);
  return { processed: processedCount, errors: errorsResult };
}

// export type BulkResult = { ... };
// export async function processBulkImportedTransactions(...) { ... } 