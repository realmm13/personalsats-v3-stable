import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { getBitcoinPrice } from "@/lib/price";

export const priceRouter = createTRPCRouter({
  /**
   * Fetches the current Bitcoin price in USD.
   */
  getCurrent: publicProcedure.query(async () => {
    const price = await getBitcoinPrice(false);

    if (typeof price !== 'number') {
      throw new Error("Failed to fetch Bitcoin price as a number.");
    }
    
    // Return structure might include timestamp if needed later
    return {
      price: price,
      timestamp: Date.now(),
    };
  }),
});

export type PriceRouter = typeof priceRouter; 