import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { Prisma } from "@prisma/client"; // Import Prisma namespace

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
});

export type TransactionsRouter = typeof transactionsRouter; 