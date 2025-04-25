import { z } from "zod";

export const bitcoinEnvSchema = z.object({
  // Client-side variables
  NEXT_PUBLIC_PRICE_CACHE_DURATION: z.coerce
    .number()
    .min(1000)
    .default(300000)
    .describe("Duration in milliseconds to cache Bitcoin price data"),
  NEXT_PUBLIC_PRICE_UPDATE_INTERVAL: z.coerce
    .number()
    .min(1000)
    .default(60000)
    .describe("Interval in milliseconds to update Bitcoin price"),
  
  // Server-side variables
  COINBASE_API_KEY: z.string().optional(),
  COINBASE_API_SECRET: z.string().optional(),
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  KRAKEN_API_KEY: z.string().optional(),
  KRAKEN_API_SECRET: z.string().optional(),
  
  // Feature flags
  NEXT_PUBLIC_ENABLE_PRICE_ALERTS: z.coerce
    .boolean()
    .default(false)
    .describe("Enable price alert notifications"),
});

export type BitcoinEnvSchema = z.infer<typeof bitcoinEnvSchema>; 