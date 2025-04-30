import { db } from "@/lib/db";
import { z } from "zod";
import { transactionSchema } from "@/schemas/transaction-schema";
import {
  generateEncryptionKey,
  decryptString,
} from "@/lib/encryption";
import { selectLotsForSale, CostBasisMethod } from "@/lib/cost-basis";
import type { Lot } from "@prisma/client";

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
     accountingMethod?: CostBasisMethod | null; // Allow null
   };
}

// Define body structure expected
interface ProcessTransactionBody {
    timestamp: string;
    encryptedData: string;
}


export async function processTransaction(
  body: ProcessTransactionBody, 
  session: ProcessTransactionSession 
): Promise<{ id: string }> {
  
  // 1. Validate session user ID and passphrase presence
  if (!session?.user?.id) {
    // This case might be better handled in the route handler before calling this function,
    // but adding a check here for robustness.
    throw new Error("User ID missing from session"); // Internal server error potentially
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
  try {
    const key = await generateEncryptionKey(passphrase);
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
  const tx = await db.bitcoinTransaction.create({
    data: {
      userId: userId,
      timestamp: txTimestamp, // Use timestamp from body wrapper
      encryptedData: encryptedData,
      // Spread validated transaction data
      type: transactionData.type,
      amount: transactionData.amount,
      price: transactionData.price,
      fee: transactionData.fee,
      wallet: transactionData.wallet,
      tags: transactionData.tags,
      notes: transactionData.notes,
    },
  });

  // 7. Handle BUY logic: Create a new Lot
  if (tx.type === "buy" && tx.amount && tx.price) {
    try {
      await db.lot.create({
        data: {
          txId: tx.id,
          openedAt: tx.timestamp,
          originalAmount: tx.amount,
          remainingQty: tx.amount,
          costBasisUsd: tx.amount * tx.price,
        },
      });
      console.log(`Created Lot for BUY transaction ${tx.id}`);
    } catch (lotError) {
      // Log the error but potentially don't fail the whole transaction?
      // Or rethrow if lot creation is critical?
      console.error(`Failed to create Lot for transaction ${tx.id}:`, lotError);
      // Decide if this should throw new Error("Failed to create corresponding Lot");
    }
  }
  // 8. Handle SELL logic: Select lots, create Allocations, update Lots
  else if (tx.type === "sell" && tx.amount && tx.price) {
      const openLots = await db.lot.findMany({
        where: {
          transaction: { userId: userId },
          remainingQty: { gt: 0 },
        },
        orderBy: {
          openedAt: 'asc',
        },
      });
      const availableLots = openLots.map((lot: Lot) => ({
        id: lot.id,
        date: lot.openedAt.getTime(),
        originalAmount: lot.originalAmount,
        remaining: lot.remainingQty,
        price: lot.costBasisUsd / lot.originalAmount, // Calculate price per unit for cost basis function
      }));

      const method = session.user.accountingMethod || "FIFO";
      const saleDateMs = tx.timestamp.getTime();
      
      let saleResult;
      try {
        saleResult = selectLotsForSale(
          availableLots,
          tx.amount,
          method as CostBasisMethod,
          tx.price,
          saleDateMs
        );
      } catch (e: any) {
         const errorMessage = e instanceof Error ? e.message : "Unknown error during lot selection";
         console.error(`Lot selection failed for sell tx ${tx.id}:`, errorMessage);
         // Throw specific error type for the route handler to catch as 400
         throw new BadRequestError(errorMessage);
      }

      // Proceed with database transaction only if lot selection succeeded
      await db.$transaction(async (prisma) => {
        for (const sel of saleResult.selectedLots) {
          await prisma.allocation.create({
            data: {
              txId: tx.id,
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
              closedAt: sel.remaining === 0 ? tx.timestamp : null,
              proceedsUsd: sel.remaining === 0 ? sel.proceeds : null,
              gainUsd: sel.remaining === 0 ? sel.realizedGain : null,
              term: sel.remaining === 0 ? (sel.isLongTerm ? "Long" : "Short") : null,
            },
          });
        }
      });
      console.log(`Created Allocations and updated Lots for SELL transaction ${tx.id}`);
  }

  // 9. Return success with the created transaction ID
  return { id: tx.id };
} 