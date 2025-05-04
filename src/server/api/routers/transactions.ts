import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { Prisma } from "@prisma/client"; // Import Prisma namespace
import { CostBasisMethod } from '@/lib/cost-basis';

export const transactionsRouter = createTRPCRouter({
  // --- DELETE MANY TRANSACTIONS ---
  deleteMany: protectedProcedure
    .input(z.array(z.string().cuid())) // Expect an array of CUIDs (transaction IDs)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Ensure the transactions belong to the user before deleting
      const transactionsToDelete = await ctx.db.bitcoinTransaction.findMany({
        where: {
          id: { in: input },
          userId: userId,
        },
        select: { id: true }, // Select only IDs
      });

      const idsToDelete = transactionsToDelete.map(tx => tx.id);

      if (idsToDelete.length === 0) {
        console.log(`[API] No valid transactions found to delete for user ${userId} with input IDs.`);
        return { deletedCount: 0 }; // Or throw an error?
      }
      
      console.log(`[API] Attempting to delete ${idsToDelete.length} transactions for user: ${userId}`);

      // Use Prisma transaction to ensure atomicity
      try {
        const result = await ctx.db.$transaction([
          // Delete related Allocations first
          ctx.db.allocation.deleteMany({
            where: { txId: { in: idsToDelete } }, // Allocations are linked directly by txId
          }),
          // Delete related Lots (this assumes Lots are linked directly, adjust if relation is different)
          ctx.db.lot.deleteMany({
            // Check your schema: If Lot -> Tx is many-to-one via txId
            where: { txId: { in: idsToDelete } }, 
          }),
          // Finally, delete the BitcoinTransactions
          ctx.db.bitcoinTransaction.deleteMany({
            where: { 
              id: { in: idsToDelete },
              // Redundant userId check here, but good for safety
              userId: userId, 
            },
          }),
        ]);
        
        // result[2] contains the deleteMany result for bitcoinTransaction
        const deletedTxCount = result[2].count; 
        console.log(`[API] Successfully deleted ${deletedTxCount} transactions and related data for user: ${userId}`);
        return { deletedCount: deletedTxCount };

      } catch (error) {
          console.error(`[API] Error deleting transactions for user ${userId}:`, error);
          // Re-throw or handle appropriately
          throw new Error("Failed to delete transactions."); 
      }
    }),

  // --- CLEAR ALL TRANSACTIONS ---
  clearAll: protectedProcedure
    // No input needed, uses context
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      
      console.log(`[API] Attempting to delete ALL transactions for user: ${userId}`);

      try {
        // Use Prisma transaction
        const result = await ctx.db.$transaction([
          // Delete ALL Allocations for the user
          ctx.db.allocation.deleteMany({
            where: { transaction: { userId: userId } }, // Navigate relation
          }),
          // Delete ALL Lots for the user
          ctx.db.lot.deleteMany({
            where: { transaction: { userId: userId } }, // Navigate relation
          }),
          // Delete ALL BitcoinTransactions for the user
          ctx.db.bitcoinTransaction.deleteMany({
            where: { userId: userId },
          }),
        ]);

        const deletedTxCount = result[2].count;
        console.log(`[API] Successfully cleared ${deletedTxCount} transactions and related data for user: ${userId}`);
        return { deletedCount: deletedTxCount };
        
      } catch (error) {
          console.error(`[API] Error clearing all transactions for user ${userId}:`, error);
          throw new Error("Failed to clear all transactions.");
      }
    }),

  // --- TAX LEDGER ENDPOINT ---
  getTaxLedger: protectedProcedure
    .input(
      z.object({
        year: z.number().optional(),           // allow filtering by tax year
        method: z.nativeEnum(CostBasisMethod)  // FIFO/LIFO/HIFO
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // 1. fetch all allocations for sells in the year
      const allocs = await ctx.db.allocation.findMany({
        where: {
          transaction: { userId: userId, timestamp: {
            gte: input.year
              ? new Date(`${input.year}-01-01`)
              : new Date(0),
            lt: input.year
              ? new Date(`${input.year + 1}-01-01`)
              : new Date()
          }},
        },
        include: {
          lot: { select: { openedAt: true, costBasisUsd: true, originalAmount: true } },
          transaction: { select: { timestamp: true, price: true, amount: true } }
        }
      });

      // 2. map to ledger rows
      const rows = allocs.map(a => {
        const acquired = a.lot.openedAt;
        const disposed = a.transaction.timestamp;
        const quantity = a.qty;
        const costBasisPerUnit = a.lot.originalAmount > 0 ? a.lot.costBasisUsd / a.lot.originalAmount : 0;
        const costBasis = a.qty * costBasisPerUnit;
        const proceeds  = a.qty * (a.transaction.price ?? 0);
        const gain      = proceeds - costBasis;
        const longTerm  = (disposed.getTime() - acquired.getTime()) >= 365 * 24 * 60 * 60 * 1000;
        return {
          acquired,
          disposed,
          quantity,
          costBasis,
          proceeds,
          gain,
          term: longTerm ? 'Long-Term' : 'Short-Term'
        };
      });

      // 3. unrealized P/L: sum open lots
      const openLots = await ctx.db.lot.findMany({
        where: { transaction: { userId: userId }, remainingQty: { gt: 0 } },
        select: { openedAt: true, remainingQty: true, costBasisUsd: true }
      });
      // you'll need a price-at-date or current market price feed here
      // for now we can skip or compute using the latest spot rate

      return { rows /*, openLots… */ };
    }),
});

export type TransactionsRouter = typeof transactionsRouter; 