import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { generateTaxReport } from "@/lib/tax/report";
import { CostBasisMethod } from "@/lib/cost-basis"; // Only 'HIFO'
import { getBitcoinPrice } from "@/lib/price"; // Import price fetching utility

// Helper function to simulate fetching current price (replace with actual implementation)
async function getCurrentBtcPrice(): Promise<number> {
  // Replace with actual API call or price service
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async fetch
  return 60000; // Placeholder value
}

// Define the input schema including the optional currentPrice
const getReportByYearInput = z.object({
  year: z.number(),
  method: z.nativeEnum(CostBasisMethod), // Use nativeEnum for TS enums
  currentPrice: z.number().optional(), // Add optional currentPrice
});

export const taxRouter = createTRPCRouter({
  /**
   * Generates a tax report for a specific year and accounting method.
   */
  getReportByYear: protectedProcedure
    .input(getReportByYearInput) // Use the updated schema
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      // Determine the current price: use input if provided, otherwise fetch it
      let priceToUse: number;
      if (input.currentPrice !== undefined) {
        priceToUse = input.currentPrice;
      } else {
        const fetchedPrice = await getBitcoinPrice(false);
        if (typeof fetchedPrice !== 'number') {
          throw new Error("Failed to fetch current Bitcoin price for tax report.");
        }
        priceToUse = fetchedPrice;
      }
      
      // Pass year, method, and the determined currentPrice to the service
      const report = await generateTaxReport(userId, input.year, priceToUse);
      
      return report;
    }),
}); 